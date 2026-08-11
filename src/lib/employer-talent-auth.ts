import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'

/**
 * Resolves the caller's company for talent/screening routes.
 *
 * Kept as a thin alias over `getEmployerCompanyAccess` rather than a second
 * implementation. The two used to be separate and had drifted: this one accepted
 * an unaccepted invite row as access and exposed no role, so every route built on
 * it could only ask "are you in a company?" and never "may you do this?".
 *
 * The name is a leftover from the wallet era — the parameter has been a Supabase
 * session user id since the D3.4 auth cutover.
 */
export async function resolveEmployerCompanyForWallet(
  supabase: SupabaseClient,
  sessionUserId: string,
): Promise<{ employerUserId: string; companyId: string; companyRole: string } | null> {
  const access = await getEmployerCompanyAccess(supabase, sessionUserId)
  if (!access) return null
  return {
    employerUserId: access.employerUserId,
    companyId: access.companyId,
    companyRole: access.companyRole,
  }
}
