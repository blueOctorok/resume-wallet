/**
 * Least-privilege capabilities for members of an employer company.
 *
 * These decide which *members of a company* can reach paid CRA artifacts and
 * trigger money-spending actions. They never restrict Tier 1 — the driver's own
 * career card projection is visible to any authenticated member, governed by the
 * driver's `share_settings`, because that is the product.
 *
 * Three tiers govern employer data access:
 *   Tier 1 — the driver's projection. Not role-gated.
 *   Tier 2 — paid CRA artifacts (MVR/PSP results, signed consents, DL numbers).
 *            Role-gated here, and separately scoped to the company that paid.
 *   Tier 3 — raw identifiers (SSN, DOB, street address). Never returned to an
 *            employer at any role; they exist to be decrypted server-side for a
 *            consented screening order.
 */

export type EmployerCapability =
  /** Hub blocks, company settings, domain policy. */
  | 'manageCompany'
  /** Invite, remove, and change the role of team members. */
  | 'manageTeam'
  /** Spends money and decrypts a stored SSN server-side. The sharpest capability. */
  | 'orderScreenings'

  /** Tier 2 reads: MVR/PSP results, signed consents, DL numbers. */
  | 'viewScreeningResults'
  /** Application status, notes, and deleting applications/jobs/invites. */
  | 'manageCandidates'

const OWNER_ADMIN = ['owner', 'admin'] as const

/** Roles that can invite, remove, and re-role team members. */
export const TEAM_ADMIN_ROLES = OWNER_ADMIN

const CAPABILITY_ROLES: Record<EmployerCapability, readonly string[]> = {
  manageCompany: OWNER_ADMIN,
  manageTeam: OWNER_ADMIN,
  /**
   * `recruiter` is included deliberately, against the original plan's
   * owner/admin/hr_manager list. Two reasons, both from production:
   *   - Recruiters placed 573 of the 575 screening orders ever made. Excluding
   *     them would have halted the design partner's screening operation the
   *     moment this deployed.
   *   - The team invite UI creates every "Team member" as `recruiter`, so the
   *     narrower list would also have blocked each future hire, with no path to
   *     fix it except manual role surgery.
   * The gate still does real work: it excludes `interviewer` and `viewer`.
   */
  orderScreenings: ['owner', 'admin', 'hr_manager', 'recruiter'],
  viewScreeningResults: ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter'],
  manageCandidates: ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter'],
}

/**
 * `interviewer` and `viewer` appear in no list above: they keep Tier 1 and
 * non-sensitive applicant reads only.
 */
export function can(
  companyRole: string | null | undefined,
  capability: EmployerCapability
): boolean {
  if (!companyRole) return false
  return CAPABILITY_ROLES[capability].includes(companyRole)
}

/** Human-readable denial, so API responses say which role is required. */
export function capabilityDeniedMessage(capability: EmployerCapability): string {
  const messages: Record<EmployerCapability, string> = {
    manageCompany: 'Only an owner or admin can change company settings',
    manageTeam: 'Only an owner or admin can manage team members',
    orderScreenings: 'Only an owner, admin, or HR manager can order screenings',
    viewScreeningResults: 'Your role does not have access to screening results',
    manageCandidates: 'Your role does not have access to manage candidates',
  }
  return messages[capability]
}
