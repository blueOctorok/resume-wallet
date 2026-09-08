import type { SupabaseClient } from '@supabase/supabase-js'
import { persistPingramTrackingId } from '@/lib/evr-inbound'
import { buildEmail, detailsBox, detailRow, infoBox, fallbackLink } from './email-template'
import { isMessagingConfigured, sendEmail } from './messaging'

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
 * Sends the employment verification request email to the previous employer via Pingram.
 */
export async function sendVerificationEmail(
  params: SendVerificationEmailParams
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[VERIFICATION EMAIL] PINGRAM_API_KEY not set, skipping send')
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
      A former employee asked Provven to send you their signed authorization and a
      Safety Performance History Records Request for <strong>${claimedCompanyName}</strong>.
      Please confirm or correct their employment dates if you choose to.
      This is a voluntary, driver-initiated request — not a motor-carrier DOT investigation.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Employment Details Provided</p>
      ${detailRow('Position', claimedPosition)}
      ${detailRow('Company', claimedCompanyName)}
      ${dateRange ? detailRow('Dates', dateRange) : ''}
    `)}
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      Please click the button below to confirm or correct this information, or
      <strong>reply to this email</strong> with YES if the dates are correct.
      The link is valid for <strong>30 days</strong>.
    </p>
    ${infoBox(`<p style="margin:0;font-size:13px;color:#7d5e33;line-height:1.5;">
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
    footerNote: `This request was sent through Provven on behalf of a former employee. If you weren't expecting this, you can safely ignore it.`,
  })

  console.log('[VERIFICATION EMAIL] Sending to:', to, 'via Pingram')
  const result = await sendEmail({
    type: 'employment_verification_email',
    to,
    subject: `Employment verification request – ${claimedCompanyName}`,
    html,
  })

  if (!result.ok) {
    console.error('[VERIFICATION EMAIL] Send failed:', result.error)
    return { ok: false, error: result.error }
  }

  console.log('[VERIFICATION EMAIL] Sent successfully. Pingram id:', result.id)
  return { ok: true, id: result.id }
}

/** Send the EV invite and stash Pingram's tracking id for DKIM inbound matching. */
export async function sendVerificationEmailAndTrack(
  supabase: SupabaseClient,
  requestId: string,
  params: SendVerificationEmailParams,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const result = await sendVerificationEmail(params)
  if (result.ok && result.id) {
    await persistPingramTrackingId(supabase, requestId, result.id)
  }
  return result
}
