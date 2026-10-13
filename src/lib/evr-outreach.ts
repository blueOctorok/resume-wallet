/**
 * Employment-verification outreach engine (Phase 1: email, automated cadence).
 *
 * One place owns "send the next attempt" so the driver's manual resend, the
 * first send on initiate, and the hourly cron all produce identical rows.
 *
 * Cadence: day 0 → day 3 → day 7, then the packet is marked exhausted 7 days
 * after the last send if nothing came back. Every attempt is a row in
 * `verification_attempts` carrying Pingram's tracking id so delivery webhooks
 * (delivered / opened / clicked / bounced) can be matched back to it. That
 * per-attempt trail is the good-faith record 49 CFR 391.23(c)(2) asks for.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebhookEvent } from 'pingram'
import { createNotification } from '@/lib/create-notification'
import { buildSmsText, buildVoiceScript } from '@/lib/evr-touch-script'
import { sendSms, sendVoiceMessage } from '@/lib/messaging'
import { sendVerificationEmailAndTrack } from '@/lib/send-verification-email'

export const EVR_MAX_ATTEMPTS = 3
/** Days to wait after attempt N (1-based index N-1) before sending attempt N+1. */
const FOLLOW_UP_DELAY_DAYS = [3, 4]
/** Days after the final send before the packet is declared exhausted. */
export const EVR_EXHAUST_AFTER_DAYS = 7

const EV_BLOCK_URL = '/?onboard=employment-verification'

export const OUTREACH_REQUEST_COLUMNS =
  'id, driver_id, status, attempt_count, last_attempt_at, next_attempt_at, previous_employer_name, previous_employer_email, previous_employer_phone, claimed_position, claimed_start_date, claimed_end_date, verification_token'

export interface OutreachRequestRow {
  id: string
  driver_id: string
  status: string
  attempt_count: number | null
  last_attempt_at: string | null
  next_attempt_at: string | null
  previous_employer_name: string | null
  previous_employer_email: string | null
  previous_employer_phone: string | null
  claimed_position: string | null
  claimed_start_date: string | null
  claimed_end_date: string | null
  verification_token: string | null
}

const OPEN_STATUSES = ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS']

function addDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString()
}

/** When the cron should send the attempt after `attemptNumber`, or null when none remain. */
export function nextAttemptAtAfter(attemptNumber: number, from = new Date()): string | null {
  if (attemptNumber >= EVR_MAX_ATTEMPTS) return null
  return addDays(from, FOLLOW_UP_DELAY_DAYS[attemptNumber - 1] ?? 3)
}

/**
 * Only send Mon–Fri, 9am–4pm Eastern (13:00–20:59 UTC). We do not know the
 * employer's timezone, but a weekday-business-hours send beats a 2am one
 * for open rates, and it keeps follow-ups out of Monday-morning purge.
 */
export function isOutreachSendWindow(now = new Date()): boolean {
  const day = now.getUTCDay()
  const hour = now.getUTCHours()
  return day >= 1 && day <= 5 && hour >= 13 && hour <= 20
}

export interface SendOutreachOptions {
  baseUrl: string
  triggeredBy: 'driver' | 'cron' | 'admin'
}

export type SendOutreachResult =
  | { ok: true; attemptNumber: number; emailSent: boolean }
  | { ok: false; error: string; code: 'no_contact' | 'exhausted' | 'closed' }

/**
 * Send the next email attempt for a packet and record it. Safe to call from
 * any trigger; the guards make it idempotent against double-sends.
 */
