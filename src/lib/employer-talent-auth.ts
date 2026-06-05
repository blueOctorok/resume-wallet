import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves the employer's company from their wallet — same rules as
 * GET /api/employer/talent/[userId] (active membership, then legacy company row).
 */
export async function resolveEmployerCompanyForWallet(
  supabase: SupabaseClient,
  sessionUserId: string,
): Promise<{ employerUserId: string; companyId: string } | null> {
  const { data: employer } = await supabase
    .from('users')
    .select('id')
    .eq('id', sessionUserId)
    .single()

  if (!employer?.id) return null

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', employer.id)
    .eq('is_active', true)
    .single()

  let companyId = membership?.company_id ?? null
  if (!companyId) {
    const { data: legacyCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', employer.id)
      .single()
    companyId = legacyCompany?.id ?? null
  }

  if (!companyId) return null
  return { employerUserId: employer.id, companyId }
}
