import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@verify.stormchain.ai'
const ADMIN_EMAILS = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stormchain.ai'

export interface NewCompanyNotificationParams {
  companyName: string
  ownerEmail: string
  ownerWallet: string
  dotNumber?: string | null
}

export interface CandidateRequestNotificationParams {
  candidateEmail: string
  candidateName: string
  companyName: string
  requestType: 'mvr_order' | 'document_upload' | 'verification' | 'profile_completion' | 'custom'
  documentType?: string | null
  message?: string | null
}

/**
 * Notifies admins when a new company is registered.
 * Skips if no admin emails configured or Resend not set up.
 */
export async function sendNewCompanyNotification(
  params: NewCompanyNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[ADMIN NOTIFICATION] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  if (ADMIN_EMAILS.length === 0) {
    console.warn('[ADMIN NOTIFICATION] No ADMIN_NOTIFICATION_EMAILS configured')
    return { ok: false, error: 'No admin emails configured' }
  }

  const { companyName, ownerEmail, ownerWallet, dotNumber } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <h2 style="color: #0d9488; margin-bottom: 16px;">New Company Registered</h2>
  
  <p>A new employer company has been registered on StormChain:</p>
  
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px;"><strong>Company:</strong> ${companyName}</p>
    <p style="margin: 0 0 8px;"><strong>Owner Email:</strong> ${ownerEmail}</p>
    <p style="margin: 0 0 8px;"><strong>Wallet:</strong> <code style="font-size: 12px;">${ownerWallet}</code></p>
    ${dotNumber ? `<p style="margin: 0;"><strong>DOT Number:</strong> ${dotNumber}</p>` : ''}
  </div>
  
  <p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://stormchain.ai'}/admin" 
       style="display: inline-block; padding: 10px 20px; background: #0d9488; color: white; text-decoration: none; border-radius: 6px;">
      View in Admin Panel
    </a>
  </p>
  
  <p style="color: #666; font-size: 14px; margin-top: 24px;">— StormChain System</p>
</body>
</html>
`.trim()

  try {
    console.log('[ADMIN NOTIFICATION] Sending new company notification to:', ADMIN_EMAILS)
    
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAILS,
      subject: `[StormChain] New Company: ${companyName}`,
      html,
    })
    
    if (error) {
      console.error('[ADMIN NOTIFICATION] Resend error:', error)
      return { ok: false, error: error.message }
    }
    
    console.log('[ADMIN NOTIFICATION] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ADMIN NOTIFICATION] Send failed:', err)
    return { ok: false, error: message }
  }
}

/**
 * Human-readable request type labels
 */
const REQUEST_TYPE_LABELS: Record<string, string> = {
  mvr_order: 'Motor Vehicle Record (MVR)',
  document_upload: 'Document Upload',
  verification: 'Employment Verification',
  profile_completion: 'Profile Completion',
  custom: 'Request',
}

/**
 * Notifies a candidate when an employer makes a request.
 */
export async function sendCandidateRequestNotification(
  params: CandidateRequestNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[CANDIDATE NOTIFICATION] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { candidateEmail, candidateName, companyName, requestType, documentType, message } = params
  
  const requestLabel = REQUEST_TYPE_LABELS[requestType] || 'Request'
  const firstName = candidateName.split(' ')[0] || 'there'

  // Build action description based on request type
  let actionText = ''
  switch (requestType) {
    case 'mvr_order':
      actionText = 'They would like to order your Motor Vehicle Record (MVR). This MVR will be added to your profile and visible to all employers, increasing your hiring potential.'
      break
    case 'document_upload':
      actionText = `They are requesting you upload your ${documentType || 'document'}.`
      break
    case 'verification':
      actionText = 'They are requesting employment verification for your work history.'
      break
    case 'profile_completion':
      actionText = 'They are requesting you complete additional sections of your profile.'
      break
    case 'custom':
      actionText = message || 'They have a request for you.'
      break
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0d9488; margin: 0; font-size: 24px;">StormChain</h1>
  </div>
  
  <h2 style="color: #1f2937; margin-bottom: 16px;">Hi ${firstName},</h2>
  
  <p>Great news! <strong>${companyName}</strong> is interested in you and has sent a request.</p>
  
  <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0 0 8px; font-weight: 600; color: #0d9488;">${requestLabel}</p>
    <p style="margin: 0; color: #374151;">${actionText}</p>
    ${message && requestType !== 'custom' ? `<p style="margin: 12px 0 0; font-style: italic; color: #6b7280;">"${message}"</p>` : ''}
  </div>
  
  <p>Log in to your StormChain account to view and respond to this request.</p>
  
  <div style="text-align: center; margin: 24px 0;">
    <a href="${APP_URL}" 
       style="display: inline-block; padding: 12px 32px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
      View Request
    </a>
  </div>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  
  <p style="color: #6b7280; font-size: 13px; margin: 0;">
    You're receiving this because an employer on StormChain is interested in your profile.
    <br>If you have questions, reply to this email.
  </p>
</body>
</html>
`.trim()

  try {
    console.log('[CANDIDATE NOTIFICATION] Sending request notification to:', candidateEmail)
    
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: candidateEmail,
      subject: `${companyName} has a request for you on StormChain`,
      html,
    })
    
    if (error) {
      console.error('[CANDIDATE NOTIFICATION] Resend error:', error)
      return { ok: false, error: error.message }
    }
    
    console.log('[CANDIDATE NOTIFICATION] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CANDIDATE NOTIFICATION] Send failed:', err)
    return { ok: false, error: message }
  }
}
