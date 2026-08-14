import { createHash } from 'node:crypto'
import { dkimVerify } from 'mailauth/lib/dkim/verify.js'

export interface DkimCheckResult {
  pass: boolean
  domain: string | null
  selector: string | null
  reason: string
}

interface MailauthDkimRow {
  signingDomain?: string
  selector?: string
  status?: { result?: string; comment?: string }
}

/**
 * Verify DKIM over a raw RFC822 message.
 * Pingram inbound JSON is not enough — we need the original bytes (raw / .eml).
 */
export async function verifyDkimRfc822(rawRfc822: string): Promise<DkimCheckResult> {
  const trimmed = rawRfc822.trim()
  if (!trimmed) {
    return { pass: false, domain: null, selector: null, reason: 'empty message' }
  }

  const verified = (await dkimVerify(trimmed)) as { results?: MailauthDkimRow[] }
  const rows = verified.results ?? []
  const passed = rows.find((r) => r.status?.result === 'pass')
  if (passed) {
    return {
      pass: true,
      domain: (passed.signingDomain ?? '').toLowerCase() || null,
      selector: passed.selector ?? null,
      reason: 'dkim=pass',
    }
  }

  const first = rows[0]
  return {
    pass: false,
    domain: first?.signingDomain?.toLowerCase() ?? null,
    selector: first?.selector ?? null,
    reason: first?.status?.result
      ? `dkim=${first.status.result}`
      : 'no DKIM signature',
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function emailDomain(email: string | null | undefined): string | null {
  const at = String(email ?? '').trim().toLowerCase().lastIndexOf('@')
  if (at < 0) return null
  const domain = String(email).trim().toLowerCase().slice(at + 1)
  return domain || null
}

/** Invited mailbox domain must match From: / DKIM d= (or a parent of it). */
export function domainsAlign(
  invitedEmail: string | null | undefined,
  fromOrDkimDomain: string | null | undefined,
): boolean {
  const invited = emailDomain(invitedEmail)
  const raw = String(fromOrDkimDomain ?? '').trim().toLowerCase()
  const got = raw.includes('@') ? emailDomain(raw) : raw
  if (!invited || !got) return false
  return got === invited || got.endsWith(`.${invited}`) || invited.endsWith(`.${got}`)
}
