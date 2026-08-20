import { describe, expect, it } from 'vitest'
import {
  buildDqActionSteps,
  heuristicDqReview,
  mergeDqReviews,
  personNamesConflict,
  PROFILE_MVR_NAME_FLAG,
  type DqCoachReview,
  type DqCoachSnapshot,
} from './dq-coach'
import { collectDiscrepancyFlags, normalizeLicenseClass } from './dq-coach-compare'
import { hashDqCoachSnapshot } from './dq-coach-hash'

function snapshot(partial: Partial<DqCoachSnapshot> = {}): DqCoachSnapshot {
  return {
    profile: {
      name: 'Barry Burton',
      city: 'Cleveland',
      state: 'OH',
      dateOfBirth: '1982-09-18',
      phone: '(216) 314-6034',
      hasPhone: true,
      hasEmail: true,
      ...partial.profile,
    },
    blocks: [],
    dqItems: [],
    cdl: null,
    mvr: {
      licenseStatus: 'valid',
      points: 0,
      violationCount: 0,
      lastOrderedAt: '2026-08-20',
      subjectName: 'Sam Blaha',
      dateOfBirth: '1982-09-18',
      phone: '(216) 314-6034',
      city: 'Westlake',
      state: 'OH',
      licenseNumber: 'RZ273847',
      licenseState: 'OH',
      licenseClass: 'A',
      licenseExpiration: '2028-01-01',
      hasDiscrepancyAlert: false,
      accidents: [],
      convictions: [],
      ...partial.mvr,
    },
    psp: null,
    dot: null,
    employment: [],
    ...partial,
  }
}

describe('personNamesConflict', () => {
  it('flags Barry Burton vs Sam Blaha', () => {
    expect(personNamesConflict('Barry Burton', 'Sam Blaha')).toBe(true)
  })

  it('allows Sam vs Samuel with the same last name', () => {
    expect(personNamesConflict('Sam Blaha', 'Samuel Blaha')).toBe(false)
  })

  it('allows a Jr suffix', () => {
    expect(personNamesConflict('Sam Blaha', 'Sam Blaha Jr')).toBe(false)
  })

  it('skips single-token names', () => {
    expect(personNamesConflict('Barry', 'Sam Blaha')).toBe(false)
  })
})

describe('normalizeLicenseClass', () => {
  it('treats Class A / CDL-A / A as the same', () => {
    expect(normalizeLicenseClass('Class A')).toBe('A')
    expect(normalizeLicenseClass('CDL-A')).toBe('A')
    expect(normalizeLicenseClass('A')).toBe('A')
  })
})

