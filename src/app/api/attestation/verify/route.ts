import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { attestationService } from '@/lib/attestation-service-registry'
import type { Attestation } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import {
  assertAttestationAudienceAccess,
  attestationFromRow,
  isUuid,
} from '@/lib/attestation-route-helpers'
import {
  attestationDisplayFromProof,
  formatAttestationVerificationLine,
  formatAttestationVerifyDetails,
} from '@/lib/attestation-fact-ui'

/**
 * POST /api/attestation/verify
 *
 * Independently verifies an attestation (signed JWT in Phase 2).
 * Body: { attestation } or { id } — query_count is incremented by the service.
 *
 * Audience-scoped rows require the candidate or that company's employer session.
 * Unscoped attestations may be verified without auth (public verify page).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)

    let body: { attestation?: Attestation; id?: string }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    let attestation: Attestation | null = null
    let candidateUserId: string | null = null
    let audienceId: string | null = null
    let sourceCra: string | null = null
    let sourcePullId: string | null = null

    if (body.id) {
      if (typeof body.id !== 'string' || !isUuid(body.id)) {
        return NextResponse.json({ error: 'id must be a valid UUID' }, { status: 400 })
      }

      const { data: row, error: rowError } = await supabase
        .from('attestations')
        .select(
          'id, candidate_user_id, fact_type, fact_summary, disclosed_fields, issued_at, expires_at, proof_artifact, audience_id, source_cra, source_pull_id',
        )
        .eq('id', body.id)
        .maybeSingle()

      if (rowError) {
        console.error('[ATTESTATION] verify load error:', rowError.message)
        return NextResponse.json({ error: 'Failed to load attestation' }, { status: 500 })
      }

      if (!row) {
        return NextResponse.json({ error: 'Attestation not found' }, { status: 404 })
      }

      candidateUserId = row.candidate_user_id as string
      audienceId = (row.audience_id as string | null) ?? null
      sourceCra = (row.source_cra as string | null) ?? null
      sourcePullId = (row.source_pull_id as string | null) ?? null
      attestation = attestationFromRow(row)
    } else if (body.attestation && typeof body.attestation === 'object') {
      attestation = body.attestation

      if (!attestation.id || !isUuid(attestation.id)) {
        return NextResponse.json({ error: 'attestation.id must be a valid UUID' }, { status: 400 })
      }

      const { data: row } = await supabase
        .from('attestations')
        .select('candidate_user_id, audience_id')
        .eq('id', attestation.id)
        .maybeSingle()

      if (row) {
        candidateUserId = row.candidate_user_id as string
        audienceId = (row.audience_id as string | null) ?? null
      }
    } else {
      return NextResponse.json(
        { error: 'Provide attestation or id in the request body' },
        { status: 400 },
      )
    }

    if (candidateUserId) {
      const accessDenied = await assertAttestationAudienceAccess(
        supabase,
        sessionUserId,
        candidateUserId,
        audienceId,
      )
      if (accessDenied) return accessDenied
    }

    const result = await attestationService.verifyAttestation(attestation)

    const display = attestationDisplayFromProof(
      attestation.issuedAt,
      sourceCra,
      sourcePullId,
      attestation.proof,
    )

    return NextResponse.json({
      success: true,
      verification: result,
      display: {
        verificationLine: formatAttestationVerificationLine(display),
        technicalDetails: formatAttestationVerifyDetails(display),
      },
    })
  } catch (error) {
    if (error instanceof AttestationError) {
      console.error('[ATTESTATION] verify failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[ATTESTATION] verify unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
