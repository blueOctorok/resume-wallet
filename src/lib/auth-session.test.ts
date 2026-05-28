import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveStormUserId, type AuthSessionRequest } from './auth-session'

const SUPABASE_USER_ID = '11111111-1111-1111-1111-111111111111'
const WALLET_USER_ID = '22222222-2222-2222-2222-222222222222'
const WALLET_ADDRESS = '0xabc123'

/**
 * Build a minimal request whose `headers.get` only knows about
 * `x-wallet-address`. Returns null otherwise.
 */
function makeRequest(walletAddress: string | null): AuthSessionRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'x-wallet-address' ? walletAddress : null,
    },
  }
}

function makeSessionClient(opts: {
  userId?: string | null
  shouldThrow?: boolean
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.shouldThrow) throw new Error('cookie network failure')
        if (opts.userId) {
          return { data: { user: { id: opts.userId } }, error: null }
        }
        return { data: { user: null }, error: null }
      }),
    },
  } as unknown as SupabaseClient
}

function makeAdminClient(opts: {
  walletUser?: { id: string } | null
}): SupabaseClient {
  // user-by-wallet calls: from('users').select('*').ilike(..).order(..).limit(1)
  const limit = vi.fn().mockResolvedValue({
    data: opts.walletUser ? [opts.walletUser] : [],
    error: null,
  })
  const order = vi.fn(() => ({ limit }))
  const ilike = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ ilike }))
  const from = vi.fn(() => ({ select }))
  return { from } as unknown as SupabaseClient
}

describe('resolveStormUserId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the Supabase auth user id when a session exists (no wallet lookup)', async () => {
    const supabaseSession = makeSessionClient({ userId: SUPABASE_USER_ID })
    const supabaseAdmin = makeAdminClient({ walletUser: { id: WALLET_USER_ID } })

    const id = await resolveStormUserId(makeRequest(WALLET_ADDRESS), {
      supabaseSession,
      supabaseAdmin,
    })

    expect(id).toBe(SUPABASE_USER_ID)
    // Wallet path must not have been hit when Supabase session won.
    expect(supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it('falls back to wallet header when no Supabase session', async () => {
    const supabaseSession = makeSessionClient({ userId: null })
    const supabaseAdmin = makeAdminClient({ walletUser: { id: WALLET_USER_ID } })

    const id = await resolveStormUserId(makeRequest(WALLET_ADDRESS), {
      supabaseSession,
      supabaseAdmin,
    })

    expect(id).toBe(WALLET_USER_ID)
  })

  it('falls back to wallet header even when Supabase auth throws', async () => {
    const supabaseSession = makeSessionClient({ shouldThrow: true })
    const supabaseAdmin = makeAdminClient({ walletUser: { id: WALLET_USER_ID } })

    const id = await resolveStormUserId(makeRequest(WALLET_ADDRESS), {
      supabaseSession,
      supabaseAdmin,
    })

    expect(id).toBe(WALLET_USER_ID)
  })

  it('returns null when wallet header is present but no user row matches', async () => {
    const supabaseSession = makeSessionClient({ userId: null })
    const supabaseAdmin = makeAdminClient({ walletUser: null })

    const id = await resolveStormUserId(makeRequest('0xunknown'), {
      supabaseSession,
      supabaseAdmin,
    })

    expect(id).toBeNull()
  })

  it('returns null when neither Supabase session nor wallet header is present', async () => {
    const supabaseSession = makeSessionClient({ userId: null })
    const supabaseAdmin = makeAdminClient({ walletUser: null })

    const id = await resolveStormUserId(makeRequest(null), {
      supabaseSession,
      supabaseAdmin,
    })

    expect(id).toBeNull()
    // No wallet header → admin client must not be queried.
    expect(supabaseAdmin.from).not.toHaveBeenCalled()
  })
})
