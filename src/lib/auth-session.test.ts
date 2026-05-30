import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveStormUserId } from './auth-session'

const SUPABASE_USER_ID = '11111111-1111-1111-1111-111111111111'

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

describe('resolveStormUserId (Supabase-only)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the Supabase auth user id when a session exists', async () => {
    const supabaseSession = makeSessionClient({ userId: SUPABASE_USER_ID })

    const id = await resolveStormUserId({ supabaseSession })

    expect(id).toBe(SUPABASE_USER_ID)
  })

  it('returns null when there is no Supabase session', async () => {
    const supabaseSession = makeSessionClient({ userId: null })

    const id = await resolveStormUserId({ supabaseSession })

    expect(id).toBeNull()
  })

  it('returns null (no throw) when Supabase auth.getUser throws', async () => {
    const supabaseSession = makeSessionClient({ shouldThrow: true })

    const id = await resolveStormUserId({ supabaseSession })

    expect(id).toBeNull()
  })
})
