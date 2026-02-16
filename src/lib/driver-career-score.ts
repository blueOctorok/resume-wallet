/**
 * Driver Career Score — pure computation (no DB, no AI).
 * Used by /api/ai/driver-career-score for the public Career Card.
 */

export interface DriverCareerScoreInput {
  /** MVR from profile */
  mvrLicenseStatus: string | null
  mvrTotalPoints: number | null
  mvrViolationCount: number | null
  /** Experience */
  experienceYears: number | null
  /** Credentials */
  hasVerifiedResume: boolean
  dotComplete: boolean
  endorsementCount: number
  /** Profile completeness */
  hasProfessionalSummary: boolean
  hasName: boolean
  hasLocation: boolean
  hasCdlInfo: boolean
  employmentHistoryCount: number
  /** For suggestions: does profile have CDL class? */
  hasCdlClass: boolean
}

export interface DriverCareerScoreResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    mvr: { score: number; weight: number; factors: Record<string, number> }
    experience: { score: number; weight: number; factors: Record<string, number> }
    credentials: { score: number; weight: number; factors: Record<string, number> }
    profile: { score: number; weight: number; factors: Record<string, number> }
  }
  suggestions: string[]
  analyzedAt: string
}

const WEIGHTS = {
  mvr: 0.3,
  experience: 0.25,
  credentials: 0.3,
  profile: 0.15,
} as const

export function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Compute driver career score from input data.
 * Pure function — no side effects.
 */
export function computeDriverCareerScore(
  input: DriverCareerScoreInput
): DriverCareerScoreResult {
  const licenseValid = input.mvrLicenseStatus === 'Valid'
  const violationCount = input.mvrViolationCount ?? 0
  const totalPoints = input.mvrTotalPoints ?? 0

  // MVR score
  let mvrScore = 50
  const mvrFactors: Record<string, number> = {}
  if (licenseValid && violationCount === 0 && totalPoints === 0) {
    mvrScore = 100
    mvrFactors.cleanRecord = 100
  } else if (licenseValid) {
    mvrScore = Math.max(40, 80 - violationCount * 10 - (totalPoints || 0) * 2)
    mvrFactors.validWithViolations = mvrScore
  } else {
    mvrScore = 40
    mvrFactors.status = 40
  }

  // Experience score: years * 10, cap 100 (10+ years = 100)
  const years = input.experienceYears ?? 0
  const experienceScore = Math.min(100, Math.round(years * 10))
  const experienceFactors: Record<string, number> = {
    yearsExperience: experienceScore,
  }

  // Credentials: resume (35) + DOT (35) + endorsements (up to 30)
  const credentialsScore = Math.min(
    100,
    (input.hasVerifiedResume ? 35 : 0) +
      (input.dotComplete ? 35 : 0) +
      Math.min(30, input.endorsementCount * 10)
  )
  const credentialsFactors: Record<string, number> = {
    resumeVerified: input.hasVerifiedResume ? 35 : 0,
    dotComplete: input.dotComplete ? 35 : 0,
    endorsements: Math.min(30, input.endorsementCount * 10),
  }

  // Profile completeness
  const profileScore = Math.min(
    100,
    (input.hasName ? 20 : 0) +
      (input.hasProfessionalSummary ? 20 : 0) +
      (input.hasLocation ? 15 : 0) +
      (input.hasCdlInfo ? 25 : 0) +
      Math.min(20, input.employmentHistoryCount * 5)
  )
  const profileFactors: Record<string, number> = {
    name: input.hasName ? 20 : 0,
    summary: input.hasProfessionalSummary ? 20 : 0,
    location: input.hasLocation ? 15 : 0,
    cdlInfo: input.hasCdlInfo ? 25 : 0,
    employmentHistory: Math.min(20, input.employmentHistoryCount * 5),
  }

  const rawScore =
    mvrScore * WEIGHTS.mvr +
    experienceScore * WEIGHTS.experience +
    credentialsScore * WEIGHTS.credentials +
    profileScore * WEIGHTS.profile
  const score = Math.min(100, Math.max(0, Math.round(rawScore)))

  const suggestions: string[] = []
  if (!input.hasVerifiedResume)
    suggestions.push('Verify a resume on the blockchain to boost your score.')
  if (!input.dotComplete)
    suggestions.push('Complete your DOT application for full credential verification.')
  if (
    input.endorsementCount === 0 &&
    input.hasCdlClass
  )
    suggestions.push(
      'Add CDL endorsements (Hazmat, Tanker, etc.) to stand out.'
    )
  if (violationCount > 0)
    suggestions.push(
      'Maintain a clean driving record to improve your MVR score over time.'
    )
  if (!input.hasProfessionalSummary)
    suggestions.push('Add a professional summary to your profile.')

  return {
    score,
    grade: gradeFromScore(score),
    breakdown: {
      mvr: { score: mvrScore, weight: WEIGHTS.mvr, factors: mvrFactors },
      experience: {
        score: experienceScore,
        weight: WEIGHTS.experience,
        factors: experienceFactors,
      },
      credentials: {
        score: credentialsScore,
        weight: WEIGHTS.credentials,
        factors: credentialsFactors,
      },
      profile: {
        score: profileScore,
        weight: WEIGHTS.profile,
        factors: profileFactors,
      },
    },
    suggestions,
    analyzedAt: new Date().toISOString(),
  }
}
