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

export function isPendingPspBundleRow(r: CandidateRequestScreeningRow): boolean {
  if (!isPendingScreeningStatus(r.status)) return false
  return (
    r.request_type === 'psp_order' ||
    (r.request_type === 'block_request' && r.target_block_type === 'driver-psp')
  )
}

export function isPendingMvrOnlyRow(r: CandidateRequestScreeningRow): boolean {
  if (!isPendingScreeningStatus(r.status)) return false
  return (
    r.request_type === 'mvr_order' ||
    (r.request_type === 'block_request' && r.target_block_type === 'driver-mvr')
  )
}

export type PickedPendingEmployerScreening = {
  requestId: string
  companyName: string
  mode: 'psp_mvr_bundle' | 'mvr_standalone'
}

/** Newest-first PSP+MVR bundle request, else newest standalone MVR employer request. */
export function pickPendingEmployerScreening(
  rows: CandidateRequestScreeningRow[],
): PickedPendingEmployerScreening | null {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const psp = sorted.find(isPendingPspBundleRow)
  if (psp) {
    return { requestId: psp.id, companyName: screeningCompanyName(psp), mode: 'psp_mvr_bundle' }
  }
  const mvr = sorted.find(isPendingMvrOnlyRow)
  if (mvr) {
    return { requestId: mvr.id, companyName: screeningCompanyName(mvr), mode: 'mvr_standalone' }
  }
  return null
}
