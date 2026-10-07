/**
 * Which employer hub a company gets. Stored on `companies.account_tier`.
 *
 * carrier — came to find drivers. Find Drivers / Your outreach / Messages.
 *           Screening blocks get installed one at a time, on first use.
 * agency  — full suite: jobs, applicants, team, every screening block.
 */
export const COMPANY_ACCOUNT_TIERS = ['carrier', 'agency'] as const
export type CompanyAccountTier = (typeof COMPANY_ACCOUNT_TIERS)[number]

export function isCompanyAccountTier(value: unknown): value is CompanyAccountTier {
  return typeof value === 'string' && (COMPANY_ACCOUNT_TIERS as readonly string[]).includes(value)
}

/**
 * Rows read before migration 114 ran have no column. Falling back to agency
 * keeps today's behaviour (full hub, blocks preinstalled) until the migration
 * lands, so a code deploy ahead of the migration changes nothing.
 */
export function toCompanyAccountTier(value: unknown): CompanyAccountTier {
  return isCompanyAccountTier(value) ? value : 'agency'
}
