import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A finished MVR blocks another pull for 30 days so we do not buy the same
 * report twice. The exception is an identity mismatch: the state is saying
 * the name, birth date, or license number on the order was not the person.
 * That row is marked superseded (the report stays in the database) and a new
 * MVR is placed with the corrected fields. The SSN already on the consent
 * is reused — it is never part of the patch.
 */

const PATCH_KEYS = ['firstName', 'lastName', 'middleName', 'dlNumber', 'dlState', 'dob', 'dateOfBirth'] as const

const ACTIVE_MVR = ['pending', 'processing', 'completed', 'needs_review']

export function whitelistIdentityPatch(patch?: Record<string, string>): Record<string, string> | undefined {
  if (!patch) return undefined
  const out: Record<string, string> = {}
  for (const key of PATCH_KEYS) {
    const value = patch[key]
    if (typeof value === 'string') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Date-input value is YYYY-MM-DD. Stored consent dates are often YYYYMMDD. */
export function dobForDateInput(raw: string | null | undefined): string {
  const text = (raw ?? '').trim()
  if (!text) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return ''
}

export function storedIdentityFromForm(formData: Record<string, unknown> | null | undefined): {
  firstName: string
  lastName: string
  dlNumber: string
  dlState: string
  dob: string
} {
  const read = (key: string) => {
    const value = formData?.[key]
    return typeof value === 'string' ? value.trim() : ''
  }
  return {
    firstName: read('firstName'),
    lastName: read('lastName'),
    dlNumber: read('dlNumber'),
    dlState: read('dlState'),
    dob: read('dob') || read('dateOfBirth'),
  }
}

/** "Order parameter Last Name (DOE) did not match" → "last name". The value in parentheses stays off the line. */
export function mismatchFieldLabel(line: string): string {
  const match = /Order parameter\s+(.+?)\s*\(/i.exec(line)
  return match ? match[1].trim().toLowerCase() : ''
}

export function mismatchAlertsFromParsed(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== 'object') return []
  const raw = (parsed as { mismatchAlerts?: unknown }).mismatchAlerts
  if (!Array.isArray(raw)) return []
  return raw.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
}

export function mismatchFieldList(alerts: readonly string[]): string[] {
  const seen = new Set<string>()
  const fields: string[] = []
  for (const line of alerts) {
    const label = mismatchFieldLabel(line)
    if (!label || seen.has(label)) continue
    seen.add(label)
    fields.push(label)
  }
  return fields
}

function joinFields(fields: string[]): string {
  if (fields.length <= 1) return fields[0] ?? ''
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`
  return `${fields.slice(0, -1).join(', ')}, and ${fields[fields.length - 1]}`
}

/**
 * Employer driver-file sentence. Name and license number are what was sent
 * on that order. Date of birth and SSN are not included.
 */
export function orderedIdentitySentence(input: {
  firstName?: string | null
  lastName?: string | null
  dlNumber?: string | null
  dlState?: string | null
  alerts?: readonly string[]
}): string | null {
  const name = [input.firstName, input.lastName].filter((part) => part && part.trim()).join(' ').trim()
  const dlNumber = input.dlNumber?.trim() ?? ''
  const dlState = input.dlState?.trim() ?? ''
  const dl = [dlNumber, dlState].filter(Boolean).join(' · ')
  const ordered = [name ? `Ordered as ${name}` : '', dl ? `DL ${dl}` : ''].filter(Boolean).join(' · ')
  const fields = mismatchFieldList(input.alerts ?? [])
  const why = fields.length > 0 ? `State could not match ${joinFields(fields)}` : ''
  const sentence = [why, ordered].filter(Boolean).join('. ')
  return sentence || null
}

function xmlText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml)
  if (!match) return ''
  return match[1]
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/** Legal name from the order XML. Reads only the name tags — the XML also holds the SSN. */
export function nameFromOrderXml(xml: string | null | undefined): { firstName: string; lastName: string } {
  if (!xml) return { firstName: '', lastName: '' }
  return {
    firstName: xmlText(xml, 'name_first'),
    lastName: xmlText(xml, 'name_last'),
  }
}

/**
 * What this company's driver file should show beside a discrepancy.
 * Null when the report is not a discrepancy. The order XML is not returned.
 */
export async function orderedIdentityForMvr(
  supabase: SupabaseClient,
  orderId: string,
): Promise<string | null> {
  const { data: order } = await supabase
    .from('mvr_orders')
    .select('dl_number, dl_state, order_xml, result_outcome')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.result_outcome !== 'discrepancy') return null

  const { data: result } = await supabase
    .from('mvr_results')
    .select('parsed_data')
    .eq('mvr_order_id', orderId)
    .maybeSingle()

  const alerts = mismatchAlertsFromParsed(result?.parsed_data)
  const name = nameFromOrderXml(typeof order.order_xml === 'string' ? order.order_xml : null)
  return orderedIdentitySentence({
    firstName: name.firstName,
    lastName: name.lastName,
    dlNumber: typeof order.dl_number === 'string' ? order.dl_number : null,
    dlState: typeof order.dl_state === 'string' ? order.dl_state : null,
    alerts,
  })
}

/**
 * Latest finished MVR whose DMV notes say the ordered identity did not match.
 * Pending and processing orders are left alone.
 */
export async function findMvrIdentityMismatch(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<{ orderId: string; fields: string[] } | null> {
  const { data: order } = await supabase
    .from('mvr_orders')
    .select('id, status')
    .eq('driver_user_id', driverUserId)
    .in('status', ACTIVE_MVR)
    .order('ordered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order || order.status === 'pending' || order.status === 'processing') return null

  const { data: result } = await supabase
    .from('mvr_results')
    .select('parsed_data')
    .eq('mvr_order_id', order.id)
    .maybeSingle()

  const fields = mismatchFieldList(mismatchAlertsFromParsed(result?.parsed_data))
  if (fields.length === 0) return null
  return { orderId: order.id as string, fields }
}

/**
 * Drop the mismatched MVR out of the 30-day lock. The report row stays.
 * Returns an error when the latest order is still running or has no identity alert.
 */
export async function releaseMismatchedMvr(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mismatch = await findMvrIdentityMismatch(supabase, driverUserId)
  if (!mismatch) {
    return {
      ok: false,
      error: 'This report did not flag a name, date of birth, or license mismatch, so a new MVR stays blocked until the current one expires.',
    }
  }

  const { error } = await supabase
    .from('mvr_orders')
    .update({ status: 'superseded' })
    .eq('id', mismatch.orderId)
    .in('status', ['completed', 'needs_review'])

  if (error) {
    console.error('[MVR IDENTITY] Could not supersede mismatched order:', error)
    return { ok: false, error: 'Could not replace the earlier MVR. Try again.' }
  }

  return { ok: true }
}
