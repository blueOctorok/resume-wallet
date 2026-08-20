import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendSms } from '@/lib/messaging'
import { buildCandidateInviteSmsBody } from '@/lib/invite-sms-body'
import { normalizeToE164 } from '@/lib/phone-e164'
import { getBlockDefinition } from '@/lib/block-registry'
import { createNotification } from '@/lib/create-notification'
import { getAppBaseUrl } from '@/lib/app-url'

/**
 * POST /api/employer/invites/send-sms
 * Send an application invite via Pingram SMS.
 *
 * Body:
 *   inviteId - The invite to send
 *   phone - Override phone (optional, uses invite.candidate_phone if not provided)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
        .single()
      companyId = legacyCompany?.id
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const body = await request.json()
    const { inviteId, phone: overridePhone } = body as {
      inviteId?: string
      phone?: string
    }

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
    }

    const { data: invite, error: inviteError } = await supabase
      .from('application_invites')
      .select(`
        id, token, candidate_phone, candidate_name, candidate_user_id, welcome_message,
        status, type, target_block_type, job_posting_id,
        companies(id, company_name),
        job_postings(id, title)
      `)
      .eq('id', inviteId)
      .eq('company_id', companyId)
      .single()

    if (inviteError || !invite) {
      console.error('[SEND INVITE SMS] Invite fetch error:', inviteError)
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const rawPhone = (overridePhone || invite.candidate_phone || '').trim()
    if (!rawPhone) {
      return NextResponse.json(
        {
          error: 'No phone number. Provide a phone or update the invite with candidate phone.',
        },
        { status: 400 },
      )
    }

    const recipientPhone = normalizeToE164(rawPhone)
    if (!recipientPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use a US 10-digit number or E.164 (+1…).' },
        { status: 400 },
      )
    }

    if (invite.status === 'completed' || invite.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot send SMS for ${invite.status} invite` },
        { status: 400 },
      )
    }

    const company = invite.companies as { company_name?: string } | null
    const job = invite.job_postings as { title?: string } | null
    const baseUrl = getAppBaseUrl(request)
    const inviteLink = `${baseUrl}/apply/${invite.token}`
    const targetBlockType = (invite as { target_block_type?: string | null }).target_block_type || null

    const message = buildCandidateInviteSmsBody({
      companyName: company?.company_name || 'Employer',
      inviteUrl: inviteLink,
      targetBlockType,
      candidateName: invite.candidate_name,
      jobTitle: job?.title || null,
    })

    const result = await sendSms({
      type: 'invite_sms',
      to: recipientPhone,
      message,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to send SMS' },
        { status: 500 },
      )
    }

    await supabase
      .from('application_invites')
      .update({
        candidate_phone: recipientPhone,
        sms_sent_at: new Date().toISOString(),
      })
      .eq('id', inviteId)

    const candidateUserId = (invite as { candidate_user_id?: string | null }).candidate_user_id
    if (candidateUserId) {
      const blockDef = targetBlockType ? getBlockDefinition(targetBlockType) : null
      const inviteLabel = blockDef ? `${blockDef.label} Invite` : 'Provven Invite'
      const companyDisplayName = company?.company_name || 'An employer'

      createNotification({
        userId: candidateUserId,
        type: 'candidate_request',
        title: `${companyDisplayName} invited you`,
        body: `You've been invited to complete a ${inviteLabel}${job?.title ? ` for ${job.title}` : ''}.`,
        data: {
          inviteId,
          companyName: companyDisplayName,
          targetBlockType,
          jobTitle: job?.title ?? null,
          channel: 'sms',
        },
        actionUrl: inviteLink,
      }).catch((err) => console.error('[SEND INVITE SMS] Notification error:', err))
    }

    return NextResponse.json({
      success: true,
      message: `Invite SMS sent to ${recipientPhone}`,
      sentTo: recipientPhone,
      notified: !!candidateUserId,
    })
  } catch (error) {
    console.error('[SEND INVITE SMS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
