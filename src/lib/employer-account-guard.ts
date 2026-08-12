import type { SupabaseClient } from '@supabase/supabase-js'

/** Roles that mean "this account is a driver/candidate identity, not an employer." */
const CANDIDATE_SURFACE_ROLES = new Set(['candidate', 'driver', 'developer'])

/**
 * True if this user is part of the employer product surface: company owner,
 * active team member, or DB role still set to employer. Used to block switching
 * to candidate on the same account.
 */
export async function isUserEmployerLinked(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (userRow?.role === 'employer') return true

  const { data: owned } = await supabase
    .from('companies')
    .select('id')
    .eq('employer_user_id', userId)
    .limit(1)
    .maybeSingle()

  if (owned) return true

  const { data: membership } = await supabase
    .from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return Boolean(membership)
}

/**
 * True when this account is already a candidate identity.
 *
 * Candidate and employer must not share one login: the same person can be both
 * in real life, but they need two emails / Auth users. Silently flipping a
 * candidate row to employer is how invited drivers ended up on the wrong side.
 */
export function isCandidateSurfaceRole(role: string | null | undefined): boolean {
  if (!role) return false
  return CANDIDATE_SURFACE_ROLES.has(role)
}

export async function isUserCandidateAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return isCandidateSurfaceRole(userRow?.role)
}

/** Shared API copy — admin create, claim, and team-invite accept. */
export const CANDIDATE_CANNOT_BECOME_EMPLOYER =
  'This email already has a candidate account. Employer access needs a different email address — the same login cannot be both a driver and a company account.'
