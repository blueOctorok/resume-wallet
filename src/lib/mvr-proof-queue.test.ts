import { describe, expect, it } from 'vitest'
import { nextUnprovedDriver, type ProofQueueOrder } from '@/lib/mvr-proof-queue'

const orders: ProofQueueOrder[] = [
  { userId: 'older', completedAt: '2026-09-01T00:00:00Z', licenseClass: 'A' },
  { userId: 'newest', completedAt: '2026-10-01T00:00:00Z', licenseClass: 'B' },
  { userId: 'no-class', completedAt: '2026-10-02T00:00:00Z', licenseClass: null },
  { userId: 'proved', completedAt: '2026-10-03T00:00:00Z', licenseClass: 'A' },
]

describe('nextUnprovedDriver', () => {
  it('picks the newest parsed class that is not already proved', () => {
    expect(nextUnprovedDriver(orders, new Set(['proved']), new Set())).toBe('newest')
  })

  it('skips a driver that just failed', () => {
    expect(nextUnprovedDriver(orders, new Set(['proved']), new Set(['newest']))).toBe('older')
  })

  it('returns null when every parsed class is proved or cooling down', () => {
    expect(
      nextUnprovedDriver(orders, new Set(['proved', 'newest', 'older']), new Set()),
    ).toBeNull()
  })
})
