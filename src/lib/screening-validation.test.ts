import { describe, expect, it, vi } from 'vitest'
import { checkRecentDuplicateOrder, validateConsentProfile } from '@/lib/screening-validation'

const completeProfile = {
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1985-04-12',
  dlNumber: 'OH123456',
  dlState: 'OH',
  address: '100 Main Street',
  city: 'Cleveland',
  state: 'OH',
  zip: '44114',
}

describe('validateConsentProfile', () => {
  it('accepts a complete profile', () => {
    expect(validateConsentProfile(completeProfile)).toEqual({ ok: true })
  })

  it('names every blank the order needs, in one message', () => {
    const result = validateConsentProfile({
      ...completeProfile,
      dlState: '',
      address: '  ',
      zip: '',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('license state')
      expect(result.error).toContain('street address')
      expect(result.error).toContain('ZIP code')
    }
  })

  it('rejects a short license number and a short ZIP', () => {
    expect(validateConsentProfile({ ...completeProfile, dlNumber: 'AB' }).ok).toBe(false)
    expect(validateConsentProfile({ ...completeProfile, zip: '4411' }).ok).toBe(false)
  })
})


/**
 * Fluent stub for the guard's query chain:
 * from().select().eq().not().order().limit().maybeSingle()
 */
function supabaseWithLatestOrder(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  }
  return { from: vi.fn(() => chain) } as never
}

const DAY = 24 * 60 * 60 * 1000

describe('checkRecentDuplicateOrder', () => {
  it('allows when no active order exists', async () => {
    const supabase = supabaseWithLatestOrder({ data: null, error: null })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'psp' })
    expect(msg).toBeNull()
  })

  it('blocks while an order is pending', async () => {
    const supabase = supabaseWithLatestOrder({
      data: {
        id: 'o1',
        status: 'pending',
        ordered_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
      },
      error: null,
    })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'psp' })
    expect(msg).toContain('still processing')
  })

  it('blocks needs_review — the Ray Case duplicate path', async () => {
    const supabase = supabaseWithLatestOrder({
      data: {
        id: 'o1',
        status: 'needs_review',
        ordered_at: new Date(Date.now() - 2 * DAY).toISOString(),
        expires_at: new Date(Date.now() + 28 * DAY).toISOString(),
      },
      error: null,
    })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'psp' })
    expect(msg).toContain('already on file')
  })

  it('blocks a completed report for its full 30-day validity (not just 24h)', async () => {
    const supabase = supabaseWithLatestOrder({
      data: {
        id: 'o1',
        status: 'completed',
        ordered_at: new Date(Date.now() - 10 * DAY).toISOString(),
        expires_at: new Date(Date.now() + 20 * DAY).toISOString(),
      },
      error: null,
    })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'mvr' })
    expect(msg).toContain('valid for 30 days')
  })

  it('allows once the report is past expires_at, even before the cron flips it', async () => {
    const supabase = supabaseWithLatestOrder({
      data: {
        id: 'o1',
        status: 'completed',
        ordered_at: new Date(Date.now() - 40 * DAY).toISOString(),
        expires_at: new Date(Date.now() - 10 * DAY).toISOString(),
      },
      error: null,
    })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'mvr' })
    expect(msg).toBeNull()
  })

  it('fails CLOSED on a DB error — vendor spend beats UX', async () => {
    const supabase = supabaseWithLatestOrder({ data: null, error: { message: 'boom' } })
    const msg = await checkRecentDuplicateOrder(supabase, { driverUserId: 'drv-1', kind: 'psp' })
    expect(msg).toContain('try again')
  })
})
