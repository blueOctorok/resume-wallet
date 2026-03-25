import { getBlockDefinition } from '@/lib/block-registry'

export type InviteSmsContext = {
  companyName: string
  inviteUrl: string
  targetBlockType: string | null
  candidateName?: string | null
  jobTitle?: string | null
}

/**
 * Short SMS copy for outreach — mirrors email intent (registry block label) without HTML.
 */
export function buildCandidateInviteSmsBody(ctx: InviteSmsContext): string {
  const block = ctx.targetBlockType ? getBlockDefinition(ctx.targetBlockType) : null
  const label = block?.label ?? 'your invite'
  const first = ctx.candidateName?.trim().split(/\s+/)[0]
  const hi = first ? `${first}, ` : ''
  const job = ctx.jobTitle ? ` (${ctx.jobTitle})` : ''
  return `${hi}${ctx.companyName} invited you to complete ${label}${job} on StormChain:\n${ctx.inviteUrl}`
}

/** E.164-style for `sms:` links: US 10/11 digit, or explicit +country… (10–15 digits total). */
export function normalizeSmsPhone(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('+')) {
    const d = t.slice(1).replace(/\D/g, '')
    if (d.length >= 10 && d.length <= 15) return `+${d}`
    return null
  }
  const d = t.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

/**
 * Opens the device SMS app with optional recipient and body (no server — sms: URL).
 */
export function buildSmsHref(phoneE164: string | null, body: string): string {
  const encoded = encodeURIComponent(body)
  if (phoneE164) {
    return `sms:${phoneE164}?body=${encoded}`
  }
  // No recipient: open compose with body prefilled (user picks contact in the messaging app).
  return `sms:?body=${encoded}`
}
