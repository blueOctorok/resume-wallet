import type { CompanyAccountTier } from '@/lib/company-account-tier'

/**
 * Who may open a driver's full DOT application.
 *
 * Agency accounts (the full-suite tier Pace is on) open it directly.
 * Every other company sees the career card until the driver accepts a
 * request to share the file with that company.
 */
export function dotApplicationViewAllowed(input: {
  accountTier: CompanyAccountTier
  driverAcceptedShare: boolean
}): boolean {
  return input.accountTier === 'agency' || input.driverAcceptedShare
}
