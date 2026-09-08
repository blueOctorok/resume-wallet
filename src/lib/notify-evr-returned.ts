import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppBaseUrl } from '@/lib/app-url'
import { buildEmail, infoBox } from '@/lib/email-template'
import { isMessagingConfigured, sendEmail } from '@/lib/messaging'

/**
 * Tell the driver a previous employer returned their packet.
 * In-app + email; career-card share still requires their review checkbox.
 */
export async function notifyDriverEvrReturned(
  supabase: SupabaseClient,
  params: { driverId: string; employerName: string },
): Promise<void> {
  const { driverId, employerName } = params
  const company = employerName.trim() || 'a previous employer'

  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: driverId,
    type: 'employment_verification',
    title: 'Employment verification returned',
    body: `${company} sent back your safety performance history. Review it before sharing on your career card.`,
    action_url: '/?onboard=employment-verification',
    data: { employerName: company },
  })
  if (notifyError) {
    console.warn('[EVR RETURNED] In-app notify failed:', notifyError.message)
  }

  if (!isMessagingConfigured()) return

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, first_name')
    .eq('user_id', driverId)
    .maybeSingle()

  const to = typeof profile?.email === 'string' ? profile.email.trim() : ''
  if (!to) return

  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : ''
  const html = buildEmail({
    preheader: `${company} returned your employment verification`,
    headerEyebrow: 'Employment Verification',
    headerTitle: 'A previous employer replied',
    greeting: first ? `Hi ${first},` : 'Hi,',
    bodyHtml: `
      <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
        <strong>${company}</strong> completed your Safety Performance History request.
        A copy is in your Provven employment-verification block. Review it there —
        we do not put it on your career card until you agree to share.
      </p>
      ${infoBox(`<p style="margin:0;font-size:13px;color:#7d5e33;line-height:1.5;">
        If something looks wrong, request a correction from that employer and keep the original on file.
      </p>`)}
    `,
    ctaLabel: 'Review employment verification',
    ctaUrl: `${getAppBaseUrl()}/?onboard=employment-verification`,
  })

  const result = await sendEmail({
    type: 'employment_verification_returned',
    to,
    subject: `Employment verification returned – ${company}`,
    html,
  })
  if (!result.ok) {
    console.warn('[EVR RETURNED] Driver email failed:', result.error)
  }
}
