import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@verify.stormchain.ai'
const ADMIN_EMAILS = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []

export interface NewCompanyNotificationParams {
  companyName: string
  ownerEmail: string
  ownerWallet: string
  dotNumber?: string | null
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
