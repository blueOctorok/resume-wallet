import { describe, it, expect } from 'vitest'
import {
  computeDriverCareerScore,
  gradeFromScore,
  type DriverCareerScoreInput,
} from './driver-career-score'

function baseInput(overrides?: Partial<DriverCareerScoreInput>): DriverCareerScoreInput {
  return {
    mvrLicenseStatus: 'Valid',
    mvrTotalPoints: 0,
    mvrViolationCount: 0,
    experienceYears: 5,
    hasVerifiedResume: true,
    dotComplete: true,
    endorsementCount: 2,
    hasProfessionalSummary: true,
    hasName: true,
    hasLocation: true,
    hasCdlInfo: true,
    employmentHistoryCount: 3,
    hasCdlClass: true,
    ...overrides,
  }
}

describe('gradeFromScore', () => {
  it('returns A for 90+', () => {
    expect(gradeFromScore(90)).toBe('A')
    expect(gradeFromScore(100)).toBe('A')
  })
  it('returns B for 80-89', () => {
    expect(gradeFromScore(80)).toBe('B')
    expect(gradeFromScore(89)).toBe('B')
  })
  it('returns C for 70-79', () => {
    expect(gradeFromScore(70)).toBe('C')
    expect(gradeFromScore(79)).toBe('C')
  })
  it('returns D for 60-69', () => {
    expect(gradeFromScore(60)).toBe('D')
    expect(gradeFromScore(69)).toBe('D')
  })
  it('returns F for <60', () => {
    expect(gradeFromScore(59)).toBe('F')
    expect(gradeFromScore(0)).toBe('F')
  })
})