export async function sendOutreachAttempt(
  supabase: SupabaseClient,
  row: OutreachRequestRow,
  { baseUrl, triggeredBy }: SendOutreachOptions,
): Promise<SendOutreachResult> {
  if (!OPEN_STATUSES.includes(row.status)) {
    return { ok: false, code: 'closed', error: 'This packet already has a reply or is closed.' }
  }
  const attemptCount = Number(row.attempt_count ?? 0)
  if (attemptCount >= EVR_MAX_ATTEMPTS) {
    return { ok: false, code: 'exhausted', error: `Already sent ${EVR_MAX_ATTEMPTS} times.` }
  }
  const email = row.previous_employer_email?.trim()
  if (!email || !row.verification_token) {
    return { ok: false, code: 'no_contact', error: 'No employer email on this packet yet.' }
  }

  // Subject says "2 of 3". The row number can be higher once a call or text is in the timeline.
  const emailAttempt = attemptCount + 1
  const sequence = await nextSequenceNumber(supabase, row.id)
  const employerName = row.previous_employer_name ?? ''
  const emailResult = await sendVerificationEmailAndTrack(supabase, row.id, {
    to: email,
    verificationLink: `${baseUrl}/verify/${row.verification_token}`,
    previousEmployerName: employerName,
    claimedPosition: row.claimed_position ?? '',
    claimedCompanyName: employerName,
    claimedStartDate: row.claimed_start_date ?? undefined,
    claimedEndDate: row.claimed_end_date,
    attemptNumber: emailAttempt,
    maxAttempts: EVR_MAX_ATTEMPTS,
  })
  if (!emailResult.ok) {
    console.warn(`[EVR OUTREACH] attempt ${emailAttempt} for ${row.id} failed to send:`, emailResult.error)
  }

  const now = new Date()
  await supabase.from('verification_attempts').insert({
    verification_request_id: row.id,
    attempt_number: sequence,
    method: 'email',
    contact_email: email,
    contact_phone: row.previous_employer_phone,
    provider_tracking_id: emailResult.id ?? null,
    // A send that never left Pingram is recorded as failed so the record is honest.
    delivery_status: emailResult.ok ? 'sent' : 'failed',
    failed_at: emailResult.ok ? null : now.toISOString(),
    failure_code: emailResult.ok ? null : 'send_error',
    triggered_by: triggeredBy,
  })

  await supabase
    .from('employment_verification_requests')
    .update({
      attempt_count: emailAttempt,
      last_attempt_at: now.toISOString(),
      status: 'VERIFICATION_IN_PROGRESS',
      next_attempt_at: nextAttemptAtAfter(emailAttempt, now),
      updated_at: now.toISOString(),
    })
    .eq('id', row.id)

  return { ok: true, attemptNumber: emailAttempt, emailSent: emailResult.ok }
}

export function isVoiceSmsEnabled(): boolean {
  return process.env.EVR_VOICE_SMS_ENABLED === 'true'
}

/** US numbers from FMCSA are usually 10 digits. Pingram wants E.164. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`
  return null
}

/** Timeline order. Emails and the day-5 touch share this sequence, so the next row is max+1, not attempt_count+1. */
async function nextSequenceNumber(supabase: SupabaseClient, requestId: string): Promise<number> {
  const { data } = await supabase
    .from('verification_attempts')
    .select('attempt_number')
    .eq('verification_request_id', requestId)
    .order('attempt_number', { ascending: false })
    .limit(1)
  const max = Number(data?.[0]?.attempt_number ?? 0)
  return max + 1
}

export interface CadenceSummary {
  due: number
  sent: number
  skipped: number
  exhausted: number
  touched: number
}

interface TouchRow {
  id: string
  driver_id: string
  previous_employer_name: string | null
  previous_employer_phone: string | null
  previous_employer_phone_type: string | null
  verification_token: string | null
  voice_opt_out: boolean | null
  sms_opt_out: boolean | null
}

/**
 * One scripted call or text per packet, after email 2. Does not increment
 * attempt_count — the three-email cap stays an email cap.
 * Office (or unknown) numbers are called. Mobile numbers are texted.
 */
export async function sendOutreachTouch(
  supabase: SupabaseClient,
  row: TouchRow,
  baseUrl: string,
): Promise<{ ok: boolean }> {
  const channel = row.previous_employer_phone_type === 'mobile' ? 'sms' : 'phone'
  if (channel === 'sms' && row.sms_opt_out) return { ok: false }
  if (channel === 'phone' && row.voice_opt_out) return { ok: false }

  const to = toE164(row.previous_employer_phone ?? '')
  if (!to || !row.verification_token) return { ok: false }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', row.driver_id)
    .maybeSingle()
  const driverName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'a driver'
  const employerName = row.previous_employer_name ?? 'their previous employer'

  const sent =
    channel === 'sms'
      ? await sendSms({
          type: 'evr_touch_sms',
          to,
          message: buildSmsText({
            driverName,
            employerName,
            verificationLink: `${baseUrl}/verify/${row.verification_token}`,
          }),
        })
      : await sendVoiceMessage({
          type: 'evr_touch_call',
          to,
          message: buildVoiceScript({ driverName, employerName }),
        })

  const now = new Date().toISOString()
  await supabase.from('verification_attempts').insert({
    verification_request_id: row.id,
    attempt_number: await nextSequenceNumber(supabase, row.id),
    method: channel,
    contact_phone: to,
    provider_tracking_id: sent.id ?? null,
    delivery_status: sent.ok ? 'sent' : 'failed',
    failed_at: sent.ok ? null : now,
    failure_code: sent.ok ? null : 'send_error',
    triggered_by: 'cron',
  })
  // Record the touch even when Pingram rejected it, so the cron does not retry all day.
  await supabase
    .from('employment_verification_requests')
    .update({ last_touch_at: now, updated_at: now })
    .eq('id', row.id)

  return { ok: sent.ok }
}

