import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from '@/lib/employer-permissions'

export interface EmployerCompanyAccess {
  employerUserId: string
  companyId: string
  /** Always concrete — never undefined, so a caller can't be bypassed by a missing role. */
  companyRole: string
  canManageEmployerBlocks: boolean
}

/**
 * Resolves the caller's company and membership role.
 *
 * Two fixes over the previous version:
 *   - It looked the caller up by `wallet_address` despite the parameter being a
 *     session user id, so any member created after the Supabase auth cutover
 *     (no wallet) resolved to null and was locked out.
 *   - `canManageEmployerBlocks` was hardcoded `true`, so the "owner/admin only"
 *     comments on the hub-block routes enforced nothing.
 */
export async function getEmployerCompanyAccess(
  supabase: SupabaseClient,
  sessionUserId: string,
): Promise<EmployerCompanyAccess | null> {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('id', sessionUserId)
    .maybeSingle()

  if (userErr || !user) return null

  // Prefer an accepted membership; an unaccepted invite row is not access.
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, role, accepted_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .not('accepted_at', 'is', null)
    .order('accepted_at', { ascending: true })
    .limit(1)

  const membership = memberships?.[0]

  if (membership?.company_id) {
    const companyRole = membership.role || 'recruiter'
    return {
      employerUserId: user.id,
      companyId: membership.company_id,
      companyRole,
      canManageEmployerBlocks: can(companyRole, 'manageCompany'),
    }
  }

  // Legacy rows predate company_members and use companies.employer_user_id as
  // an implicit owner link.
  const { data: legacy } = await supabase
    .from('companies')
    .select('id')
    .eq('employer_user_id', user.id)
    .maybeSingle()

  if (legacy?.id) {
    return {
      employerUserId: user.id,
      companyId: legacy.id,
      companyRole: 'owner',
      canManageEmployerBlocks: can('owner', 'manageCompany'),
    }
  }

  return null
}

export async function companyHasEmployerBlock(
  supabase: SupabaseClient,
  companyId: string,
  blockType: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('employer_hub_blocks')
    .select('id')
    .eq('company_id', companyId)
    .eq('block_type', blockType)
    .maybeSingle()
  return Boolean(data)
}

/**
 * MVR capability: company has the employer MVR ordering block installed.
 */
export async function companyCanOrderMvr(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-mvr-orders')
}

/**
 * PSP capability: company has the employer PSP ordering block (PSP Accio product still includes MVR suborder).
 */
export async function companyCanOrderPsp(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-psp-orders')
}

/** Collect bundled screening consent (FCRA + FMCSA + CDLIS) before MVR/PSP employer orders. */
export async function companyHasScreeningConsentBlock(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-screening-consent')
}
