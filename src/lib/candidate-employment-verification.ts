/**
 * Candidate hub: merge employment rows from driver blocks, developer profile, and general resumes
 * so one optional "employment verification" flow can email past employers (date-focused, voluntary).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDriverEmployment, getDevProfile } from '@/lib/block-data'
import type { VerificationRequest } from '@/types/employment-verification'

export type CandidateEmploymentSource = 'driver' | 'developer' | 'general'

export interface CandidateEmploymentRow {
  verificationKey: string
  source: CandidateEmploymentSource
  sourceLabel: string
  id: string
  companyName: string
  position: string
  startDate: string
  endDate?: string | null
  location?: string
  supervisorName?: string
  supervisorEmail?: string
  supervisorPhone?: string
  reasonForLeaving?: string
}

export function compositeVerificationKey(
  source: CandidateEmploymentSource,
  rawId: string,
): string {
  return `${source}:${rawId}`
}

/** Legacy rows use raw UUID with applicant_type driver/developer — no prefix. */
export function parseVerificationEmploymentId(stored: string): {
  source: CandidateEmploymentSource
  rawId: string
} {
  const i = stored.indexOf(':')
  if (i <= 0) return { source: 'driver', rawId: stored }
  const prefix = stored.slice(0, i)
  const rawId = stored.slice(i + 1)
  if (prefix === 'developer' || prefix === 'general') {
    return { source: prefix, rawId }
  }
  return { source: 'driver', rawId: stored }
}

export function applicantTypeForSource(
  source: CandidateEmploymentSource,
): 'driver' | 'developer' | 'general' {
  return source
}

export async function fetchGeneralEmploymentsFromResumes(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEmploymentRow[]> {
  const { data: resumes } = await supabase
    .from('resumes')
    .select('structured_data')
    .eq('user_id', userId)
    .eq('source_role', 'general')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!resumes?.length) return []

  for (const resume of resumes) {
    const sd = resume.structured_data as {
      employments?: Array<{
        id: string
        companyName?: string
        position?: string
        startDate?: string
        endDate?: string
        isCurrent?: boolean
        location?: string
      }>
    } | null
    const em = sd?.employments
    if (!em?.length) continue
    return em.map((e) => ({
      verificationKey: compositeVerificationKey('general', e.id),
      source: 'general',
      sourceLabel: 'General resume',
      id: e.id,
      companyName: e.companyName ?? '',
      position: e.position ?? '',
      startDate: e.startDate ?? '',
      endDate: e.isCurrent ? '' : (e.endDate ?? ''),
      location: e.location ?? '',
    }))
  }
  return []
}

export async function getMergedCandidateEmployments(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEmploymentRow[]> {
  const [driverRows, devProfile, generalRows] = await Promise.all([
    getDriverEmployment(supabase, userId),
    getDevProfile(supabase, userId),
    fetchGeneralEmploymentsFromResumes(supabase, userId),
  ])

  const out: CandidateEmploymentRow[] = []

  for (const e of driverRows) {
    out.push({
      verificationKey: compositeVerificationKey('driver', e.id),
      source: 'driver',
      sourceLabel: 'Driver / DOT',
      id: e.id,
      companyName: e.companyName,
      position: e.position,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      supervisorName: e.supervisorName,
      supervisorEmail: e.supervisorEmail,
      supervisorPhone: e.supervisorPhone,
      reasonForLeaving: e.reasonForLeaving,
    })
  }

  const devHist = (devProfile?.employment_history as Array<Record<string, unknown>>) ?? []
  for (const e of devHist) {
    const id = String(e.id ?? '')
    if (!id) continue
    out.push({
      verificationKey: compositeVerificationKey('developer', id),
      source: 'developer',
      sourceLabel: 'Developer resume',
      id,
      companyName: String(e.companyName ?? ''),
      position: String(e.position ?? ''),
      startDate: String(e.startDate ?? ''),
      endDate: e.endDate != null ? String(e.endDate) : '',
      location: e.location != null ? String(e.location) : '',
      supervisorName: e.supervisorName != null ? String(e.supervisorName) : undefined,
      supervisorEmail: e.supervisorEmail != null ? String(e.supervisorEmail) : undefined,
      supervisorPhone: e.supervisorPhone != null ? String(e.supervisorPhone) : undefined,
      reasonForLeaving: e.reasonForLeaving != null ? String(e.reasonForLeaving) : undefined,
    })
  }

  out.push(...generalRows)
  return out
}

/** Match verification request to a merged employment row (supports legacy unprefixed employment_id). */
export function requestMatchesCandidateRow(
  r: VerificationRequest,
  row: CandidateEmploymentRow,
): boolean {
  if (r.initiatedBy !== 'applicant') return false
  if (r.employmentId === row.verificationKey) return true
  if (row.source === 'driver' && r.applicantType === 'driver' && r.employmentId === row.id) {
    return true
  }
  if (
    row.source === 'developer' &&
    r.applicantType === 'developer' &&
    r.employmentId === row.id
  ) {
    return true
  }
  if (row.source === 'general' && r.applicantType === 'general' && r.employmentId === row.id) {
    return true
  }
  return false
}

export function findApplicantVerificationForRow(
  requests: VerificationRequest[],
  row: CandidateEmploymentRow,
): VerificationRequest | undefined {
  return requests.find((r) => requestMatchesCandidateRow(r, row))
}
