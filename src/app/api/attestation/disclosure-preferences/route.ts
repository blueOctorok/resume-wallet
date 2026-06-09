import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { AttestationError } from '@/lib/attestation-service'
import {
  buildDisclosurePreferencesPayload,
  listCandidateDisclosureAudiences,
  setDisclosurePreference,
} from '@/lib/disclosure-preferences'
import { getFactDefinition, listShippedFacts, type ShippedFactType } from '@/lib/fact-registry'
import { isUuid, mapAttestationErrorToStatus } from '@/lib/attestation-route-helpers'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/attestation/disclosure-preferences
 *
 * Candidate-only: audiences the candidate has interacted with + per-fact toggle state.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const audiences = await buildDisclosurePreferencesPayload(supabase, sessionUserId)
    const factTypes = listShippedFacts().map((def) => ({
      factType: def.factType,
      label: def.label,
      description: def.description,
      category: def.category,
    }))

    return NextResponse.json({ success: true, audiences, factTypes })
  } catch (error) {
    if (error instanceof AttestationError) {
      console.error('[DISCLOSURE] GET failed:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: mapAttestationErrorToStatus(error) },
      )
    }

    console.error('[DISCLOSURE] GET unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/attestation/disclosure-preferences
 *
 * Body: { audienceId, factType, allowed }
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: { audienceId?: string; factType?: string; allowed?: boolean }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { audienceId, factType, allowed } = body

    if (!audienceId || typeof audienceId !== 'string' || !isUuid(audienceId)) {
      return NextResponse.json({ error: 'audienceId must be a valid UUID' }, { status: 400 })
    }

    if (!factType || typeof factType !== 'string') {
      return NextResponse.json({ error: 'factType is required' }, { status: 400 })
    }

    if (!getFactDefinition(factType as ShippedFactType)) {
      return NextResponse.json({ error: `Unknown or unsupported fact type: ${factType}` }, { status: 400 })
    }

    if (typeof allowed !== 'boolean') {
      return NextResponse.json({ error: 'allowed must be a boolean' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const audiences = await listCandidateDisclosureAudiences(supabase, sessionUserId)
    if (!audiences.some((a) => a.companyId === audienceId)) {
      return NextResponse.json(
        { error: 'You can only manage sharing for employers you have interacted with' },
        { status: 403 },
      )
    }

    await setDisclosurePreference(
      supabase,
      sessionUserId,
      audienceId,
      factType as ShippedFactType,
      allowed,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AttestationError) {
      console.error('[DISCLOSURE] PATCH failed:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: mapAttestationErrorToStatus(error) },
      )
    }

    console.error('[DISCLOSURE] PATCH unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
