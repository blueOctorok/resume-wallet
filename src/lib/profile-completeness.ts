/**
 * Profile Completeness Calculator
 * Calculates a 0-100 score based on driver profile data
 * Used to guide drivers through profile completion and ensure quality applications
 */

export interface ProfileData {
  // Core Requirements (50 points total)
  cdl_class?: string | null
  cdl_state?: string | null
  cdl_number?: string | null
  cdl_endorsements?: string[] | null
  experience_years?: number | null
  
  // Resume & Application (30 points total)
  resume_id?: string | null
  resume_url?: string | null
  driver_application_id?: string | null
  dot_application_data?: any | null
  
  // MVR Verification (35 points total) - NEW
  mvr_result_id?: string | null
  mvr_order_id?: string | null
  mvr_expires_at?: string | null
  mvr_license_status?: string | null
  
  // Preferences & Details (20 points total)
  preferred_job_types?: string[] | null
  willing_to_relocate?: boolean | null
  desired_salary_min?: number | null
  preferred_states?: string[] | null
  available_start_date?: string | null
  total_miles_driven?: number | null
}

export interface ProfileCompletenessResult {
  score: number // 0-100
  percentage: string // "85%"
  status: 'incomplete' | 'basic' | 'good' | 'excellent'
  missingFields: {
    field: string
    label: string
    points: number
    category: 'core' | 'resume' | 'mvr' | 'preferences'
  }[]
  breakdown: {
    core: { earned: number; total: number }
    resume: { earned: number; total: number }
    mvr: { earned: number; total: number }
    preferences: { earned: number; total: number }
  }
}

/**
 * Calculate profile completeness score
 */
