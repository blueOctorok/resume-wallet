import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

export interface SendInviteEmailParams {
  to: string
  candidateName?: string
  companyName: string
  jobTitle?: string
  inviteLink: string
  welcomeMessage?: string
}

/**
 * Sends an application invite email to a candidate.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[INVITE EMAIL] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const {
    to,
    candidateName,
    companyName,
    jobTitle,
    inviteLink,
    welcomeMessage,
  } = params

  const greeting = candidateName ? `Hi ${candidateName},` : 'Hello,'
  const jobLine = jobTitle 
    ? `<p><strong>Position:</strong> ${jobTitle}</p>` 
    : ''
  const customMessage = welcomeMessage 
    ? `<p style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">${welcomeMessage}</p>` 
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0d9488; margin: 0;">Storm Chain</h1>
    <p style="color: #666; margin: 4px 0;">Secure Driver Application</p>
  </div>
  
  <p>${greeting}</p>
  
  <p><strong>${companyName}</strong> has invited you to complete a driver application through Storm Chain.</p>
  
  ${jobLine}
  ${customMessage}
  
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <h3 style="margin: 0 0 12px 0; color: #111;">What you'll need:</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Your driver's license information</li>
      <li>CDL details (if applicable)</li>
      <li>Employment history for the past 10 years</li>
      <li>Any accident or violation history</li>
    </ul>
    <p style="margin: 12px 0 0 0; font-size: 14px; color: #666;">
      ⏱️ This typically takes 15-20 minutes to complete.
    </p>
  </div>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="${inviteLink}" 
       style="display: inline-block; padding: 14px 32px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Start Your Application
    </a>
  </div>
  
  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <p style="margin: 0; font-size: 14px;">
      <strong>🔒 Your information is secure.</strong><br>
      Storm Chain uses blockchain verification to protect your data. Only ${companyName} will have access to your application.
    </p>
  </div>
  
  <p style="font-size: 14px; color: #666;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${inviteLink}" style="color: #0d9488; word-break: break-all;">${inviteLink}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    This invitation was sent by ${companyName} through Storm Chain.<br>
    If you weren't expecting this, you can safely ignore this email.
  </p>
</body>
</html>
`.trim()

  const subject = jobTitle 
    ? `${companyName} - Complete Your Driver Application for ${jobTitle}`
    : `${companyName} - Complete Your Driver Application`

  try {
    console.log('[INVITE EMAIL] Sending to:', to, 'from:', FROM)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[INVITE EMAIL] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[INVITE EMAIL] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[INVITE EMAIL] Send failed:', err)
    return { ok: false, error: message }
  }
}
