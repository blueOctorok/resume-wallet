import { describe, expect, it } from 'vitest'
import { isActiveScreeningOrder } from '@/lib/driver-owned-screening'

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

describe('isActiveScreeningOrder', () => {
  it('treats in-flight and unexpired completed reports as active', () => {
    expect(isActiveScreeningOrder({ status: 'pending' })).toBe(true)
    expect(isActiveScreeningOrder({ status: 'processing' })).toBe(true)
    expect(isActiveScreeningOrder({ status: 'completed', expiresAt: future })).toBe(true)
    expect(isActiveScreeningOrder({ status: 'needs_review', expiresAt: future })).toBe(true)
    // No expiry date: a finished report still counts as on file.
    expect(isActiveScreeningOrder({ status: 'completed' })).toBe(true)
  })

  it('treats a finished report past expires_at as inactive', () => {
    expect(isActiveScreeningOrder({ status: 'completed', expiresAt: past })).toBe(false)
    expect(isActiveScreeningOrder({ status: 'needs_review', expiresAt: past })).toBe(false)
  })

  it('treats failed/cancelled/expired/superseded as inactive regardless of expiry', () => {
    expect(isActiveScreeningOrder({ status: 'failed', expiresAt: future })).toBe(false)
    expect(isActiveScreeningOrder({ status: 'cancelled', expiresAt: future })).toBe(false)
    expect(isActiveScreeningOrder({ status: 'expired', expiresAt: future })).toBe(false)
    // superseded = duplicate replaced by a newer order (migration 102 backfill)
    expect(isActiveScreeningOrder({ status: 'superseded', expiresAt: future })).toBe(false)
  })

  it('treats empty as inactive', () => {
    expect(isActiveScreeningOrder({ status: null })).toBe(false)
    expect(isActiveScreeningOrder({ status: '' })).toBe(false)
  })
})
