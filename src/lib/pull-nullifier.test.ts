import { describe, expect, it } from 'vitest'
import { buildPullNullifier } from '@/lib/pull-nullifier'

describe('pull-nullifier', () => {
  it('is deterministic for the same pull id', () => {
    expect(buildPullNullifier('ACC-123')).toBe(buildPullNullifier('ACC-123'))
  })

  it('differs across pull ids', () => {
    expect(buildPullNullifier('ACC-1')).not.toBe(buildPullNullifier('ACC-2'))
  })
})
