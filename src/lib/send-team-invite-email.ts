import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export interface SendTeamInviteEmailParams {
  to: string
  inviterName: string
  companyName: string
  role: string
  inviteToken: string
  expiresAt: Date
}

/**
 * Sends a team invitation email to a new team member.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendTeamInviteEmail(
  params: SendTeamInviteEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[TEAM INVITE EMAIL] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const {
    to,
    inviterName,
    companyName,
    role,
    inviteToken,
    expiresAt,
  } = params

  const inviteUrl = `${APP_URL}/invite/${inviteToken}`
  const expiresFormatted = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0d9488; margin: 0;">Storm Chain</h1>
    <p style="color: #666; margin: 4px 0;">Employer Platform</p>
  </div>
  
  <p>Hello,</p>
  
  <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Storm Chain as a <strong>${roleDisplay}</strong>.</p>
  
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <h3 style="margin: 0 0 12px 0; color: #111;">Invitation Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Company</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${companyName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Role</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${roleDisplay}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Expires</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${expiresFormatted}</td>
      </tr>
    </table>
  </div>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="${inviteUrl}" 
       style="display: inline-block; padding: 14px 32px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Accept Invitation
    </a>
  </div>
  
  <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <p style="margin: 0; font-size: 14px;">
      <strong>ℹ️ What happens next?</strong><br>
      Click the button above and sign in with your wallet. You'll automatically be added to ${companyName}'s team with ${roleDisplay} access.
    </p>
  </div>
  
  <p style="font-size: 14px; color: #666;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${inviteUrl}" style="color: #0d9488; word-break: break-all;">${inviteUrl}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    This invitation was sent by ${inviterName} at ${companyName} through Storm Chain.<br>
    If you weren't expecting this, you can safely ignore this email.
  </p>
</body>
</html>
`.trim()

  const subject = `You're invited to join ${companyName} on Storm Chain`

  try {
    console.log('[TEAM INVITE EMAIL] Sending to:', to, 'from:', FROM)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[TEAM INVITE EMAIL] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[TEAM INVITE EMAIL] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[TEAM INVITE EMAIL] Send failed:', err)
    return { ok: false, error: message }
  }
}
