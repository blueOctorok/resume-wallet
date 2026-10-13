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

  const attemptNumber = attemptCount + 1
  const employerName = row.previous_employer_name ?? ''
  const emailResult = await sendVerificationEmailAndTrack(supabase, row.id, {
    to: email,
    verificationLink: `${baseUrl}/verify/${row.verification_token}`,
    previousEmployerName: employerName,
    claimedPosition: row.claimed_position ?? '',
    claimedCompanyName: employerName,
    claimedStartDate: row.claimed_start_date ?? undefined,
    claimedEndDate: row.claimed_end_date,
    attemptNumber,
    maxAttempts: EVR_MAX_ATTEMPTS,
  })
  if (!emailResult.ok) {
    console.warn(`[EVR OUTREACH] attempt ${attemptNumber} for ${row.id} failed to send:`, emailResult.error)
  }

  const now = new Date()
  await supabase.from('verification_attempts').insert({
    verification_request_id: row.id,
    attempt_number: attemptNumber,
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
      attempt_count: attemptNumber,
      last_attempt_at: now.toISOString(),
      status: 'VERIFICATION_IN_PROGRESS',
      next_attempt_at: nextAttemptAtAfter(attemptNumber, now),
      updated_at: now.toISOString(),
    })
    .eq('id', row.id)

  return { ok: true, attemptNumber, emailSent: emailResult.ok }
}

export interface CadenceSummary {
  due: number
  sent: number
  skipped: number
  exhausted: number
}

/** Hourly cron body: send due follow-ups, then close out packets nobody answered. */
export async function runOutreachCadence(
  supabase: SupabaseClient,
  baseUrl: string,
): Promise<CadenceSummary> {
  const summary: CadenceSummary = { due: 0, sent: 0, skipped: 0, exhausted: 0 }
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
  event: Pick<WebhookEvent, 'eventType' | 'trackingId' | 'failureCode'>,
): Promise<{ matched: boolean }> {
  if (!event.trackingId) return { matched: false }

  const { data: attempt } = await supabase
    .from('verification_attempts')
    .select('id, verification_request_id, delivery_status')
    .eq('provider_tracking_id', event.trackingId)
    .maybeSingle()
  if (!attempt) return { matched: false }

  const nowIso = new Date().toISOString()
  const current = String(attempt.delivery_status ?? 'sent')

  if (event.eventType === 'EMAIL_FAILED') {
    await supabase
      .from('verification_attempts')
      .update({ delivery_status: 'failed', failed_at: nowIso, failure_code: event.failureCode ?? 'bounce' })
      .eq('id', attempt.id)
    await markRequestNeedsContact(supabase, String(attempt.verification_request_id))
    return { matched: true }
  }

  const next =
    event.eventType === 'EMAIL_CLICK'
      ? 'clicked'
      : event.eventType === 'EMAIL_OPEN'
        ? 'opened'
        : event.eventType === 'EMAIL_DELIVERED'
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
