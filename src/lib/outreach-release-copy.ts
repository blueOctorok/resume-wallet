import type { SupabaseClient } from '@supabase/supabase-js'
import { HOT_EMBERS } from '@/lib/brand-colors'

/** The one invite outreach actually sends. Copy below is for this block only. */
export const SCREENING_CONSENT_INVITE = 'driver-screening-consent'

export interface OutreachSender {
  name: string | null
  phone: string | null
}

/** The signed-in recruiter, for the signature on the release text and email. */
export async function loadOutreachSender(
  supabase: SupabaseClient,
  userId: string,
): Promise<OutreachSender> {
  const { data } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, phone')
    .eq('user_id', userId)
    .maybeSingle()

  const row = data as { first_name?: string | null; last_name?: string | null; phone?: string | null } | null
  const name = [row?.first_name, row?.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')
  return { name: name || null, phone: row?.phone?.trim() || null }
}

export function candidateFirstName(candidateName?: string | null): string | null {
  const first = candidateName?.trim().split(/\s+/)[0]
  return first || null
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Text a recruiter sends with the consent link. Company name comes from the
 * account, so Pace reads "Pace Drivers" without the copy being Pace-only.
 */
export function buildMvrReleaseSms(ctx: {
  candidateName?: string | null
  recruiterName?: string | null
  companyName: string
  releaseLink: string
}): string {
  const first = candidateFirstName(ctx.candidateName)
  const hi = first ? `Hi ${first}` : 'Hi'
  const who = ctx.recruiterName?.trim()
    ? `${ctx.recruiterName.trim()} with ${ctx.companyName}`
    : ctx.companyName
  return `${hi}, it's ${who}. As we discussed, please sign your MVR release here: ${ctx.releaseLink}. Once you're done, you'll land in your Provven Career Hub, where you can also fill out your DOT application. Fill it out once and reuse it for future jobs. Reply STOP to opt out.`
}

export interface MvrReleaseEmail {
  subject: string
  greeting: string
  bodyHtml: string
}

/**
 * Email that goes with the same link. One button, in the spot the letter
 * asks them to sign, then the Career Hub explanation.
 */
export function buildMvrReleaseEmail(ctx: {
  candidateName?: string | null
  recruiterName?: string | null
  recruiterPhone?: string | null
  companyName: string
  jobTitle?: string | null
  releaseLink: string
  welcomeMessage?: string | null
}): MvrReleaseEmail {
  const first = candidateFirstName(ctx.candidateName)
  const company = esc(ctx.companyName)
  const recruiter = ctx.recruiterName?.trim() ? esc(ctx.recruiterName.trim()) : null
  const job = ctx.jobTitle?.trim()
  const about = job
    ? `Thanks for talking with me about the ${esc(job)} role.`
    : 'Thanks for talking with me.'
  const phone = ctx.recruiterPhone?.trim()
  const questions = phone
    ? `If you have questions about the job or the forms, reply here or call me at ${esc(phone)}.`
    : 'If you have questions about the job or the forms, reply to this email.'
  const note = ctx.welcomeMessage?.trim()
    ? `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${esc(ctx.welcomeMessage.trim())}</p>`
    : ''

  const reasons = [
    "Fill out your 10-year work history one time instead of on every carrier's form.",
    "It's your application, and you can reuse it for future jobs.",
    'Your documents stay with you in one place.',
    "It's free for drivers.",
  ]
    .map(
      (line) =>
        `<p style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.6;">• ${line}</p>`,
    )
    .join('')

  const bodyHtml = `
    ${note}
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${about} The next step is to authorize your motor vehicle record (MVR) check. ${company} uses Provven, a driver-owned career platform, for this step.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
      <tr>
        <td align="center">
          <a href="${esc(ctx.releaseLink)}"
             style="display:inline-block;background:${HOT_EMBERS};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">
            Sign your release form
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">It takes a few minutes. Please read each form before you sign.</p>
    <p style="margin:0 0 8px;color:#173150;font-size:16px;font-weight:700;line-height:1.4;">After you sign: your Career Hub</p>
    <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">When you finish, you'll land in your Provven Career Hub. That's where you'll see the button for the DOT application.</p>
    <p style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.6;">We encourage you to fill it out while you're there:</p>
    ${reasons}
    <p style="margin:16px 0;color:#334155;font-size:15px;line-height:1.6;">${questions}</p>
    <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">Thanks,<br>${recruiter ? `${recruiter}<br>` : ''}${company}</p>
  `

  return {
    subject: `Next step for your ${ctx.companyName} job: sign your MVR release`,
    greeting: first ? `Hi ${first},` : 'Hi,',
    bodyHtml,
  }
}
