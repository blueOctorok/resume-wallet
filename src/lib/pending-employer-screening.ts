/**
 * Shared logic: which `candidate_requests` rows count as an active employer
 * screening the candidate must complete (matches `usePendingScreeningRequest`).
 */

export type CandidateRequestScreeningRow = {
  id: string
  request_type: string | null
  target_block_type: string | null
  status: string | null
  created_at: string
  company?: { company_name: string | null } | { company_name: string | null }[] | null
}

function screeningCompanyName(row: CandidateRequestScreeningRow): string {
  const c = row.company
  const obj = Array.isArray(c) ? c[0] : c
  return obj?.company_name?.trim() || 'An employer'
}

export function isPendingScreeningStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'viewed'
}

/** Any employer-driven screening consent pipeline (MVR ask, PSP ask, or explicit consent block). */
export function isEmployerScreeningConsentRequest(row: {
  request_type: string | null
  target_block_type: string | null
}): boolean {
  if (row.request_type === 'mvr_order' || row.request_type === 'psp_order') return true
  if (row.request_type !== 'block_request') return false
  const t = row.target_block_type
  return (
    t === 'driver-screening-consent' || t === 'driver-mvr' || t === 'driver-psp'
  )
}

export function isPendingEmployerScreeningConsentRow(r: CandidateRequestScreeningRow): boolean {
  if (!isPendingScreeningStatus(r.status)) return false
  return isEmployerScreeningConsentRequest(r)
}

export type PickedPendingEmployerScreening = {
  requestId: string
  companyName: string
  /** All employer screening asks now land on the screening-consent flow first. */
  mode: 'screening_consent'
}

/** Newest-first employer screening consent request (MVR / PSP / explicit consent block). */
export function pickPendingEmployerScreening(
  rows: CandidateRequestScreeningRow[],
): PickedPendingEmployerScreening | null {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const row = sorted.find(isPendingEmployerScreeningConsentRow)
  if (!row) return null
  return { requestId: row.id, companyName: screeningCompanyName(row), mode: 'screening_consent' }
}
