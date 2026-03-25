/** Shared types + limits for job alerts (safe to import from client). */

export interface JobAlertPreferenceRow {
  id: string
  user_id: string
  label: string | null
  keywords: string
  location: string | null
  salary_min: number | null
  is_active: boolean
  min_match_score: number
  last_scan_at: string | null
  created_at: string
  updated_at: string
}

export const JOB_ALERTS_MAX_FREE = 2
export const JOB_ALERTS_MAX_WITH_CREDITS = 5
