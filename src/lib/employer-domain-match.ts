/**
 * Decide whether a requester's work email domain is allowed to auto-join an existing company.
 *
 * Exact match against the company's stored email is ideal, but many company rows were created
 * with a personal email or empty `email` / `designated_owner_email`. In those cases we still
 * allow instant join when the domain's first label clearly matches the company name
 * (e.g. "Pace Drivers" + @pacedrivers.com).
 */

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'live.com',
  'msn.com',
  'me.com',
  'googlemail.com',
])

export function normalizeCompanyNameSlug(companyName: string): string {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function domainFromEmail(email: string | null | undefined): string {
  if (!email?.includes('@')) return ''
  return email.split('@')[1]?.toLowerCase().trim() ?? ''
}

/**
 * True if the company record's email uses a consumer domain (or is missing), so we may use
 * name↔domain slug matching instead of relying only on exact domain equality.
 */
export function companyEmailDomainIsWeak(companyRecordEmail: string | null | undefined): boolean {
  const d = domainFromEmail(companyRecordEmail ?? '')
  return !d || PUBLIC_EMAIL_DOMAINS.has(d)
}

/**
 * Requester must not use a public inbox for auto-join.
 */
export function isPublicEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return true
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase().trim())
}

/**
 * First label of host (e.g. pacedrivers.com -> pacedrivers).
 */
function registrableStyleLabel(emailDomain: string): string {
  return emailDomain.toLowerCase().split('.')[0] ?? ''
}

/**
 * Slug match with guardrails: short names only get equality, not substring tricks.
 */
function slugAlignsWithDomainRoot(companyName: string, emailDomain: string): boolean {
  const slug = normalizeCompanyNameSlug(companyName)
  const root = registrableStyleLabel(emailDomain)
  if (!slug || !root || slug.length < 3 || root.length < 3) return false
  if (root === slug) return true
  const minLen = Math.min(root.length, slug.length)
  // Avoid "acme" ⊂ "acmeevil" style bypasses for tiny slugs
  if (minLen >= 6 && (root.includes(slug) || slug.includes(root))) return true
  return false
}

/**
 * Returns true when the requester should auto-join the existing company without admin review.
 */
export function emailDomainAllowsEmployerJoin(
  companyName: string,
  requesterEmailDomain: string | null | undefined,
  companyRecordEmail: string | null | undefined,
): boolean {
  const rd = requesterEmailDomain?.toLowerCase().trim() ?? ''
  if (!rd || isPublicEmailDomain(rd)) return false

  const companyDomain = domainFromEmail(companyRecordEmail ?? '')
  if (companyDomain && rd === companyDomain) return true

  if (!companyEmailDomainIsWeak(companyRecordEmail)) {
    // Company has a non-public domain on file that didn't match — do not infer from name
    return false
  }

  return slugAlignsWithDomainRoot(companyName, rd)
}
