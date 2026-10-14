import { describe, expect, it } from 'vitest'
import { resolveCompanyDqFile, type ResolveCompanyDqInput } from '@/lib/dq-file-status'

const empty: ResolveCompanyDqInput = {
  mvrOrders: [],
  pspOrders: [],
  consentBundles: [],
  dotApplications: [],
  employmentVerifications: [],
}

function mvrStatus(input: ResolveCompanyDqInput) {
  return resolveCompanyDqFile(input).items.find((i) => i.id === 'mvr')
}

describe('mapOrderStatus via resolveCompanyDqFile', () => {
  it('treats an expired order that actually completed as complete and refresh-due', () => {
    const item = mvrStatus({
      ...empty,
      mvrOrders: [
        {
          id: 'o1',
          status: 'expired',
          completedAt: '2026-07-15T00:00:00Z',
          expiresAt: '2026-08-01T00:00:00Z',
        },
      ],
    })
    expect(item?.status).toBe('complete')
    expect(item?.refreshDue).toBe(true)
  })

  it('marks a completed report refresh-due only after expires_at', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const item = mvrStatus({
      ...empty,
      mvrOrders: [
        {
          id: 'o1',
          status: 'completed',
          completedAt: new Date().toISOString(),
          expiresAt: future,
        },
      ],
    })
    expect(item?.status).toBe('complete')
    expect(item?.refreshDue).toBe(false)
  })

  it('leaves a genuine expiry with no result as failed', () => {
    const item = mvrStatus({
      ...empty,
      mvrOrders: [{ id: 'o1', status: 'expired', completedAt: null }],
    })
    expect(item?.status).toBe('failed')
    expect(item?.refreshDue).toBe(false)
  })
})
