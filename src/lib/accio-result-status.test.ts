import { describe, it, expect } from 'vitest'
import { deriveScreeningStatus, outcomeLabel } from './accio-result-status'

describe('deriveScreeningStatus — Accio filledCode mapping', () => {
  it('maps filled + clear to completed/clear', () => {
    expect(
      deriveScreeningStatus({ filledStatus: 'filled', filledCode: 'clear' }),
    ).toEqual({ status: 'completed', outcome: 'clear' })
  })

  it('maps filled + hits to completed/hits', () => {
    expect(
      deriveScreeningStatus({ filledStatus: 'filled', filledCode: 'hits' }),
    ).toEqual({ status: 'completed', outcome: 'hits' })
  })

  it('maps filled + discrepancy to completed/discrepancy (Key MVR wording)', () => {
    expect(
      deriveScreeningStatus({ filledStatus: 'filled', filledCode: 'discrepancy' }),
    ).toEqual({ status: 'completed', outcome: 'discrepancy' })
    expect(outcomeLabel('discrepancy')).toBe('Discrepancy')
  })

  it('does not map unknown filledCode to needs_review when discrepancy is recognized', () => {
    const before = deriveScreeningStatus({
      filledStatus: 'filled',
      filledCode: 'not-a-real-code',
    })
    expect(before).toEqual({ status: 'needs_review', outcome: 'unknown' })
    expect(outcomeLabel('unknown')).toBe('Pending review')
  })
})