/** Hourly cron body: send due follow-ups, then close out packets nobody answered. */
export async function runOutreachCadence(
  supabase: SupabaseClient,
  baseUrl: string,
): Promise<CadenceSummary> {
  const summary: CadenceSummary = { due: 0, sent: 0, skipped: 0, exhausted: 0, touched: 0 }
  const nowIso = new Date().toISOString()

  if (isOutreachSendWindow()) {
    const { data: due } = await supabase
      .from('employment_verification_requests')
      .select(OUTREACH_REQUEST_COLUMNS)
      .in('status', OPEN_STATUSES)
      .lte('next_attempt_at', nowIso)
      .lt('attempt_count', EVR_MAX_ATTEMPTS)
      .not('previous_employer_email', 'is', null)
      .order('next_attempt_at', { ascending: true })
      .limit(100)

    for (const row of (due ?? []) as OutreachRequestRow[]) {
      summary.due++
      const result = await sendOutreachAttempt(supabase, row, { baseUrl, triggeredBy: 'cron' })
      if (result.ok) summary.sent++
      else summary.skipped++
    }

    if (isVoiceSmsEnabled()) {
      // Day 5: two days after email 2, one call (office) or text (mobile).
      const touchBefore = addDays(new Date(), -2)
      const { data: touchable } = await supabase
        .from('employment_verification_requests')
        .select(
          'id, driver_id, previous_employer_name, previous_employer_phone, previous_employer_phone_type, verification_token, voice_opt_out, sms_opt_out',
        )
        .eq('status', 'VERIFICATION_IN_PROGRESS')
        .eq('attempt_count', 2)
        .is('last_touch_at', null)
        .not('previous_employer_phone', 'is', null)
        .lte('last_attempt_at', touchBefore)
        .limit(50)

      for (const row of touchable ?? []) {
        const result = await sendOutreachTouch(supabase, row, baseUrl)
        if (result.ok) summary.touched++
      }
    }
  }

  const exhaustBefore = addDays(new Date(), -EVR_EXHAUST_AFTER_DAYS)
  const { data: stale } = await supabase
    .from('employment_verification_requests')
    .select('id, driver_id, previous_employer_name')
    .eq('status', 'VERIFICATION_IN_PROGRESS')
    .gte('attempt_count', EVR_MAX_ATTEMPTS)
    .lte('last_attempt_at', exhaustBefore)
    .limit(100)

  for (const row of stale ?? []) {
    await supabase
      .from('employment_verification_requests')
      .update({
        status: 'ATTEMPTS_EXHAUSTED',
        outreach_exhausted_at: nowIso,
        next_attempt_at: null,
        updated_at: nowIso,
      })
      .eq('id', row.id)
    await createNotification({
      userId: String(row.driver_id),
      type: 'employment_verification',
      title: `No reply from ${row.previous_employer_name ?? 'previous employer'}`,
      body: `We sent ${EVR_MAX_ATTEMPTS} requests over two weeks with no response. Your attempt record is ready to download — it documents the good-faith effort.`,
      actionUrl: EV_BLOCK_URL,
      data: { requestId: row.id, reason: 'attempts_exhausted' },
    })
    summary.exhausted++
  }

  return summary
}

// ── Pingram delivery events ─────────────────────────────────────────────────

/** Higher rank = further along; never downgrade (a late DELIVERED after OPEN is noise). */
const DELIVERY_RANK: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3 }

