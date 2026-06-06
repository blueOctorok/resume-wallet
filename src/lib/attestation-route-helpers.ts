import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Attestation, FactType } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function attestationFromRow(row: {
  id: string
  fact_type: string
  fact_summary: string
  disclosed_fields: Record<string, unknown> | null
  issued_at: string
  expires_at: string | null
  proof_artifact: Attestation['proof']
  candidate_user_id: string
  audience_id: string | null
}): Attestation {
  return {
    id: row.id,
    factType: row.fact_type as FactType,
    factSummary: row.fact_summary,
    disclosedFields: row.disclosed_fields ?? {},
    issuedAt: row.issued_at,
    expiresAt: row.expires_at ?? undefined,
    proof: row.proof_artifact,
  }
}

/**
 * Audience-scoped attestations are only served to the candidate or that company's
 * active members (DEC-2026-05-011 selective disclosure). Unscoped attestations
 * may be verified publicly (carrier verify page).
 */
export async function assertAttestationAudienceAccess(
  supabase: SupabaseClient,
  sessionUserId: string | null,
  candidateUserId: string,
  audienceId: string | null,
): Promise<NextResponse | null> {
  if (!audienceId) return null

  if (sessionUserId && sessionUserId === candidateUserId) {
    return null
  }

  if (!sessionUserId) {
    return NextResponse.json(
      { error: 'Authentication required for audience-scoped attestation' },
      { status: 401 },
    )
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', sessionUserId)
    .eq('company_id', audienceId)
    .eq('is_active', true)
    .maybeSingle()

  if (membership?.company_id) {
    return null
  }

  const { data: legacyCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('id', audienceId)
    .eq('employer_user_id', sessionUserId)
    .maybeSingle()

  if (legacyCompany?.id) {
    return null
  }

  return NextResponse.json(
    { error: 'Not authorized for this attestation audience' },
    { status: 403 },
  )
}

export function mapAttestationErrorToStatus(error: AttestationError): number {
  const msg = error.message.toLowerCase()
  if (msg.includes('provenance gate') || msg.includes('self-reported')) {
    return 403
  }
  if (msg.includes('unknown or unsupported fact')) {
    return 400
  }
  return 422
}
