import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  looksLikeEmploymentConfirmation,
  processEvrInboundEmail,
} from '@/lib/evr-inbound'

const OPEN_ROW = {
  id: 'evr-1',
  driver_id: 'user-1',
  previous_employer_email: 'hr@acmetrucking.com',
  previous_employer_name: 'Acme',
  claimed_start_date: '2022-01-01',
  claimed_end_date: '2024-01-01',
  status: 'VERIFICATION_REQUESTED',
}

function mockSupabase(opts: {
  byTracking?: typeof OPEN_ROW | null
  openRows?: typeof OPEN_ROW[]
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.byTracking ?? null }),
      })),
      in: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: opts.openRows ?? [] }),
        })),
      })),
    })),
    update: vi.fn(() => ({ eq: updateEq })),
    insert: vi.fn().mockResolvedValue({ error: null }),
  }))
  return { client: { from } as unknown as SupabaseClient, updateEq }
}

describe('evr-inbound', () => {
  it('treats YES-style replies as confirmation', () => {
    expect(looksLikeEmploymentConfirmation('YES, dates are correct')).toBe(true)
    expect(looksLikeEmploymentConfirmation('never worked here')).toBe(false)
  })

  it('matches by Pingram tracking id and marks verified on YES', async () => {
    const { client, updateEq } = mockSupabase({ byTracking: OPEN_ROW })
    const result = await processEvrInboundEmail(client, {
      eventType: 'EMAIL_INBOUND',
      from: 'payroll@acmetrucking.com',
      trackingId: 'pg-99',
      bodyText: 'Yes, those dates are correct.',
    })
    expect(result).toEqual({ ok: true, requestId: 'evr-1', dkimValid: false })
    expect(updateEq).toHaveBeenCalled()
  })

  it('rejects a From domain that does not match the invited mailbox', async () => {
    const { client } = mockSupabase({ byTracking: OPEN_ROW })
    const result = await processEvrInboundEmail(client, {
      eventType: 'EMAIL_INBOUND',
      from: 'spoof@evil.example',
      trackingId: 'pg-99',
      bodyText: 'YES',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/from domain/i)
  })

  it('falls back to open requests when tracking id is missing', async () => {
    const { client } = mockSupabase({ byTracking: null, openRows: [OPEN_ROW] })
    const result = await processEvrInboundEmail(client, {
      eventType: 'EMAIL_INBOUND',
      from: 'hr@acmetrucking.com',
      bodyText: 'Confirmed',
    })
    expect(result).toEqual({ ok: true, requestId: 'evr-1', dkimValid: false })
  })

  it('matches a fresh email sent to the per-packet delivery address', async () => {
    // Not a reply (no tracking id) — the employer composed a new email to
    // evr-<requestId>@verify.provven.com. The alias in `to` names the request.
    const uuidRow = { ...OPEN_ROW, id: '3f9c2f2a-71c4-4c5e-9d55-2f5a8b1c9e10' }
    const { client } = mockSupabase({ byTracking: uuidRow })
    const result = await processEvrInboundEmail(client, {
      eventType: 'EMAIL_INBOUND',
      from: 'records@acmetrucking.com',
      to: 'evr-3f9c2f2a-71c4-4c5e-9d55-2f5a8b1c9e10@verify.provven.com',
      bodyText: 'Completed form attached. Dates confirmed.',
    })
    expect(result).toEqual({
      ok: true,
      requestId: '3f9c2f2a-71c4-4c5e-9d55-2f5a8b1c9e10',
      dkimValid: false,
    })
  })
})
