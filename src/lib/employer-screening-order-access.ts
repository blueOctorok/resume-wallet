import type { SupabaseClient } from '@supabase/supabase-js'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'

/**
 * Whether a consenting employer may view a candidate's screening order.
 *
 * - Company-paid: `ordered_by_company_id` matches the viewer's company.
 * - Driver-owned: NULL company on order + complete screening_consent_bundles
 *   for that employer↔candidate pair (P3.4-C — consenting agency sees pre-screen).
 */
export async function employerHasScreeningConsentWithCandidate(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('screening_consent_bundles')
    .select('id')
    .eq('company_id', companyId)
    .eq('driver_user_id', candidateUserId)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle()

  return Boolean(data?.id)
}

export async function employerCanAccessCandidateScreeningOrder(
  supabase: SupabaseClient,
  params: {
    companyId: string
    candidateUserId: string
    order: { ordered_by_company_id?: string | null }
  },
): Promise<boolean> {
  const { companyId, candidateUserId, order } = params

  if (order.ordered_by_company_id === companyId) return true

  if (isDriverOwnedScreeningOrder(order)) {
    return employerHasScreeningConsentWithCandidate(supabase, companyId, candidateUserId)
  }

  return false
}

/** Load MVR order for employer view — company-paid OR consenting-company driver-owned. */
export async function fetchEmployerAccessibleMvrOrder<T extends string>(
  supabase: SupabaseClient,
  select: T,
  params: { companyId: string; candidateUserId: string; orderId: string },
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await supabase
    .from('mvr_orders')
    .select(select)
    .eq('id', params.orderId)
    .eq('driver_user_id', params.candidateUserId)
    .maybeSingle()

  if (error || !data) return { data: null, error }

  const allowed = await employerCanAccessCandidateScreeningOrder(supabase, {
    companyId: params.companyId,
    candidateUserId: params.candidateUserId,
    order: data as { ordered_by_company_id?: string | null },
  })

  return allowed ? { data: data as Record<string, unknown>, error: null } : { data: null, error: null }
}

/** Load PSP order for employer view — company-paid OR consenting-company driver-owned. */
export async function fetchEmployerAccessiblePspOrder<T extends string>(
  supabase: SupabaseClient,
  select: T,
  params: { companyId: string; candidateUserId: string; orderId: string },
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await supabase
    .from('psp_orders')
    .select(select)
    .eq('id', params.orderId)
    .eq('driver_user_id', params.candidateUserId)
    .maybeSingle()

  if (error || !data) return { data: null, error }

  const allowed = await employerCanAccessCandidateScreeningOrder(supabase, {
    companyId: params.companyId,
    candidateUserId: params.candidateUserId,
    order: data as { ordered_by_company_id?: string | null },
  })

  return allowed ? { data: data as Record<string, unknown>, error: null } : { data: null, error: null }
}