describe('heuristicDqReview discrepancies', () => {
  it('puts profile vs MVR next and a warn flag', () => {
    const review = heuristicDqReview(snapshot())
    expect(review.next?.target).toBe('profile')
    expect(review.next?.title).toMatch(/does not match your MVR/i)
    expect(review.flags.some((f) => f.title === PROFILE_MVR_NAME_FLAG)).toBe(true)
    expect(review.flags[0]?.detail).toContain('Barry Burton')
    expect(review.flags[0]?.detail).toContain('Sam Blaha')
  })

  it('does not flag matching names', () => {
    const review = heuristicDqReview(
      snapshot({
        profile: {
          name: 'Sam Blaha',
          city: null,
          state: 'OH',
          dateOfBirth: '1982-09-18',
          phone: '(216) 314-6034',
          hasPhone: true,
          hasEmail: true,
        },
        mvr: {
          licenseStatus: 'valid',
          points: 0,
          violationCount: 0,
          lastOrderedAt: '2026-08-20',
          subjectName: 'Samuel Blaha',
          dateOfBirth: '1982-09-18',
          phone: '(216) 314-6034',
          city: null,
          state: 'OH',
          licenseNumber: 'RZ273847',
          licenseState: 'OH',
          licenseClass: 'A',
          licenseExpiration: null,
          hasDiscrepancyAlert: false,
          accidents: [],
          convictions: [],
        },
      }),
    )
    expect(review.flags.some((f) => f.title === PROFILE_MVR_NAME_FLAG)).toBe(false)
  })

  it('does not treat an unstarted DOT as a name mismatch', () => {
    const flags = collectDiscrepancyFlags(
      snapshot({
        profile: {
          name: 'Sam Blaha',
          city: null,
          state: 'OH',
          dateOfBirth: null,
          phone: null,
          hasPhone: false,
          hasEmail: true,
        },
        mvr: {
          licenseStatus: 'valid',
          points: 0,
          violationCount: 1,
          lastOrderedAt: '2026-08-20',
          subjectName: 'Sam Blaha',
          dateOfBirth: '1982-09-18',
          phone: '(216) 314-6034',
          city: null,
          state: 'OH',
          licenseNumber: 'RZ273847',
          licenseState: 'OH',
          licenseClass: 'A',
          licenseExpiration: null,
          hasDiscrepancyAlert: false,
          accidents: [{ date: '2023-04-01', nature: 'rear end' }],
          convictions: [],
        },
        dot: null,
      }),
    )
    expect(flags.some((f) => f.title === 'DOT name vs MVR')).toBe(false)
    expect(flags.some((f) => f.title === 'MVR accidents missing on DOT')).toBe(false)
  })

  it('flags MVR accidents when Form 2 says none', () => {
    const flags = collectDiscrepancyFlags(
      snapshot({
        profile: {
          name: 'Sam Blaha',
          city: null,
          state: 'OH',
          dateOfBirth: '1982-09-18',
          phone: null,
          hasPhone: false,
          hasEmail: true,
        },
        mvr: {
          licenseStatus: 'valid',
          points: 0,
          violationCount: 0,
          lastOrderedAt: '2026-08-20',
          subjectName: 'Sam Blaha',
          dateOfBirth: '1982-09-18',
          phone: null,
          city: null,
          state: 'OH',
          licenseNumber: 'RZ273847',
          licenseState: 'OH',
          licenseClass: 'A',
          licenseExpiration: null,
          hasDiscrepancyAlert: false,
          accidents: [{ date: '2023-04-01', nature: 'rear end' }],
          convictions: [],
        },
        dot: {
          started: true,
          complete: false,
          name: 'Sam Blaha',
          dateOfBirth: '1982-09-18',
          phone: null,
          city: null,
          state: 'OH',
          licenseNumber: 'RZ273847',
          licenseState: 'OH',
          licenseClass: 'A',
          licenseExpiration: null,
          accidentDates: [],
          convictionDates: [],
          hasNoAccidents: true,
          hasNoConvictions: true,
        },
      }),
    )
    expect(flags.some((f) => f.title === 'MVR accidents missing on DOT')).toBe(true)
  })

  it('keeps the mismatch as Next when the model suggests something else', () => {
    const base = heuristicDqReview(snapshot())
    const extra: DqCoachReview = {
      watching: 'Looks complete.',
      next: { title: 'Add PSP', detail: 'Missing.', target: 'psp' },
      flags: [],
    }
    const merged = mergeDqReviews(base, extra)
    expect(merged.next?.target).toBe('profile')
    expect(merged.flags.some((f) => f.title === PROFILE_MVR_NAME_FLAG)).toBe(true)
  })

  it('builds one clickable step per target, next first', () => {
    const review = heuristicDqReview(snapshot())
    const steps = buildDqActionSteps(review)
    expect(steps[0]?.target).toBe('profile')
    expect(steps[0]?.title).toMatch(/does not match your MVR/i)
    expect(new Set(steps.map((s) => s.target)).size).toBe(steps.length)
    expect(steps.length).toBeLessThanOrEqual(6)
  })
})

describe('hashDqCoachSnapshot', () => {
  it('is stable when key order differs', () => {
    const a = snapshot()
    const b = snapshot()
    expect(hashDqCoachSnapshot(a)).toBe(hashDqCoachSnapshot(b))
  })

  it('changes when a compared field changes', () => {
    const a = snapshot()
    const b = snapshot({ profile: { ...snapshot().profile, name: 'Sam Blaha' } })
    expect(hashDqCoachSnapshot(a)).not.toBe(hashDqCoachSnapshot(b))
  })
})
