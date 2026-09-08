import type { SupabaseClient } from '@supabase/supabase-js'
import {
  domainsAlign,
  emailDomain,
  sha256Hex,
  verifyDkimRfc822,
} from '@/lib/dkim-verify'

export interface PingramInboundEmail {
  eventType?: string
  from?: string
  to?: string
  subject?: string
  bodyText?: string
  bodyHtml?: string
  trackingId?: string
  messageId?: string
  receivedAt?: string
  /** Present if Pingram (or another MTA) forwards the original RFC822 */
  raw?: string
  rawMime?: string
  rfc822?: string
  source?: string
  attachments?: Array<{
    filename?: string
    contentType?: string
    content?: string
  }>
}

const CONFIRM_RE =
  /\b(yes|confirm|confirmed|correct|verified|i confirm|dates are correct)\b/i
const DENY_RE = /\b(no|incorrect|deny|denied|never worked|did not work)\b/i

export function looksLikeEmploymentConfirmation(body: string): boolean {
  const text = body.trim()
  if (!text) return false
  if (DENY_RE.test(text) && !CONFIRM_RE.test(text)) return false
  return CONFIRM_RE.test(text)
}

function extractRawRfc822(payload: PingramInboundEmail): string | null {
  const direct =
    payload.raw || payload.rawMime || payload.rfc822 || payload.source || ''
  if (direct.trim()) return direct

  const eml = payload.attachments?.find((a) => {
    const type = String(a.contentType ?? '').toLowerCase()
    const name = String(a.filename ?? '').toLowerCase()
    return type.includes('rfc822') || name.endsWith('.eml')
  })
  if (eml?.content) {
    try {
      return Buffer.from(eml.content, 'base64').toString('utf8')
    } catch {
      return eml.content
    }
  }
  return null
}

function bodyText(payload: PingramInboundEmail): string {
  if (payload.bodyText?.trim()) return payload.bodyText
  return String(payload.bodyHtml ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match a Pingram (or RFC822) inbound reply to an open EVR request and persist DKIM + body hash.
 * Form-path verifications are unchanged; Midnight prove still requires dkim_valid.
 */
export async function processEvrInboundEmail(
  supabase: SupabaseClient,
  payload: PingramInboundEmail,
): Promise<{ ok: true; requestId: string; dkimValid: boolean } | { ok: false; error: string }> {
  if (payload.eventType && payload.eventType !== 'EMAIL_INBOUND') {
    return { ok: false, error: `ignored event ${payload.eventType}` }
  }

  const from = String(payload.from ?? '').trim().toLowerCase()
  if (!from || !from.includes('@')) {
    return { ok: false, error: 'inbound from address missing' }
  }

  const trackingId = String(payload.trackingId ?? '').trim()
  let request: Record<string, unknown> | null = null

  if (trackingId) {
    const { data } = await supabase
      .from('employment_verification_requests')
      .select(
        'id, driver_id, previous_employer_email, previous_employer_name, claimed_start_date, claimed_end_date, status',
      )
      .eq('pingram_tracking_id', trackingId)
      .maybeSingle()
    request = data
  }

  if (!request) {
    const { data: openRows } = await supabase
      .from('employment_verification_requests')
      .select(
        'id, driver_id, previous_employer_email, previous_employer_name, claimed_start_date, claimed_end_date, status',
      )
      .in('status', ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(40)

    request =
      (openRows ?? []).find((row) =>
        domainsAlign(row.previous_employer_email as string | null, from),
      ) ?? null
  }

  if (!request) {
    return { ok: false, error: 'no matching employment verification request' }
  }

  if (
    ['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'VERIFICATION_DECLINED'].includes(
      String(request.status),
    )
  ) {
    return { ok: false, error: 'verification already completed' }
  }

  const invited = request.previous_employer_email as string | null
  if (!domainsAlign(invited, from)) {
    return { ok: false, error: 'from domain does not match invited employer email' }
  }

  const raw = extractRawRfc822(payload)
  let dkimValid = false
  let dkimDomain: string | null = null
  if (raw) {
    const dkim = await verifyDkimRfc822(raw)
    dkimValid = dkim.pass && domainsAlign(invited, dkim.domain)
    dkimDomain = dkim.domain
    if (dkim.pass && !dkimValid) {
      return { ok: false, error: `DKIM domain ${dkim.domain} does not align with invited mailbox` }
    }
  }

  const body = bodyText(payload)
  const confirmed = looksLikeEmploymentConfirmation(body)
  const denied = DENY_RE.test(body) && !confirmed

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    inbound_from_email: from,
    inbound_from_domain: emailDomain(from),
    inbound_body_hash: body ? sha256Hex(body) : null,
    inbound_received_at: payload.receivedAt ?? now,
    dkim_valid: dkimValid,
    dkim_domain: dkimDomain,
    verification_method: 'email',
    verified_by_email: from,
    updated_at: now,
  }

  if (raw) {
    patch.inbound_rfc822 = raw
  }

  if (denied) {
    patch.status = 'VERIFICATION_DENIED'
    patch.verified_at = now
    patch.dates_correct = 'no'
  } else if (confirmed || dkimValid) {
    // DKIM-valid reply from the invited domain is enough to mark verified even
    // if they only wrote "ok" — the signature is the issuer artifact.
    patch.status = 'VERIFIED'
    patch.verified_at = now
    patch.dates_correct = 'yes'
  }

  const { error } = await supabase
    .from('employment_verification_requests')
    .update(patch)
    .eq('id', request.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  if (patch.status === 'VERIFIED' || patch.status === 'VERIFICATION_DENIED') {
    const { notifyDriverEvrReturned } = await import('@/lib/notify-evr-returned')
    void notifyDriverEvrReturned(supabase, {
      driverId: String(request.driver_id),
      employerName: String(request.previous_employer_name ?? ''),
    }).catch((err) => console.warn('[EVR INBOUND] Driver notify non-fatal:', err))
  }

  return { ok: true, requestId: String(request.id), dkimValid }
}

/** Store Pingram's send id so inbound EMAIL_INBOUND can match this EVR. */
export async function persistPingramTrackingId(
  supabase: SupabaseClient,
  requestId: string,
  trackingId: string | undefined,
): Promise<void> {
  const id = trackingId?.trim()
  if (!id) return
  const { error } = await supabase
    .from('employment_verification_requests')
    .update({ pingram_tracking_id: id, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) {
    console.warn('[EVR] Failed to persist Pingram tracking id:', error.message)
  }
}
