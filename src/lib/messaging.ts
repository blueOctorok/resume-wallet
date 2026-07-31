/**
 * Thin messaging layer — Pingram for email + SMS.
 *
 * Call sites should use these helpers (not Resend/Pingram SDKs directly) so we
 * can finish the Resend cutover without touching every send site again.
 *
 * Env:
 *   PINGRAM_API_KEY      — required for sends
 *   PINGRAM_FROM_EMAIL   — default: zknight@verify.zknight.io
 *   PINGRAM_FROM_NAME    — default: ZKnight
 */

import { Pingram } from 'pingram'

export type MessagingResult = {
  ok: boolean
  error?: string
  /** Pingram tracking id when available */
  id?: string
}

export type SendEmailParams = {
  /** Notification type id (e.g. 'invite_email') — used for Pingram analytics */
  type: string
  /** One recipient, or several (sent as separate Pingram calls) */
  to: string | string[]
  subject: string
  html: string
  fromName?: string
  fromAddress?: string
}

export type SendSmsParams = {
  type: string
  /** E.164 phone, e.g. +16175551212 */
  to: string
  message: string
}

const FROM_EMAIL = process.env.PINGRAM_FROM_EMAIL ?? 'zknight@verify.zknight.io'
const FROM_NAME = process.env.PINGRAM_FROM_NAME ?? 'ZKnight'

let client: Pingram | null | undefined

function getClient(): Pingram | null {
  if (client !== undefined) return client
  const apiKey = process.env.PINGRAM_API_KEY
  if (!apiKey) {
    client = null
    return client
  }
  client = new Pingram({ apiKey })
  return client
}

export function isMessagingConfigured(): boolean {
  return Boolean(process.env.PINGRAM_API_KEY)
}

/**
 * Send a transactional email via Pingram.
 */
export async function sendEmail(params: SendEmailParams): Promise<MessagingResult> {
  const pingram = getClient()
  if (!pingram) {
    console.warn('[MESSAGING] PINGRAM_API_KEY not set, skipping email')
    return { ok: false, error: 'Email not configured' }
  }

  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => e.trim())
    .filter(Boolean)
  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients' }
  }

  const fromName = params.fromName ?? FROM_NAME
  const fromAddress = params.fromAddress ?? FROM_EMAIL
  const ids: string[] = []

  try {
    // Pingram's /email endpoint takes one `to` per call — fan out for arrays.
    for (const to of recipients) {
      const res = await pingram.email.send({
        type: params.type,
        to,
        subject: params.subject,
        html: params.html,
        fromName,
        fromAddress,
      })

      if (res?.error?.message) {
        console.error('[MESSAGING] Pingram email error to=%s:', to, res.error)
        return { ok: false, error: res.error.message }
      }
      if (!res?.trackingId) {
        console.error('[MESSAGING] Pingram email: no trackingId to=%s', to, res)
        return { ok: false, error: 'Pingram email: empty response' }
      }
      ids.push(res.trackingId)
    }

    console.log(
      '[MESSAGING] Email sent type=%s recipients=%s ids=%s',
      params.type,
      recipients.length,
      ids.join(','),
    )
    return { ok: true, id: ids[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[MESSAGING] Email send failed:', err)
    return { ok: false, error: message }
  }
}

/**
 * Send an SMS via Pingram. Requires A2P 10DLC for production US traffic.
 */
export async function sendSms(params: SendSmsParams): Promise<MessagingResult> {
  const pingram = getClient()
  if (!pingram) {
    console.warn('[MESSAGING] PINGRAM_API_KEY not set, skipping SMS')
    return { ok: false, error: 'SMS not configured' }
  }

  try {
    const res = await pingram.sms.send({
      type: params.type,
      to: params.to,
      message: params.message,
    })

    if (res && typeof res === 'object' && 'error' in res && (res as { error?: unknown }).error) {
      console.error('[MESSAGING] Pingram SMS error:', (res as { error: unknown }).error)
      return { ok: false, error: 'Pingram SMS error' }
    }

    const id =
      res && typeof res === 'object' && 'trackingId' in res
        ? String((res as { trackingId?: unknown }).trackingId ?? '')
        : undefined
    console.log('[MESSAGING] SMS sent type=%s to=%s id=%s', params.type, params.to, id || '(none)')
    return { ok: true, id: id || undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[MESSAGING] SMS send failed:', err)
    return { ok: false, error: message }
  }
}
