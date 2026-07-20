import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Storm account ownership for employer screening is by **email**, not legal name.
 * Accio still gets first/last/SSN/DL from the order form (DMV identity). The
 * `mvr_orders` / `psp_orders.driver_user_id` must point at the Storm user who
 * owns the contact email (e.g. Jason Peterson PII + stormchaintest@gmail.com
 * → Leon's account).
 */
export function normalizeStormEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return null
  return trimmed
}

/**
 * Exact email match on `users.email` or `user_profiles.email` (case-insensitive).
 * Prefer users.email when both exist for different people (shouldn't happen).
 */
export async function resolveStormUserIdByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeStormEmail(email)
  if (!normalized) return null

  const { data: byUser } = await supabase
    .from('users')
    .select('id')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()

  if (byUser?.id) return byUser.id as string

  const { data: byProfile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()

  return (byProfile?.user_id as string | undefined) ?? null
}

export interface EmployerOrderDriverResolution {
  /** Storm user that owns the hub tile / order row */
  driverUserId: string
  /** True when email pointed at a different account than candidateUserId */
  reboundByEmail: boolean
  orderEmail: string | null
}

/**
 * Prefer the Storm account for `orderEmail` when one exists; otherwise keep
 * the talent-card / invite `candidateUserId`.
 */
export async function resolveEmployerOrderDriverUserId(
  supabase: SupabaseClient,
  input: {
    candidateUserId: string
    orderEmail: string | null | undefined
  },
): Promise<EmployerOrderDriverResolution> {
  const orderEmail = normalizeStormEmail(input.orderEmail)
  const byEmail = await resolveStormUserIdByEmail(supabase, orderEmail)

  if (byEmail && byEmail !== input.candidateUserId) {
    console.log('[EMPLOYER ORDER] Rebinding driver_user_id by email', {
      candidateUserId: input.candidateUserId,
      driverUserId: byEmail,
      orderEmail,
    })
    return { driverUserId: byEmail, reboundByEmail: true, orderEmail }
  }

  return {
    driverUserId: byEmail ?? input.candidateUserId,
    reboundByEmail: false,
    orderEmail,
  }
}
