import { describe, expect, it, vi } from 'vitest'
import {
  employerCanAccessCandidateScreeningOrder,
  employerHasScreeningConsentWithCandidate,
} from '@/lib/employer-screening-order-access'

describe('employerCanAccessCandidateScreeningOrder', () => {
  it('allows company-paid orders for the paying company', async () => {
    const supabase = {} as never
    const ok = await employerCanAccessCandidateScreeningOrder(supabase, {
      companyId: 'co-1',
      candidateUserId: 'drv-1',
      order: { ordered_by_company_id: 'co-1' },
    })
    expect(ok).toBe(true)
  })

  it('denies another company’s private order', async () => {
    const supabase = {} as never
    const ok = await employerCanAccessCandidateScreeningOrder(supabase, {
      companyId: 'co-2',
      candidateUserId: 'drv-1',
      order: { ordered_by_company_id: 'co-1' },
    })
    expect(ok).toBe(false)
  })

  it('allows driver-owned when consent bundle exists', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: 'bundle-1' } })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never

    const ok = await employerCanAccessCandidateScreeningOrder(supabase, {
      companyId: 'co-1',
      candidateUserId: 'drv-1',
      order: { ordered_by_company_id: null },
    })
    expect(ok).toBe(true)
  })
})

describe('employerHasScreeningConsentWithCandidate', () => {
  it('returns false when no bundle row', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never

    expect(await employerHasScreeningConsentWithCandidate(supabase, 'co-1', 'drv-1')).toBe(false)
  })
})
