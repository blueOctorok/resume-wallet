import type { SupabaseClient } from '@supabase/supabase-js'
import type { PingramInboundEmail } from '@/lib/evr-inbound'

/**
 * Pingram catches every message on verify.provven.com. The public address
 * support@provven.com and info@provven.com are on the apex, so each one has to be
 * forwarded to the same name at verify.provven.com before it shows up here.
 * Employment-verification replies (evr-<id>@verify.provven.com) are not support mail.
 */
export const SUPPORT_ADDRESSES = [
  'support@provven.com',
  'support@verify.provven.com',
  'info@provven.com',
  'info@verify.provven.com',
] as const

const BODY_LIMIT = 20000

export function mailboxAddresses(raw: string | null | undefined): string[] {
  return [
    ...String(raw ?? '')
      .toLowerCase()
      .matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g),
  ].map((match) => match[0])
}

export function isSupportRecipient(to: string | null | undefined): boolean {
  return mailboxAddresses(to).some((email) =>
    (SUPPORT_ADDRESSES as readonly string[]).includes(email),
  )
}

export function parseMailbox(raw: string | null | undefined): { name: string | null; email: string } {
  const text = String(raw ?? '').trim()
  const email = mailboxAddresses(text)[0] ?? ''
  const name = text
    .replace(/<[^>]+>/g, '')
    .replace(/["']/g, '')
    .trim()
  if (!name || name.toLowerCase() === email) return { name: null, email }
  return { name: name.slice(0, 120), email }
}

export function supportBodyText(payload: Pick<PingramInboundEmail, 'bodyText' | 'bodyHtml'>): string {
  const plain = payload.bodyText?.trim()
  const source = plain
    ? plain
    : String(payload.bodyHtml ?? '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
  return source.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, BODY_LIMIT)
}

export async function saveSupportInbound(
  supabase: SupabaseClient,
  payload: PingramInboundEmail,
): Promise<{ ok: true; id: string; duplicate: boolean } | { ok: false; error: string }> {
  if (!isSupportRecipient(payload.to)) {
    return { ok: false, error: 'not a support address' }
  }

  const from = parseMailbox(payload.from)
  if (!from.email) return { ok: false, error: 'inbound from address missing' }

  const to = mailboxAddresses(payload.to).find((email) =>
    (SUPPORT_ADDRESSES as readonly string[]).includes(email),
  )
  const externalId = payload.messageId?.trim() || null

  if (externalId) {
    const { data: existing } = await supabase
      .from('support_messages')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle()
    if (existing?.id) return { ok: true, id: existing.id as string, duplicate: true }
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      direction: 'inbound',
      external_id: externalId,
      from_email: from.email,
      from_name: from.name,
      to_email: to ?? 'support@provven.com',
      subject: String(payload.subject ?? '').trim().slice(0, 300),
      body_text: supportBodyText(payload),
      received_at: payload.receivedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error?.code === '23505' && externalId) {
    const { data: raced } = await supabase
      .from('support_messages')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle()
    if (raced?.id) return { ok: true, id: raced.id as string, duplicate: true }
  }

  if (error || !data) {
    console.error('[SUPPORT INBOX] insert failed:', error)
    return { ok: false, error: 'Could not store the support message' }
  }

  return { ok: true, id: data.id as string, duplicate: false }
}
