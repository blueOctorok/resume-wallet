import type { SupabaseClient } from '@supabase/supabase-js'
import { buildEmail } from '@/lib/email-template'
import { sendEmail } from '@/lib/messaging'

/**
 * Sign-in code with no link in the message.
 *
 * Supabase's own OTP email includes a magic link. Outlook Safe Links fetches
 * that URL from a Microsoft IP and burns the one-time token before the person
 * can type the code — Auth then says "expired" on a code that is seconds old.
 * generateLink mints the same OTP and does not send mail. We send the digits
 * ourselves and never include the action_link.
 */
export async function sendSignInCode(
  admin: SupabaseClient,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase()

  const magic = await admin.auth.admin.generateLink({ type: 'magiclink', email: normalized })
  let otp = magic.data?.properties?.email_otp
  if (!otp) {
    const invite = await admin.auth.admin.generateLink({ type: 'invite', email: normalized })
    otp = invite.data?.properties?.email_otp
    if (!otp) {
      console.error(
        '[SIGNIN CODE] generateLink failed:',
        invite.error?.message || magic.error?.message,
      )
      return { ok: false, error: 'Could not send a sign-in code. Please try again.' }
    }
  }

  const html = buildEmail({
    preheader: `Your Provven code is ${otp}`,
    headerTitle: 'Your sign-in code',
    bodyHtml: `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#334155;">Type this code on the Provven page where you asked for it. There is no link to click.</p>
      <p style="margin:28px 0;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#173150;">${otp}</p>`,
    footerNote: "If you didn't ask to sign in, you can ignore this email.",
  })

  const sent = await sendEmail({
    type: 'signin_code',
    to: normalized,
    subject: `${otp} is your Provven sign-in code`,
    html,
  })
  if (!sent.ok) {
    console.error('[SIGNIN CODE] email failed:', sent.error)
    return { ok: false, error: 'Could not send the email. Please try again.' }
  }
  return { ok: true }
}
