import { describe, it, expect } from 'vitest'
import {
  buildMvrCleanViolationSlots,
  buildMvrCleanWitnessPayload,
  computeMvrCleanVerificationWindow,
  dateToYmdInt,
  hasViolationInWindow,
  assertMvrCleanPredicatePasses,
  MVR_CLEAN_MAX_VIOLATION_SLOTS,
  parseViolationDate,
} from '@/lib/mvr-clean-predicate'

describe('mvr-clean-predicate', () => {
  const anchor = new Date('2026-06-01T12:00:00.000Z')

  it('computes a 36-month window ending at the anchor', () => {
    const w = computeMvrCleanVerificationWindow(anchor)
    expect(w.windowEndYmd).toBe(dateToYmdInt(anchor))
    expect(w.windowStart.toISOString().slice(0, 10)).toBe('2023-06-01')
  })

  it('parses Accio YYYYMMDD violation dates', () => {
    expect(parseViolationDate('20240315')?.toISOString().slice(0, 10)).toBe('2024-03-15')
  })

  it('builds inactive slots for a clean record', () => {
    const slots = buildMvrCleanViolationSlots([])
    expect(slots).toHaveLength(MVR_CLEAN_MAX_VIOLATION_SLOTS)
    expect(slots.every((s) => !s.active)).toBe(true)
  })

  it('detects an in-window violation', () => {
    const payload = buildMvrCleanWitnessPayload({
      anchor,
      violations: [{ date: '20240315' }],
    })
    expect(hasViolationInWindow(payload.slots, payload.window)).toBe(true)
    expect(() => assertMvrCleanPredicatePasses(payload)).toThrow(/verification window/)
  })

  it('passes when violations are outside the window', () => {
    const payload = buildMvrCleanWitnessPayload({
      anchor,
      violations: [{ date: '20200101' }],
    })
    expect(hasViolationInWindow(payload.slots, payload.window)).toBe(false)
    expect(() => assertMvrCleanPredicatePasses(payload)).not.toThrow()
  })

  it('rejects when violation count exceeds circuit capacity', () => {
    const violations = Array.from({ length: MVR_CLEAN_MAX_VIOLATION_SLOTS + 1 }, (_, i) => ({
      date: `2020${String((i % 12) + 1).padStart(2, '0')}01`,
    }))
    expect(() => buildMvrCleanViolationSlots(violations)).toThrow(/exceeds circuit capacity/)
  })
})
