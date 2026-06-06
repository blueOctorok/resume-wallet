import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { attestationService } from '@/lib/attestation-service-registry'
import type { AttestationInput, FactType } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { getFactDefinition } from '@/lib/fact-registry'
import { isUuid, mapAttestationErrorToStatus } from '@/lib/attestation-route-helpers'

/**
 * POST /api/attestation/prove
 *
 * Candidate-initiated: session user may only prove facts about themselves.
 * Body: { factType, audienceId?, parameters? }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: {
      factType?: string
      audienceId?: string
      parameters?: Record<string, unknown>
      candidateUserId?: string
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { factType, audienceId, parameters, candidateUserId } = body

    // Reject cross-user prove attempts even if a client sends candidateUserId.
    if (candidateUserId && candidateUserId !== sessionUserId) {
      return NextResponse.json(
        { error: 'You may only prove facts about your own account' },
        { status: 403 },
      )
    }

    if (!factType || typeof factType !== 'string') {
      return NextResponse.json({ error: 'factType is required' }, { status: 400 })
    }

    if (!getFactDefinition(factType as FactType)) {
      return NextResponse.json({ error: `Unknown or unsupported fact type: ${factType}` }, { status: 400 })
    }

    if (audienceId !== undefined && audienceId !== null) {
      if (typeof audienceId !== 'string' || !isUuid(audienceId)) {
        return NextResponse.json({ error: 'audienceId must be a valid UUID' }, { status: 400 })
      }
    }

    const input: AttestationInput = {
      candidateUserId: sessionUserId,
      factType: factType as FactType,
      ...(audienceId ? { audienceId } : {}),
      ...(parameters && typeof parameters === 'object' ? { parameters } : {}),
    }

    const attestation = await attestationService.proveFact(input)

    return NextResponse.json({ success: true, attestation })
  } catch (error) {
    if (error instanceof AttestationError) {
      console.error('[ATTESTATION] prove failed:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: mapAttestationErrorToStatus(error) },
      )
    }

    console.error('[ATTESTATION] prove unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
