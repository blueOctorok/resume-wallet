/**
 * Honest status labels for the DOT pre-screen packet (DEC-2026-07-001).
 *
 * Never treat DB `verification_status='VERIFIED'` or a legacy Base `blockchain_tx_hash`
 * as issuer verification of the whole self-reported application.
 */

import type { DotAppData } from '@/types/career-card'

export type DotAppHonestyStatus =
  | 'empty'
  | 'in_progress'
  | 'complete'
  | 'partially_verified'
  | 'majority_verified'

/** Derive display status from completeness + live coverage (not legacy VERIFIED flag). */
export function resolveDotAppHonestyStatus(
  data: Pick<
    DotAppData,
    'isComplete' | 'majorityVerified' | 'verifiedPercent' | 'verifiedTotalCount'
  > & {
    status?: string
  },
): DotAppHonestyStatus {
  if (data.majorityVerified) return 'majority_verified'
  if (
    typeof data.verifiedTotalCount === 'number' &&
    data.verifiedTotalCount > 0 &&
    typeof data.verifiedPercent === 'number' &&
    data.verifiedPercent > 0
  ) {
    return 'partially_verified'
  }
  if (data.isComplete) return 'complete'
  const raw = String(data.status || '').toUpperCase()
  // Legacy whole-app VERIFIED is a DB hash-seal — treat as submitted, not issuer-verified
  if (isLegacyWholeAppVerifiedFlag(raw) || raw === 'SUBMITTED' || raw === 'PENDING') {
    return data.isComplete ? 'complete' : 'in_progress'
  }
  if (!data.status || raw === 'EMPTY') return 'empty'
  return 'in_progress'
}

export function formatDotAppHonestyLabel(status: DotAppHonestyStatus): string {
  switch (status) {
    case 'majority_verified':
      return 'Verified pre-screen'
    case 'partially_verified':
      return 'Partially verified'
    case 'complete':
      return 'Submitted'
    case 'in_progress':
      return 'In progress'
    case 'empty':
    default:
      return 'Not started'
  }
}

/** True when a status string is the legacy whole-app VERIFIED flag (not field provenance). */
export function isLegacyWholeAppVerifiedFlag(status: string | null | undefined): boolean {
  return String(status || '').toUpperCase() === 'VERIFIED'
}
