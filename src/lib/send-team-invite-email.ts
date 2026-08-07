import { buildEmail, detailsBox, detailRow, infoBox, fallbackLink } from './email-template'
import { isMessagingConfigured, sendEmail } from './messaging'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://provven.com'

export interface SendTeamInviteEmailParams {
  to: string
  inviterName: string
  companyName: string
  role: string
  inviteToken: string
  expiresAt: Date
}

/**
 * Sends a team invitation email to a new team member via Pingram.
 */
export async function sendTeamInviteEmail(
  params: SendTeamInviteEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[TEAM INVITE EMAIL] PINGRAM_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { to, inviterName, companyName, role, inviteToken, expiresAt } = params

  const inviteUrl = `${APP_URL}/invite/${inviteToken}`
  const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const expiresFormatted = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Provven as a <strong>${roleDisplay}</strong>.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Invitation Details</p>
      ${detailRow('Company', companyName)}
      ${detailRow('Role', roleDisplay)}
      ${detailRow('Expires', expiresFormatted)}
    `)}
    ${infoBox(`
      <p style="margin:0;font-size:13px;color:#7d5e33;line-height:1.5;">
        <strong>What happens next?</strong><br>
        Click the button below and sign in with your wallet. You'll automatically be added to ${companyName}'s team with ${roleDisplay} access.
      </p>
    `)}
    ${fallbackLink(inviteUrl)}
  `

  const html = buildEmail({
    preheader: `${inviterName} has invited you to join ${companyName} on Provven`,
    headerEyebrow: companyName,
    headerTitle: `You've been invited to join ${companyName}`,
    bodyHtml,
    ctaLabel: 'Accept Invitation',
    ctaUrl: inviteUrl,
    footerNote: `This invitation was sent by ${inviterName} at ${companyName} through Provven. If you weren't expecting this, you can safely ignore it.`,
  })

  const subject = `You're invited to join ${companyName} on Provven`

  console.log('[TEAM INVITE EMAIL] Sending to:', to, 'via Pingram')
  const result = await sendEmail({
    type: 'team_invite_email',
    to,
    subject,
    html,
  })

  if (!result.ok) {
    console.error('[TEAM INVITE EMAIL] Send failed:', result.error)
    return { ok: false, error: result.error }
  }

  console.log('[TEAM INVITE EMAIL] Sent successfully. Pingram id:', result.id)
  return { ok: true }
}
