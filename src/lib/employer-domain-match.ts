/**
 * Single source of truth for employer email-domain policy.
 *
 * Three divergent public-domain lists used to live in this file, in
 * /api/employer/team, and in AccessRequestsTab, so the same address was judged
 * differently depending on the path (@proton.me and @googlemail.com blocked by
 * one and allowed by another; @gmx.com, @zoho.com and @yandex.com the reverse).
 * Everything now imports from here.
 *
 * The company's boundary is `companies.allowed_email_domains`, set deliberately
 * by an admin at creation. It used to be inferred from `companies.email` — a
 * contact field doubling as a security field, which silently disappeared when a
 * company's founding owner happened to sign up with Gmail.
 */

/**
 * Consumer inboxes. A company can never be identified by one of these, so they
 * are rejected for team invites unless the company is explicitly domainless.
 */
export const PUBLIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'yandex.com',
  'inbox.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
])

/** Lowercased host portion of an email, or '' when absent/malformed. */
export function domainFromEmail(email: string | null | undefined): string {
  if (!email?.includes('@')) return ''
  return email.split('@')[1]?.toLowerCase().trim() ?? ''
}

export function isPublicEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return true
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase().trim())
}

export function isPublicEmailAddress(email: string | null | undefined): boolean {
  return isPublicEmailDomain(domainFromEmail(email))
}

/** Normalize admin input ("@Pace Drivers.com ", "https://pacedrivers.com") to a bare host. */
export function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '')
}

export function parseAllowedDomainsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map(normalizeDomainInput)
        .filter((d) => d.includes('.'))
    )
  )
}

export interface CompanyDomainCheck {
  /** From companies.allowed_email_domains. null = never configured, [] = deliberately domainless. */
  allowedDomains: string[] | null | undefined
  email: string
  companyName: string
  /** companies.email / designated_owner_email — legacy fallback for rows predating the column. */
  legacyCompanyEmail?: string | null
}

export interface DomainCheckResult {
  allowed: boolean
  /** Present only when `allowed` is false. Flat rather than a discriminated union
   *  because the project compiles with `strict: false`, where narrowing on a
   *  literal boolean doesn't work. */
  error?: string
  details?: string
}

/**
 * Whether an address may be invited onto a company.
 *
 * Three states, deliberately distinguishable:
 *   - a non-empty list  → the address must be on it
 *   - `[]`              → domainless by admin decision; the owner vouches for
 *                         each member, and this is the ONLY case where a
 *                         consumer inbox is acceptable
 *   - `null`            → never configured (legacy row). Public domains are
 *                         blocked and we fall back to matching the company's
 *                         contact email, which is the old behaviour.
 */
export function checkEmailAgainstCompanyDomains({
  allowedDomains,
  email,
  companyName,
  legacyCompanyEmail,
}: CompanyDomainCheck): DomainCheckResult {
  const inviteDomain = domainFromEmail(email)

  if (!inviteDomain) {
    return {
      allowed: false,
      error: 'A valid email address is required',
      details: 'Enter a full address, for example name@yourcompany.com.',
    }
  }

  // Explicitly domainless — the admin chose this, so consumer inboxes are fine.
  if (Array.isArray(allowedDomains) && allowedDomains.length === 0) {
    return { allowed: true }
  }

  if (isPublicEmailDomain(inviteDomain)) {
    return {
      allowed: false,
      error: 'Personal email addresses are not allowed for team members',
      details: `Use a company email address (e.g. name@yourcompany.com). If ${companyName} has no company domain, a Provven admin can mark it domainless.`,
    }
  }

  if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
    if (allowedDomains.includes(inviteDomain)) return { allowed: true }
    return {
      allowed: false,
      error: `Team members must use a ${companyName} email address`,
      details: `Allowed ${allowedDomains.length === 1 ? 'domain' : 'domains'}: ${allowedDomains
        .map((d) => `@${d}`)
        .join(', ')}.`,
    }
  }

  // Legacy row with no configured domain.
  const legacyDomain = domainFromEmail(legacyCompanyEmail)
  if (legacyDomain && !isPublicEmailDomain(legacyDomain) && inviteDomain !== legacyDomain) {
    return {
      allowed: false,
      error: `Team members must use a company email address (@${legacyDomain})`,
      details: `${companyName} requires team members to have a @${legacyDomain} email address.`,
    }
  }

  return { allowed: true }
}
