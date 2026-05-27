import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  authOnlyWalletPlaceholder,
  ensureUserRow,
  isAuthOnlyWalletPlaceholder,
} from './user-bootstrap'

const AUTH_ID = '11111111-1111-1111-1111-111111111111'

function makeSupabaseMock(handlers: {
  existingRow?: Record<string, unknown> | null
  insertedRow?: Record<string, unknown>
}) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: handlers.existingRow ?? null,
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data:
        handlers.insertedRow ??
        handlers.existingRow ?? {
          id: AUTH_ID,
          wallet_address: authOnlyWalletPlaceholder(AUTH_ID),
          email: 'driver@example.com',
          is_active: true,
        },
      error: null,
    }),
  }

  const from = vi.fn((table: string) => {
    if (table !== 'users') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return {
      select: vi.fn(() => selectChain),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
  })

  return { from, selectChain }
}

describe('user-bootstrap', () => {
  describe('authOnlyWalletPlaceholder', () => {
    it('prefixes auth user id for synthetic wallet_address', () => {
      expect(authOnlyWalletPlaceholder(AUTH_ID)).toBe(`auth:${AUTH_ID}`)
      expect(isAuthOnlyWalletPlaceholder(`auth:${AUTH_ID}`)).toBe(true)
      expect(isAuthOnlyWalletPlaceholder('0xabc')).toBe(false)
    })
  })

  describe('ensureUserRow', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns existing user without upsert when row already exists', async () => {
      const existing = {
        id: AUTH_ID,
        wallet_address: '0xexisting',
        email: 'existing@example.com',
      }
      const upsert = vi.fn()
      const { from, selectChain } = makeSupabaseMock({ existingRow: existing })
      const supabase = {
        from: (table: string) => ({
          ...from(table),
          upsert,
        }),
      } as unknown as Parameters<typeof ensureUserRow>[0]

      const row = await ensureUserRow(supabase, AUTH_ID, 'new@example.com')

      expect(row).toEqual(existing)
      expect(from).toHaveBeenCalledWith('users')
      expect(selectChain.maybeSingle).toHaveBeenCalledTimes(1)
      expect(upsert).not.toHaveBeenCalled()
    })

    it('creates user with matching id and auth placeholder wallet on fresh sign-up', async () => {
      const inserted = {
        id: AUTH_ID,
        wallet_address: authOnlyWalletPlaceholder(AUTH_ID),
        email: 'driver@example.com',
        is_active: true,
      }
      const { from, selectChain } = makeSupabaseMock({
        existingRow: null,
        insertedRow: inserted,
      })

      let upsertPayload: Record<string, unknown> | undefined
      const fromWithUpsert = vi.fn((table: string) => {
        const base = from(table)
        return {
          ...base,
          upsert: vi.fn((payload: Record<string, unknown>, options: unknown) => {
            upsertPayload = payload
            expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true })
            return Promise.resolve({ error: null })
          }),
        }
      })

      const supabase = { from: fromWithUpsert } as unknown as Parameters<
        typeof ensureUserRow
      >[0]

      const row = await ensureUserRow(supabase, AUTH_ID, 'Driver@Example.com')

      expect(upsertPayload).toMatchObject({
        id: AUTH_ID,
        wallet_address: authOnlyWalletPlaceholder(AUTH_ID),
        email: 'driver@example.com',
        is_active: true,
      })
      expect(row).toEqual(inserted)
      expect(selectChain.maybeSingle).toHaveBeenCalled()
      expect(selectChain.single).toHaveBeenCalled()
    })
  })
})
