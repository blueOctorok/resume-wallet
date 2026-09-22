import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { createNotification } from '@/lib/create-notification'
import {
  EV_SHARE_ACK_VERSION,
  EV_SHARE_ACKNOWLEDGMENT,
} from '@/lib/ev-consent-documents'
import { getRequestMeta, getShareableEvRequests, hashEvDocument } from '@/lib/ev-share'

/**
 * POST /api/candidate/verification/share-requests/[id]/respond
 *
 * Driver Step 6 (PROVVEN-EV-SHARE-ACK-6-0.1).
 * Body: { action: 'authorize' | 'decline', checkboxEventId? }
 *
 * Authorize creates the ev_share_grants artifact — the ONLY thing that unlocks
 * the employer view endpoint. Decline leaves the employer with no content and
 * no re-ask (their pending request becomes declined).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id: shareRequestId } = await params

    const body = await request.json()
    const { action, checkboxEventId } = body as {
      action?: 'authorize' | 'decline'
      checkboxEventId?: string
    }
    if (action !== 'authorize' && action !== 'decline') {
      return NextResponse.json({ error: "action must be 'authorize' or 'decline'" }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: shareRequest } = await supabase
      .from('ev_share_requests')
      .select('id, company_id, requesting_user_id, driver_user_id, application_context, payload_type, status')
      .eq('id', shareRequestId)
      .maybeSingle()

    if (!shareRequest || shareRequest.driver_user_id !== userId) {
      return NextResponse.json({ error: 'Share request not found' }, { status: 404 })
    }
    if (shareRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `This request is already ${shareRequest.status}` },
        { status: 409 },
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', shareRequest.company_id)
      .single()
    const companyName = company?.company_name ?? 'the employer'

    if (action === 'decline') {
      await supabase
        .from('ev_share_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', shareRequestId)

      // Draft: optional employer notice — neutral copy, no content.
      await createNotification({
        userId: shareRequest.requesting_user_id,
        type: 'system',
        title: 'EV share request update',
        body: 'The driver has not authorized sharing Employment Verification material for your request.',
        data: { shareRequestId },
      })

      return NextResponse.json({ success: true, status: 'declined' })
    }

    // Authorize — the grant covers the driver's shareable EVR rows as of now.
    const shareable = await getShareableEvRequests(supabase, userId)
    if (shareable.length === 0) {
      return NextResponse.json(
        { error: 'No verified employment verification packets to share yet' },
        { status: 400 },
      )
    }

    const { ipAddress, userAgent } = getRequestMeta(request)
    const documentSha256 = hashEvDocument(EV_SHARE_ACKNOWLEDGMENT, {
      employerLegalName: companyName,
      payloadDescription: 'Proof summary only (default)',
    })

    const { data: grant, error: grantError } = await supabase
      .from('ev_share_grants')
      .insert({
        share_request_id: shareRequestId,
        driver_user_id: userId,
        company_id: shareRequest.company_id,
        document_version: EV_SHARE_ACK_VERSION,
        document_sha256: documentSha256,
        payload_type: shareRequest.payload_type,
        ev_request_ids: shareable.map((r) => r.id),
        ip_address: ipAddress,
        user_agent: userAgent,
        checkbox_event_id: checkboxEventId ?? null,
      })
      .select('id, acknowledged_at')
      .single()

    if (grantError) {
      console.error('[EV SHARE RESPOND] Grant insert error:', grantError.code, grantError.message)
      return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 })
    }

    await supabase
      .from('ev_share_requests')
      .update({ status: 'authorized', updated_at: new Date().toISOString() })
      .eq('id', shareRequestId)

    await createNotification({
      userId: shareRequest.requesting_user_id,
      type: 'consent_signed',
      title: 'Employment verification shared',
      body: `The driver authorized sharing their Employment Verification proof summary for: ${shareRequest.application_context}.`,
      data: { shareRequestId, grantId: grant.id },
    })

    console.log(`[EV SHARE RESPOND] Grant ${grant.id} for request ${shareRequestId}`)
    return NextResponse.json({ success: true, status: 'authorized', grantId: grant.id })
  } catch (error) {
    console.error('[EV SHARE RESPOND] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