export async function processEvrDeliveryEvent(
  supabase: SupabaseClient,
  event: Pick<WebhookEvent, 'eventType' | 'trackingId' | 'failureCode'> & { inboundText?: string | null },
): Promise<{ matched: boolean }> {
  if (!event.trackingId) return { matched: false }

  const { data: attempt } = await supabase
    .from('verification_attempts')
    .select('id, verification_request_id, delivery_status, method')
    .eq('provider_tracking_id', event.trackingId)
    .maybeSingle()
  if (!attempt) return { matched: false }

  const nowIso = new Date().toISOString()
  const current = String(attempt.delivery_status ?? 'sent')
  const requestId = String(attempt.verification_request_id)

  if (event.eventType === 'SMS_UNSUBSCRIBE' || event.eventType === 'CALL_UNSUBSCRIBE') {
    const column = event.eventType === 'SMS_UNSUBSCRIBE' ? 'sms_opt_out' : 'voice_opt_out'
    await supabase
      .from('employment_verification_requests')
      .update({ [column]: true, updated_at: nowIso })
      .eq('id', requestId)
    return { matched: true }
  }

  if (event.eventType === 'SMS_INBOUND' || event.eventType === 'VOICE_INBOUND') {
    await notifyDriverOfInbound(supabase, requestId, event.inboundText ?? null, event.eventType === 'SMS_INBOUND')
    return { matched: true }
  }

  if (event.eventType === 'EMAIL_FAILED' || event.eventType === 'SMS_FAILED' || event.eventType === 'CALL_FAILED') {
    await supabase
      .from('verification_attempts')
      .update({ delivery_status: 'failed', failed_at: nowIso, failure_code: event.failureCode ?? 'bounce' })
      .eq('id', attempt.id)
    // Only an email bounce pauses the cadence. A missed call should not stop the emails.
    if (event.eventType === 'EMAIL_FAILED') await markRequestNeedsContact(supabase, requestId)
    else await notifyDriverTouchFailed(supabase, requestId, String(attempt.method ?? 'phone'))
    return { matched: true }
  }

  const next =
    event.eventType === 'EMAIL_CLICK'
      ? 'clicked'
      : event.eventType === 'EMAIL_OPEN'
        ? 'opened'
        : event.eventType === 'EMAIL_DELIVERED' || event.eventType === 'SMS_DELIVERED'
          ? 'delivered'
          : null
  if (!next || current === 'failed') return { matched: true }

  const patch: Record<string, string> = {}
  if (next === 'delivered') patch.delivered_at = nowIso
  if (next === 'opened') patch.email_opened_at = nowIso
  if (next === 'clicked') patch.link_clicked_at = nowIso
  if ((DELIVERY_RANK[next] ?? 0) > (DELIVERY_RANK[current] ?? 0)) patch.delivery_status = next

  await supabase.from('verification_attempts').update(patch).eq('id', attempt.id)
  return { matched: true }
}

async function notifyDriverTouchFailed(
  supabase: SupabaseClient,
  requestId: string,
  method: string,
): Promise<void> {
  const { data: row } = await supabase
    .from('employment_verification_requests')
    .select('id, driver_id, previous_employer_name')
    .eq('id', requestId)
    .maybeSingle()
  if (!row) return
  const kind = method === 'sms' ? 'text' : 'call'
  await createNotification({
    userId: String(row.driver_id),
    type: 'employment_verification',
    title: `The ${kind} to ${row.previous_employer_name ?? 'the previous employer'} did not go through`,
    body: 'Email follow-ups are unchanged. You can turn calls and texts off for this employer in the verification block.',
    actionUrl: EV_BLOCK_URL,
    data: { requestId, reason: 'touch_failed' },
  })
}

async function notifyDriverOfInbound(
  supabase: SupabaseClient,
  requestId: string,
  text: string | null,
  isSms: boolean,
): Promise<void> {
  const { data: row } = await supabase
    .from('employment_verification_requests')
    .select('id, driver_id, previous_employer_name')
    .eq('id', requestId)
    .maybeSingle()
  if (!row) return
  await createNotification({
    userId: String(row.driver_id),
    type: 'employment_verification',
    title: `${row.previous_employer_name ?? 'A previous employer'} replied by ${isSms ? 'text' : 'phone'}`,
    body: text?.trim() || 'Open the employment verification block to see the packet. A phone or text reply is not a verified answer.',
    actionUrl: EV_BLOCK_URL,
    data: { requestId, reason: 'touch_inbound' },
  })
}

/**
 * A bounce means the address is dead: pause the cadence and ask the driver
 * for a different contact. The failed attempt stays in the record — a bounced
 * send is still a documented attempt.
 */
async function markRequestNeedsContact(supabase: SupabaseClient, requestId: string): Promise<void> {
  const { data: row } = await supabase
    .from('employment_verification_requests')
    .select('id, driver_id, previous_employer_name, previous_employer_email, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!row || !OPEN_STATUSES.includes(String(row.status))) return

  await supabase
    .from('employment_verification_requests')
    .update({
      contact_research_status: 'pending',
      next_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  await createNotification({
    userId: String(row.driver_id),
    type: 'employment_verification',
    title: `Email to ${row.previous_employer_name ?? 'previous employer'} bounced`,
    body: `${row.previous_employer_email ?? 'The address on file'} did not accept our message. Look up a new contact or enter one, and we will resume sending.`,
    actionUrl: EV_BLOCK_URL,
    data: { requestId, reason: 'bounce' },
  })
}
