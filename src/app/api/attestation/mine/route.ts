import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { AttestationBadgeSummary } from '@/lib/dot-attestation-badge'
import type { ProofArtifact } from '@/lib/attestation-service'

/**
 * GET /api/attestation/mine
 *
 * Lightweight attestation summaries for candidate UI (DOT field badges).
 * Returns proof.kind only — never the raw JWT. Carrier verify still goes
 * through attestationService.verifyAttestation.
 */
function proofKindFromArtifact(artifact: unknown): string {
  if (!artifact || typeof artifact !== 'object') return 'signed_jwt'
  const kind = (artifact as ProofArtifact).kind
  return typeof kind === 'string' && kind.length > 0 ? kind : 'signed_jwt'
}

function txHashFromArtifact(artifact: unknown): string | null {
  if (!artifact || typeof artifact !== 'object') return null
  const a = artifact as ProofArtifact
  if (a.kind === 'midnight_zk' && typeof a.txHash === 'string') return a.txHash
  return null
}

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

    const attestations: AttestationBadgeSummary[] = (rows ?? []).map((row) => ({
      factType: row.fact_type as string,
      proofKind: proofKindFromArtifact(row.proof_artifact),
      sourceCra: (row.source_cra as string | null) ?? null,
      sourcePullId: (row.source_pull_id as string | null) ?? null,
      issuedAt: row.issued_at as string,
      txHash: txHashFromArtifact(row.proof_artifact),
    }))

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
