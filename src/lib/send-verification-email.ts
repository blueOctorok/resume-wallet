import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

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
 * No-op if RESEND_API_KEY is not set (logs and returns).
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
      ? [claimedStartDate, claimedEndDate].filter(Boolean).join(' – ') || ''
      : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello${previousEmployerName ? ` at ${previousEmployerName}` : ''},</p>
  <p>A former employee has requested employment verification through Storm Chain.</p>
  <p><strong>Details they provided:</strong></p>
  <ul>
    <li>Position: ${claimedPosition}</li>
    <li>Company: ${claimedCompanyName}</li>
    ${dateRange ? `<li>Dates: ${dateRange}</li>` : ''}
  </ul>
  <p>Please confirm or correct this information by clicking the link below (valid for 30 days):</p>
  <p><a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background: #0d9488; color: white; text-decoration: none; border-radius: 6px;">Verify employment</a></p>
  <p style="color: #666; font-size: 14px;">If you did not expect this request, you can ignore this email.</p>
  <p style="color: #666; font-size: 14px;">— Storm Chain</p>
</body>
</html>
`.trim()

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
