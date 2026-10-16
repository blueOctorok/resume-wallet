import type { SupabaseClient } from '@supabase/supabase-js'
import { cdlStaleSentence, readCdlFreshness, type CdlFreshness } from '@/lib/cdl-freshness'
import { buildEmail, infoBox } from '@/lib/email-template'
import { createNotification } from '@/lib/create-notification'
import { getAppBaseUrl } from '@/lib/app-url'
import { isMessagingConfigured, sendEmail, sendSms } from '@/lib/messaging'
import { normalizeToE164 } from '@/lib/phone-e164'

/**
 * Tell a driver two things, once each: a resume now exists on their career
 * card, and a CDL date on that resume has passed. The same expiration date
 * is not sent again. A later date that also expires is a new notice.
 */

const SEND_LIMIT = 20
const CARD_PATH = '/?onboard=career-card'

export interface KeepCurrentCopy {
  subject: string
  sms: string
  title: string
  body: string
  emailHtml: string
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstName(raw: string | null): string | null {
  const name = raw?.trim()
  return name ? name : null
}

export function buildKeepCurrentCopy(input: {
  firstName: string | null
  url: string
  announceResume: boolean
  freshness: CdlFreshness | null
}): KeepCurrentCopy {
  const name = firstName(input.firstName)
  const hi = name ? `Hi ${name}` : 'Hi'
  const stale = input.freshness ? cdlStaleSentence(input.freshness) : null
  const licenseBit = stale
    ? stale.replace(/\.$/, '')
    : null

  let subject = 'Your Provven resume is ready'
  let sms = `${hi}, it's Provven. Your resume is ready on your career card: ${input.url}. It fills in as you update your file. Reply STOP to opt out.`
  let title = 'Your resume is ready'
  let body = 'Open your career card to view it. It updates as you fill in your file.'

  if (input.announceResume && licenseBit) {
    subject = 'Your Provven resume is ready — a CDL date needs an update'
    sms = `${hi}, it's Provven. Your resume is ready: ${input.url}. ${licenseBit}. Reply STOP to opt out.`
    title = 'Your resume is ready'
    body = licenseBit
  } else if (licenseBit) {
    subject = 'A date on your Provven resume has passed'
    sms = `${hi}, it's Provven. ${licenseBit}. Update it here: ${input.url}. Reply STOP to opt out.`
    title = 'Update a date on your resume'
    body = licenseBit
  }

  const paragraphs = [
    input.announceResume
      ? 'Your resume is on your Provven career card. Open it any time — it fills in from your file, and you can download the PDF from the card.'
      : null,
    licenseBit ? `${licenseBit}.` : null,
  ].filter((line): line is string => Boolean(line))

  const emailHtml = buildEmail({
    preheader: subject,
    headerEyebrow: 'Your resume',
    headerTitle: input.announceResume ? 'Your resume is ready' : 'A date on your resume has passed',
    greeting: `${hi},`,
    bodyHtml: `
      ${paragraphs
        .map(
          (line) =>
            `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${esc(line)}</p>`,
        )
        .join('')}
      ${
        licenseBit
          ? infoBox(
              `<p style="margin:0;font-size:13px;line-height:1.5;">Hazmat, tanker, and the rest of the license share this date. Updating it keeps the resume honest for the next employer.</p>`,
              '#F28A0F',
            )
          : ''
      }
    `,
    ctaLabel: 'Open your career card',
    ctaUrl: input.url,
    footerNote: 'You are receiving this because a Provven resume is on your account.',
  })

  return { subject, sms, title, body, emailHtml }
}

interface CdlRow {
  user_id: string
  cdl_class: string | null
  cdl_expiration: string | null
  endorsements: string[] | null
}

interface NoticeRow {
  user_id: string
  kind: string
  fingerprint: string
}

interface Candidate {
  userId: string
  freshness: CdlFreshness | null
  resumeReady: boolean
}

function hasNotice(notices: NoticeRow[], userId: string, kind: string, fingerprint: string): boolean {
  return notices.some(
    (row) => row.user_id === userId && row.kind === kind && row.fingerprint === fingerprint,
  )
}

/**
 * One pass. Safe to run daily: already-sent pairs are skipped.
 */
export async function runDriverKeepCurrent(
  supabase: SupabaseClient,
): Promise<{ considered: number; sent: number }> {
  const [{ data: cdlRows }, { data: apps }] = await Promise.all([
    supabase
      .from('block_driver_cdl')
      .select('user_id, cdl_class, cdl_expiration, endorsements')
      .order('updated_at', { ascending: false })
      .limit(80),
    supabase
      .from('driver_applications')
      .select('user_id')
      .eq('is_complete', true)
      .order('updated_at', { ascending: false })
      .limit(40),
  ])

  const byUser = new Map<string, Candidate>()
  for (const row of (cdlRows ?? []) as CdlRow[]) {
    if (!row.user_id) continue
    const endorsements = Array.isArray(row.endorsements) ? row.endorsements : []
    const freshness = readCdlFreshness({
      cdlClass: row.cdl_class,
      expiration: row.cdl_expiration,
      endorsements,
    })
    byUser.set(row.user_id, {
      userId: row.user_id,
      freshness,
      resumeReady: Boolean(freshness.classLetter),
    })
  }
  for (const app of apps ?? []) {
    const userId = app.user_id as string | null
    if (!userId || byUser.has(userId)) continue
    byUser.set(userId, { userId, freshness: null, resumeReady: true })
  }

  const ids = [...byUser.keys()]
  if (ids.length === 0) return { considered: 0, sent: 0 }

  const { data: noticeRows } = await supabase
    .from('driver_keep_current_notices')
    .select('user_id, kind, fingerprint')
    .in('user_id', ids)

  const notices = (noticeRows ?? []) as NoticeRow[]
  const due = [...byUser.values()].filter((candidate) => {
    const resumeDue =
      candidate.resumeReady && !hasNotice(notices, candidate.userId, 'resume_ready', 'ready')
    const expiredDue = Boolean(
      candidate.freshness?.expired &&
        candidate.freshness.expirationDay &&
        !hasNotice(notices, candidate.userId, 'cdl_expired', candidate.freshness.expirationDay),
    )
    return resumeDue || expiredDue
  })

  const batch = due.slice(0, SEND_LIMIT)
  if (batch.length === 0) return { considered: ids.length, sent: 0 }

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, first_name, email, phone')
    .in(
      'user_id',
      batch.map((candidate) => candidate.userId),
    )

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.user_id as string, profile]),
  )
  const url = `${getAppBaseUrl()}${CARD_PATH}`
  let sent = 0

  for (const candidate of batch) {
    const profile = profileById.get(candidate.userId)
    const announceResume =
      candidate.resumeReady && !hasNotice(notices, candidate.userId, 'resume_ready', 'ready')
    const expiredDue = Boolean(
      candidate.freshness?.expired &&
        candidate.freshness.expirationDay &&
        !hasNotice(notices, candidate.userId, 'cdl_expired', candidate.freshness.expirationDay),
    )
    const copy = buildKeepCurrentCopy({
      firstName: (profile?.first_name as string | null) ?? null,
      url,
      announceResume,
      freshness: expiredDue ? candidate.freshness : null,
    })

    const email = typeof profile?.email === 'string' ? profile.email.trim() : ''
    const phone = normalizeToE164(typeof profile?.phone === 'string' ? profile.phone : '')
    let emailOk = false
    let smsOk = false
    if (isMessagingConfigured() && email) {
      const result = await sendEmail({
        type: 'resume_upkeep',
        to: email,
        subject: copy.subject,
        html: copy.emailHtml,
      })
      emailOk = result.ok
    }
    if (isMessagingConfigured() && phone) {
      const result = await sendSms({ type: 'resume_upkeep', to: phone, message: copy.sms })
      smsOk = result.ok
    }

    await createNotification({
      userId: candidate.userId,
      type: 'resume_upkeep',
      title: copy.title,
      body: copy.body,
      actionUrl: CARD_PATH,
      data: {
        kind: announceResume && expiredDue ? 'resume_and_cdl' : announceResume ? 'resume_ready' : 'cdl_expired',
      },
    })

    const outboundAttempted = Boolean((email || phone) && isMessagingConfigured())
    const delivered = emailOk || smsOk || !outboundAttempted
    if (!delivered) continue

    const rows: { user_id: string; kind: string; fingerprint: string }[] = []
    if (announceResume) rows.push({ user_id: candidate.userId, kind: 'resume_ready', fingerprint: 'ready' })
    if (expiredDue && candidate.freshness?.expirationDay) {
      rows.push({
        user_id: candidate.userId,
        kind: 'cdl_expired',
        fingerprint: candidate.freshness.expirationDay,
      })
    }
    if (rows.length === 0) continue
    const { error } = await supabase.from('driver_keep_current_notices').upsert(rows, {
      onConflict: 'user_id,kind,fingerprint',
      ignoreDuplicates: true,
    })
    if (error) {
      console.error('[RESUME UPKEEP] notice insert failed:', error.message)
      continue
    }
    sent += 1
  }

  return { considered: ids.length, sent }
}
