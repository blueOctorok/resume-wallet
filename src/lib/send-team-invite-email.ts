import { Resend } from 'resend'
import { buildEmail, detailsBox, detailRow, infoBox, fallbackLink } from './email-template'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'stormchain@verify.stormchain.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stormchain.ai'

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
      <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Storm as a <strong>${roleDisplay}</strong>.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Invitation Details</p>
      ${detailRow('Company', companyName)}
      ${detailRow('Role', roleDisplay)}
      ${detailRow('Expires', expiresFormatted)}
    `)}
    ${infoBox(`
      <p style="margin:0;font-size:13px;color:#0f766e;line-height:1.5;">
        <strong>What happens next?</strong><br>
        Click the button below and sign in with your wallet. You'll automatically be added to ${companyName}'s team with ${roleDisplay} access.
      </p>
    `)}
    ${fallbackLink(inviteUrl)}
  `

  const html = buildEmail({
    preheader: `${inviterName} has invited you to join ${companyName} on Storm`,
    headerEyebrow: companyName,
    headerTitle: `You've been invited to join ${companyName}`,
    bodyHtml,
    ctaLabel: 'Accept Invitation',
    ctaUrl: inviteUrl,
    footerNote: `This invitation was sent by ${inviterName} at ${companyName} through Storm. If you weren't expecting this, you can safely ignore it.`,
  })

  const subject = `You're invited to join ${companyName} on Storm`

  try {
    console.log('[TEAM INVITE EMAIL] Sending to:', to, 'from:', FROM)
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
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
