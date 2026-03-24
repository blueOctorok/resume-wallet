import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * True if this user is part of the employer product surface: company owner,
 * active team member, or DB role still set to employer. Used to block switching
 * to candidate on the same wallet.
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
