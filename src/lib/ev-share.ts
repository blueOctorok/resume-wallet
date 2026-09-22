/**
 * Server-side helpers for the EV consent stack (docs/EV_CONSENT_STACK.md).
 *
 * Three artifacts, three hard gates:
 *  - ev_authorizations gate outbound routing (initiate-self)
 *  - ev_share_requests only create a pending state — never unlock view
 *  - ev_share_grants (driver Step 6) are the ONLY thing that unlocks employer
 *    view. Missing/revoked grant = 403, never soft-fail open.
 */

import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  serializeEvDocument,
  type EvConsentDocument,
  type EvDocumentSubstitutions,
} from '@/lib/ev-consent-documents'

/** sha256 snapshot of the exact document text shown (dynamic fields substituted). */
export function hashEvDocument(
  doc: EvConsentDocument,
  subs: EvDocumentSubstitutions = {},
): string {
  return createHash('sha256').update(serializeEvDocument(doc, subs), 'utf8').digest('hex')
}

/** IP + user-agent metadata captured server-side, as counsel directs. */
export function getRequestMeta(request: NextRequest): {
  ipAddress: string | null
  userAgent: string | null
} {
  const forwarded = request.headers.get('x-forwarded-for')
  return {
    ipAddress: forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  }
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export type EvShareRequestStatus = 'pending' | 'authorized' | 'declined' | 'revoked' | 'expired'
export type EvSharePayloadType = 'proof' | 'full'

export interface EvShareRequestRow {
  id: string
  company_id: string
  requesting_user_id: string
  driver_user_id: string
  application_context: string
  payload_type: EvSharePayloadType
  document_version: string
  status: EvShareRequestStatus
  certified_at: string
  created_at: string
}

export interface EvShareGrantRow {
  id: string
  share_request_id: string
  driver_user_id: string
  company_id: string
  payload_type: EvSharePayloadType
  ev_request_ids: string[]
  acknowledged_at: string
  revoked_at: string | null
}

/**
 * The proof summary — the ONLY EV payload employers get in v0.1.
 * Employer name, confirmed dates, DKIM status, response date.
 * Never the six FMCSA answers (that is `payload_type = 'full'`, disabled).
 */
export interface EvProofSummaryItem {
  evRequestId: string
  previousEmployerName: string
  claimedPosition: string
  confirmedStartDate: string | null
  confirmedEndDate: string | null
  dkimVerified: boolean
  dkimDomain: string | null
  respondedAt: string | null
  status: string
}

interface EvrRowForProof {
  id: string
  previous_employer_name: string
  claimed_position: string
  claimed_start_date: string | null
  claimed_end_date: string | null
  corrected_start_date: string | null
  corrected_end_date: string | null
  dates_correct: string | null
  dkim_valid: boolean | null
  dkim_domain: string | null
  verified_at: string | null
  status: string
}

export function buildEvProofSummary(rows: EvrRowForProof[]): EvProofSummaryItem[] {
  return rows.map((row) => ({
    evRequestId: row.id,
    previousEmployerName: row.previous_employer_name,
    claimedPosition: row.claimed_position,
    // Prefer employer-corrected dates when the reply adjusted them.
    confirmedStartDate:
      row.dates_correct === 'partial' && row.corrected_start_date
        ? row.corrected_start_date
        : row.claimed_start_date,
    confirmedEndDate:
      row.dates_correct === 'partial' && row.corrected_end_date
        ? row.corrected_end_date
        : row.claimed_end_date,
    dkimVerified: Boolean(row.dkim_valid),
    dkimDomain: row.dkim_domain ?? null,
    respondedAt: row.verified_at,
    status: row.status,
  }))
}

/**
 * The EVR rows a Step 6 grant may cover: driver-initiated packets that came
 * back verified and are not hidden by the driver.
 */
export async function getShareableEvRequests(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<EvrRowForProof[]> {
  const { data } = await supabase
    .from('employment_verification_requests')
    .select(
      'id, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, corrected_start_date, corrected_end_date, dates_correct, dkim_valid, dkim_domain, verified_at, status',
    )
    .eq('driver_id', driverUserId)
    .eq('initiated_by', 'applicant')
    .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
    .eq('driver_hidden', false)
  return (data ?? []) as EvrRowForProof[]
}

/**
 * Active (non-revoked) grant for a share request. This is the view gate:
 * callers must 403 when this returns null.
 */
export async function getActiveGrantForShareRequest(
  supabase: SupabaseClient,
  shareRequestId: string,
  companyId: string,
): Promise<EvShareGrantRow | null> {
  const { data } = await supabase
    .from('ev_share_grants')
    .select('*')
    .eq('share_request_id', shareRequestId)
    .eq('company_id', companyId)
    .is('revoked_at', null)
    .maybeSingle()
  return (data as EvShareGrantRow | null) ?? null
}

export async function logEvAccess(
  supabase: SupabaseClient,
  grant: EvShareGrantRow,
  viewerUserId: string,
): Promise<void> {
  await supabase.from('ev_access_log').insert({
    share_grant_id: grant.id,
    company_id: grant.company_id,
    viewer_user_id: viewerUserId,
  })
}
