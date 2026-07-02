import { Resend } from 'resend'
import { buildEmail, detailsBox, detailRow, infoBox, fallbackLink } from './email-template'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'zknight@verify.zknight.io'

export interface SendVerificationEmailParams {
  to: string
  verificationLink: string
  previousEmployerName: string
  claimedPosition: string
  claimedCompanyName: string
  claimedStartDate?: string
  claimedEndDate?: string | null
}

/**
 * Sends the employment verification request email to the previous employer.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendVerificationEmail(
  params: SendVerificationEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[VERIFICATION EMAIL] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const {
    to,
    verificationLink,
    previousEmployerName,
    claimedPosition,
    claimedCompanyName,
    claimedStartDate,
    claimedEndDate,
  } = params

  const dateRange =
    claimedStartDate || claimedEndDate
      ? [claimedStartDate, claimedEndDate].filter(Boolean).join(' – ')
      : null

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      A former employee has listed <strong>${claimedCompanyName}</strong> on their ZKnight career profile and
      asked us to reach out so you can <strong>confirm or correct their employment dates</strong> if you choose to.
      This is a voluntary, job-agnostic check — not a government or DOT investigation.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Employment Details Provided</p>
      ${detailRow('Position', claimedPosition)}
      ${detailRow('Company', claimedCompanyName)}
      ${dateRange ? detailRow('Dates', dateRange) : ''}
    `)}
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      Please click the button below to confirm or correct this information.
      The link is valid for <strong>30 days</strong>.
    </p>
    ${infoBox(`<p style="margin:0;font-size:13px;color:#0f766e;line-height:1.5;">
      <strong>You are not required to respond.</strong> If you choose not to respond, the
      verification request will simply expire. Your response is kept confidential.
    </p>`)}
    ${fallbackLink(verificationLink)}
  `

  const html = buildEmail({
    preheader: `Employment verification request for ${claimedPosition} at ${claimedCompanyName}`,
    headerEyebrow: 'Employment Verification',
    headerTitle: `Verification Request: ${claimedCompanyName}`,
    greeting: `Hello${previousEmployerName ? ` at ${previousEmployerName}` : ''},`,
    bodyHtml,
    ctaLabel: 'Verify Employment',
    ctaUrl: verificationLink,
    footerNote: `This request was sent through ZKnight on behalf of a former employee. If you weren't expecting this, you can safely ignore it.`,
  })

  try {
    console.log('[VERIFICATION EMAIL] Sending to:', to, 'from:', FROM)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Employment verification request – ${claimedCompanyName}`,
      html,
    })
    if (error) {
      console.error('[VERIFICATION EMAIL] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[VERIFICATION EMAIL] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[VERIFICATION EMAIL] Send failed:', err)
    return { ok: false, error: message }
  }
}
