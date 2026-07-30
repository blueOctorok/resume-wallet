import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { AttestationBadgeSummary } from '@/lib/dot-attestation-badge'
import {
  midnightFieldsFromArtifact,
  proofKindFromArtifact,
} from '@/lib/attestation-proof-display'

/**
 * GET /api/attestation/mine
 *
 * Lightweight attestation summaries for candidate UI (DOT field badges).
 * Returns proof.kind only — never the raw JWT. Carrier verify still goes
 * through attestationService.verifyAttestation.
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: rows, error } = await supabase
      .from('attestations')
      .select(
        'id, fact_type, issued_at, source_cra, source_pull_id, proof_artifact',
      )
      .eq('candidate_user_id', userId)
      .is('superseded_by', null)
      .order('issued_at', { ascending: false })

    if (error) {
      console.error('[ATTESTATION MINE] Query error:', error)
      return NextResponse.json({ error: 'Failed to load attestations' }, { status: 500 })
    }

    const attestations: AttestationBadgeSummary[] = (rows ?? []).map((row) => {
      const midnight = midnightFieldsFromArtifact(row.proof_artifact)
      return {
        factType: row.fact_type as string,
        proofKind: proofKindFromArtifact(row.proof_artifact),
        provenanceTier: midnight.provenanceTier,
        sourceCra: (row.source_cra as string | null) ?? null,
        sourcePullId: (row.source_pull_id as string | null) ?? null,
        issuedAt: row.issued_at as string,
        txHash: midnight.txHash,
        proofId: midnight.proofId,
      }
    })

    return NextResponse.json({ attestations })
  } catch (err: unknown) {
    console.error('[ATTESTATION MINE] Error:', err)
    return NextResponse.json(
      {
        error: 'Failed to load attestations',
        details: err instanceof Error ? err.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