export function calculateProfileScore(profile: ProfileData): ProfileCompletenessResult {
  let score = 0
  const missingFields: ProfileCompletenessResult['missingFields'] = []
  
  // ============================================================
  // CORE REQUIREMENTS (50 points)
  // ============================================================
  const coreFields = [
    { key: 'cdl_class', label: 'CDL Class', points: 15 },
    { key: 'cdl_state', label: 'CDL State', points: 10 },
    { key: 'cdl_number', label: 'CDL Number', points: 10 },
    { key: 'cdl_endorsements', label: 'CDL Endorsements', points: 10 },
    { key: 'experience_years', label: 'Years of Experience', points: 5 },
  ]
  
  let coreEarned = 0
  for (const field of coreFields) {
    const value = profile[field.key as keyof ProfileData]
    if (value !== null && value !== undefined && value !== '') {
      // Special handling for arrays (endorsements)
      if (Array.isArray(value) && value.length > 0) {
        score += field.points
        coreEarned += field.points
      } else if (!Array.isArray(value)) {
        score += field.points
        coreEarned += field.points
      } else {
        missingFields.push({
          field: field.key,
          label: field.label,
          points: field.points,
          category: 'core'
        })
      }
    } else {
      missingFields.push({
        field: field.key,
        label: field.label,
        points: field.points,
        category: 'core'
      })
    }
  }
  
  // ============================================================
  // RESUME & APPLICATION (30 points)
  // ============================================================
  const resumeFields = [
    { key: 'resume_id', label: 'Resume Uploaded', points: 10 },
    { key: 'driver_application_id', label: 'DOT Application Completed', points: 15 },
    { key: 'total_miles_driven', label: 'Total Miles Driven', points: 5 },
  ]
  
  let resumeEarned = 0
  for (const field of resumeFields) {
    const value = profile[field.key as keyof ProfileData]
    if (value !== null && value !== undefined && value !== '') {
      score += field.points
      resumeEarned += field.points
    } else {
      missingFields.push({
        field: field.key,
        label: field.label,
        points: field.points,
        category: 'resume'
      })
    }
  }
  
  // ============================================================
  // MVR VERIFICATION (35 points) - NEW
  // ============================================================
  // MVR adds significant value to profile completeness
  // Valid MVR = verified license status, violations, accidents
  const mvrFields = [
    { key: 'mvr_result_id', label: 'MVR Verified', points: 20 },
    { key: 'mvr_license_status', label: 'License Status Verified', points: 10 },
    { key: 'mvr_expires_at', label: 'Current MVR (Not Expired)', points: 5 },
  ]
  
  let mvrEarned = 0
  for (const field of mvrFields) {
    const value = profile[field.key as keyof ProfileData]
    
    // Special handling for mvr_expires_at - check if not expired
    if (field.key === 'mvr_expires_at') {
      if (value) {
        const expiresAt = new Date(value as string)
        const now = new Date()
        if (expiresAt > now) {
          score += field.points
          mvrEarned += field.points
        } else {
          missingFields.push({
            field: field.key,
            label: 'MVR Expired - Order New MVR',
            points: field.points,
            category: 'mvr'
          })
        }
      } else {
        missingFields.push({
          field: field.key,
          label: field.label,
          points: field.points,
          category: 'mvr'
        })
      }
    } else if (value !== null && value !== undefined && value !== '') {
      score += field.points
      mvrEarned += field.points
    } else {
      missingFields.push({
        field: field.key,
        label: field.label,
        points: field.points,
        category: 'mvr'
      })
    }
  }
  
  // ============================================================
  // PREFERENCES & DETAILS (20 points)
  // ============================================================
  const preferenceFields = [
    { key: 'preferred_job_types', label: 'Preferred Job Types', points: 5 },
    { key: 'willing_to_relocate', label: 'Willing to Relocate', points: 2 },
    { key: 'desired_salary_min', label: 'Desired Salary', points: 5 },
    { key: 'preferred_states', label: 'Preferred States', points: 5 },
    { key: 'available_start_date', label: 'Available Start Date', points: 3 },
  ]
  
  let preferencesEarned = 0
  for (const field of preferenceFields) {
    const value = profile[field.key as keyof ProfileData]
    if (value !== null && value !== undefined) {
      // Special handling for arrays and booleans
      if (Array.isArray(value) && value.length > 0) {
        score += field.points
        preferencesEarned += field.points
      } else if (typeof value === 'boolean') {
        score += field.points
        preferencesEarned += field.points
      } else if (value !== '') {
        score += field.points
        preferencesEarned += field.points
      } else {
        missingFields.push({
          field: field.key,
          label: field.label,
          points: field.points,
          category: 'preferences'
        })
      }
    } else {
      missingFields.push({
        field: field.key,
        label: field.label,
        points: field.points,
        category: 'preferences'
      })
    }
  }
  
  // ============================================================
  // DETERMINE STATUS
  // ============================================================
  let status: ProfileCompletenessResult['status']
  if (score < 40) {
    status = 'incomplete'
  } else if (score < 70) {
    status = 'basic'
  } else if (score < 90) {
    status = 'good'
  } else {
    status = 'excellent'
  }
  
  return {
    score,
    percentage: `${score}%`,
    status,
    missingFields: missingFields.sort((a, b) => b.points - a.points), // Sort by importance
    breakdown: {
      core: { earned: coreEarned, total: 50 },
      resume: { earned: resumeEarned, total: 30 },
      mvr: { earned: mvrEarned, total: 35 },
      preferences: { earned: preferencesEarned, total: 20 }
    }
  }
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(status: ProfileCompletenessResult['status']): string {
  switch (status) {
    case 'incomplete':
      return 'Your profile needs more information before you can apply to jobs.'
    case 'basic':
      return 'Your profile has the basics. Add more details to stand out!'
    case 'good':
      return 'Your profile looks great! Complete a few more fields to maximize your chances.'
    case 'excellent':
      return 'Your profile is complete! Employers will love your detailed application.'
  }
}

/**
 * Get color for status
 */
export function getStatusColor(status: ProfileCompletenessResult['status']): {
  bg: string
  text: string
  border: string
} {
  switch (status) {
    case 'incomplete':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800'
      }
    case 'basic':
      return {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800'
      }
    case 'good':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800'
      }
    case 'excellent':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800'
      }
  }
}

/**
 * Check if profile meets minimum requirements for applying to jobs
 */
export function canApplyToJobs(profile: ProfileData): {
  canApply: boolean
  reason?: string
  missingCritical: string[]
} {
  const critical: (keyof ProfileData)[] = ['cdl_class', 'cdl_state']
  const missingCritical: string[] = []
  
  for (const field of critical) {
    const value = profile[field]
    if (value === null || value === undefined || value === '') {
      missingCritical.push(field)
    }
  }
  
  if (missingCritical.length > 0) {
    return {
      canApply: false,
      reason: 'Your profile is missing critical information required for job applications.',
      missingCritical
    }
  }
  
  return {
    canApply: true,
    missingCritical: []
  }
}