describe('computeDriverCareerScore', () => {
  describe('MVR score', () => {
    it('gives 100 for clean record (valid, 0 violations, 0 points)', () => {
      const result = computeDriverCareerScore(
        baseInput({
          mvrLicenseStatus: 'Valid',
          mvrViolationCount: 0,
          mvrTotalPoints: 0,
        })
      )
      expect(result.breakdown.mvr.score).toBe(100)
      expect(result.breakdown.mvr.factors.cleanRecord).toBe(100)
    })
    it('gives lower score for valid license with violations', () => {
      const result = computeDriverCareerScore(
        baseInput({
          mvrLicenseStatus: 'Valid',
          mvrViolationCount: 2,
          mvrTotalPoints: 4,
        })
      )
      expect(result.breakdown.mvr.score).toBeLessThan(100)
      expect(result.breakdown.mvr.score).toBeGreaterThanOrEqual(40)
      expect(result.breakdown.mvr.factors.validWithViolations).toBeDefined()
    })
    it('gives 40 for invalid license status', () => {
      const result = computeDriverCareerScore(
        baseInput({ mvrLicenseStatus: 'Suspended' })
      )
      expect(result.breakdown.mvr.score).toBe(40)
    })
  })

  describe('Experience score', () => {
    it('years * 10, cap at 100', () => {
      expect(
        computeDriverCareerScore(baseInput({ experienceYears: 0 })).breakdown
          .experience.score
      ).toBe(0)
      expect(
        computeDriverCareerScore(baseInput({ experienceYears: 5 })).breakdown
          .experience.score
      ).toBe(50)
      expect(
        computeDriverCareerScore(baseInput({ experienceYears: 10 })).breakdown
          .experience.score
      ).toBe(100)
      expect(
        computeDriverCareerScore(baseInput({ experienceYears: 15 })).breakdown
          .experience.score
      ).toBe(100)
    })
  })

  describe('Credentials score', () => {
    it('resume (35) + DOT (35) + endorsements (10 each, max 30)', () => {
      const full = computeDriverCareerScore(
        baseInput({ hasVerifiedResume: true, dotComplete: true, endorsementCount: 3 })
      )
      expect(full.breakdown.credentials.score).toBe(100)

      const none = computeDriverCareerScore(
        baseInput({ hasVerifiedResume: false, dotComplete: false, endorsementCount: 0 })
      )
      expect(none.breakdown.credentials.score).toBe(0)

      const partial = computeDriverCareerScore(
        baseInput({ hasVerifiedResume: true, dotComplete: false, endorsementCount: 1 })
      )
      expect(partial.breakdown.credentials.score).toBe(45) // 35 + 0 + 10
    })
  })

  describe('Profile score', () => {
    it('name (20) + summary (20) + location (15) + CDL (25) + employment (5 each, max 20)', () => {
      const full = computeDriverCareerScore(
        baseInput({
          hasName: true,
          hasProfessionalSummary: true,
          hasLocation: true,
          hasCdlInfo: true,
          employmentHistoryCount: 4,
        })
      )
      expect(full.breakdown.profile.score).toBe(100)

      const empty = computeDriverCareerScore(
        baseInput({
          hasName: false,
          hasProfessionalSummary: false,
          hasLocation: false,
          hasCdlInfo: false,
          employmentHistoryCount: 0,
        })
      )
      expect(empty.breakdown.profile.score).toBe(0)
    })
  })

  describe('Overall score and grade', () => {
    it('weighted average produces expected score', () => {
      const result = computeDriverCareerScore(baseInput())
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade)
    })
    it('ideal driver gets A', () => {
      const result = computeDriverCareerScore(
        baseInput({
          mvrLicenseStatus: 'Valid',
          mvrViolationCount: 0,
          mvrTotalPoints: 0,
          experienceYears: 10,
          hasVerifiedResume: true,
          dotComplete: true,
          endorsementCount: 3,
          hasProfessionalSummary: true,
          hasName: true,
          hasLocation: true,
          hasCdlInfo: true,
          employmentHistoryCount: 4,
        })
      )
      expect(result.grade).toBe('A')
      expect(result.score).toBeGreaterThanOrEqual(90)
    })
    it('bare minimum driver gets F', () => {
      const result = computeDriverCareerScore(
        baseInput({
          mvrLicenseStatus: null,
          mvrViolationCount: 5,
          mvrTotalPoints: 10,
          experienceYears: 0,
          hasVerifiedResume: false,
          dotComplete: false,
          endorsementCount: 0,
          hasProfessionalSummary: false,
          hasName: false,
          hasLocation: false,
          hasCdlInfo: false,
          employmentHistoryCount: 0,
          hasCdlClass: false,
        })
      )
      expect(result.grade).toBe('F')
    })
  })

  describe('Suggestions', () => {
    it('suggests resume verification when missing', () => {
      const result = computeDriverCareerScore(
        baseInput({ hasVerifiedResume: false })
      )
      expect(result.suggestions).toContain(
        'Verify a resume on the blockchain to boost your score.'
      )
    })
    it('suggests DOT completion when incomplete', () => {
      const result = computeDriverCareerScore(baseInput({ dotComplete: false }))
      expect(result.suggestions).toContain(
        'Complete your DOT application for full credential verification.'
      )
    })
    it('suggests endorsements when CDL has none', () => {
      const result = computeDriverCareerScore(
        baseInput({ endorsementCount: 0, hasCdlClass: true })
      )
      expect(result.suggestions.some((s) => s.includes('endorsements'))).toBe(true)
    })
    it('suggests clean record when violations exist', () => {
      const result = computeDriverCareerScore(
        baseInput({ mvrViolationCount: 1 })
      )
      expect(result.suggestions.some((s) => s.includes('clean driving'))).toBe(true)
    })
    it('suggests professional summary when missing', () => {
      const result = computeDriverCareerScore(
        baseInput({ hasProfessionalSummary: false })
      )
      expect(result.suggestions).toContain(
        'Add a professional summary to your profile.'
      )
    })
  })

  describe('Result shape', () => {
    it('includes analyzedAt ISO timestamp', () => {
      const result = computeDriverCareerScore(baseInput())
      expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
    it('breakdown has all four categories with weight and factors', () => {
      const result = computeDriverCareerScore(baseInput())
      expect(result.breakdown.mvr).toMatchObject({
        score: expect.any(Number),
        weight: 0.3,
        factors: expect.any(Object),
      })
      expect(result.breakdown.experience.weight).toBe(0.25)
      expect(result.breakdown.credentials.weight).toBe(0.3)
      expect(result.breakdown.profile.weight).toBe(0.15)
    })
  })
})
