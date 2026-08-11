/**
 * Employer company roles: display labels and API values.
 * DB stores granular roles; we show a simple 3-role model: Owner, Admin, Team member, Viewer.
 * Only admins (and owner) can change roles; role is applied per wallet per company.
 */

/** DB role values that can be stored in company_members.role */
export const DB_ROLE_OWNER = 'owner'
export const DB_ROLE_ADMIN = 'admin'
/** Any of these are displayed as "Team member" */
export const DB_ROLE_MEMBER = 'recruiter' // used when inviting "Team member"; other legacy values map to same label
export const DB_ROLE_VIEWER = 'viewer'

/**
 * Roles that can manage team (invite, remove, change role).
 * Re-exported from the permission helper so the list exists in exactly one place —
 * this constant used to be declared here and then re-declared inside each team
 * route, which is how the routes drifted apart from it.
 */
export { TEAM_ADMIN_ROLES } from '@/lib/employer-permissions'

/** Roles we allow when inviting (no owner - that's by claim only) */
export const INVITEABLE_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to manage team and all data' },
  { value: 'recruiter', label: 'Team member', description: 'Post jobs, review applicants, manage pipeline' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards' },
] as const

/** DB roles that display as "Team member" */
const MEMBER_DB_ROLES = new Set([
  'hr_manager',
  'hiring_manager',
  'recruiter',
  'interviewer',
])

export type DisplayRole = 'Owner' | 'Admin' | 'Team member' | 'Viewer'

/**
 * Map DB role (from company_members.role) to the label shown in the UI.
 * Used for the hub badge and team list.
 */
export function getDisplayRole(dbRole: string | null | undefined): DisplayRole {
  if (!dbRole) return 'Team member'
  switch (dbRole) {
    case 'owner':
      return 'Owner'
    case 'admin':
      return 'Admin'
    case 'viewer':
      return 'Viewer'
    default:
      return MEMBER_DB_ROLES.has(dbRole) ? 'Team member' : 'Team member'
  }
}
