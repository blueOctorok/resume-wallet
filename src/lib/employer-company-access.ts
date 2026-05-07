import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmployerCompanyAccess {
  employerUserId: string
  companyId: string
  companyRole: string
  canManageEmployerBlocks: boolean
}

/**
 * Resolves the employer's primary company + membership role from wallet.
 * Legacy rows use companies.employer_user_id as implicit owner.
 */
export async function getEmployerCompanyAccess(
  supabase: SupabaseClient,
  walletAddress: string,
): Promise<EmployerCompanyAccess | null> {
  const normalized = walletAddress.toLowerCase().trim()

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .ilike('wallet_address', normalized)
    .maybeSingle()

  if (userErr || !user) return null

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membership?.company_id) {
    const r = membership.role ?? 'recruiter'
    return {
      employerUserId: user.id,
      companyId: membership.company_id,
      companyRole: r,
      canManageEmployerBlocks: r === 'owner' || r === 'admin',
    }
  }

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
      canManageEmployerBlocks: true,
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
