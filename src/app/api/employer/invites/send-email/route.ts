import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendInviteEmail } from '@/lib/send-invite-email'
import { getBlockDefinition } from '@/lib/block-registry'
import { createNotification } from '@/lib/create-notification'

/**
 * POST /api/employer/invites/send-email
 * Send an application invite via email
 * 
 * Body:
 *   inviteId - The invite to send
 *   email - Override email (optional, uses invite.candidate_email if not provided)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get user's company
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
    const { inviteId, email: overrideEmail } = body

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
    }

    // Fetch invite with company and job info
    const { data: invite, error: inviteError } = await supabase
      .from('application_invites')
      .select(`
        id, token, candidate_email, candidate_name, candidate_user_id, welcome_message,
        status, type, target_block_type, job_posting_id,
        companies(id, company_name),
        job_postings(id, title)
      `)
      .eq('id', inviteId)
      .eq('company_id', companyId)
      .single()

    if (inviteError || !invite) {
      console.error('[SEND INVITE EMAIL] Invite fetch error:', inviteError)
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Determine email address
    const recipientEmail = overrideEmail || invite.candidate_email
    if (!recipientEmail) {
      return NextResponse.json({ 
        error: 'No email address. Provide an email or update the invite with candidate email.' 
      }, { status: 400 })
    }

    // Check invite is still sendable
    if (invite.status === 'completed' || invite.status === 'cancelled') {
      return NextResponse.json({ 
        error: `Cannot send email for ${invite.status} invite` 
      }, { status: 400 })
    }

    const company = invite.companies as any
    const job = invite.job_postings as any
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Send the email
    const result = await sendInviteEmail({
      to: recipientEmail,
      targetBlockType: (invite as any).target_block_type || null,
      candidateName: invite.candidate_name || undefined,
      companyName: company?.company_name || 'Employer',
      jobTitle: job?.title || undefined,
      inviteLink: `${baseUrl}/apply/${invite.token}`,
      welcomeMessage: invite.welcome_message || undefined,
    })

    if (!result.ok) {
      return NextResponse.json({ 
        error: result.error || 'Failed to send email' 
      }, { status: 500 })
    }

    // Update invite to track that email was sent
    await supabase
      .from('application_invites')
      .update({ 
        candidate_email: recipientEmail,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', inviteId)

    // If this invite is linked to an existing Storm profile, also create
    // an in-app notification so they see it in the notification bell immediately.
    const candidateUserId = (invite as { candidate_user_id?: string | null }).candidate_user_id
    if (candidateUserId) {
      const targetBlock = (invite as any).target_block_type as string | null
      const blockDef = targetBlock ? getBlockDefinition(targetBlock) : null
      const inviteLabel = blockDef ? `${blockDef.label} Invite` : 'ZKnight Invite'
      const companyDisplayName = company?.company_name || 'An employer'

      createNotification({
        userId: candidateUserId,
        type: 'candidate_request',
        title: `${companyDisplayName} invited you`,
        body: `You've been invited to complete a ${inviteLabel}${job?.title ? ` for ${job.title}` : ''}.`,
        data: {
          inviteId,
          companyName: companyDisplayName,
          targetBlockType: targetBlock,
          jobTitle: job?.title ?? null,
        },
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/apply/${invite.token}`,
      }).catch(err => console.error('[SEND INVITE EMAIL] Notification error:', err))
    }

    return NextResponse.json({
      success: true,
      message: `Invite email sent to ${recipientEmail}`,
      sentTo: recipientEmail,
      notified: !!candidateUserId,
    })

  } catch (error) {
    console.error('[SEND INVITE EMAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
