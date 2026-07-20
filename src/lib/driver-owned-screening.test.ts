import { describe, expect, it } from 'vitest'
import { isActiveScreeningOrderStatus } from '@/lib/driver-owned-screening'

describe('isActiveScreeningOrderStatus', () => {
  it('treats pending and completed as active', () => {
    expect(isActiveScreeningOrderStatus('pending')).toBe(true)
    expect(isActiveScreeningOrderStatus('processing')).toBe(true)
    expect(isActiveScreeningOrderStatus('completed')).toBe(true)
    expect(isActiveScreeningOrderStatus('needs_review')).toBe(true)
  })

  it('treats failed/cancelled/expired/superseded as inactive', () => {
    expect(isActiveScreeningOrderStatus('failed')).toBe(false)
    expect(isActiveScreeningOrderStatus('cancelled')).toBe(false)
    expect(isActiveScreeningOrderStatus('expired')).toBe(false)
    // superseded = duplicate replaced by a newer order (migration 102 backfill)
    expect(isActiveScreeningOrderStatus('superseded')).toBe(false)
  })

  it('treats empty as inactive', () => {
    expect(isActiveScreeningOrderStatus(null)).toBe(false)
    expect(isActiveScreeningOrderStatus('')).toBe(false)
  })
})
