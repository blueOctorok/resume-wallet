import type { SupabaseClient } from '@supabase/supabase-js'

/** Case-insensitive substring match for admin search boxes. */
export function textMatchesSearch(
  value: string | null | undefined,
  search: string,
): boolean {
  if (!value) return false
  return value.toLowerCase().includes(search.toLowerCase())
}

/** Slice an in-memory list after global filter (search path for joined admin tables). */
export function paginateInMemory<T>(items: T[], offset: number, limit: number): T[] {
  return items.slice(offset, offset + limit)
}

/**
 * Resolve Storm user ids whose wallet, users.email, or user_profiles name/email
 * match the search string. Used by admin list routes before pagination.
 */
export async function resolveUserIdsMatchingSearch(
  supabase: SupabaseClient,
  search: string,
): Promise<string[]> {
  const q = search.trim().toLowerCase()
  if (!q) return []

  const ids = new Set<string>()
  const pattern = `%${q}%`

  const [{ data: fromUsers }, { data: fromProfiles }] = await Promise.all([
    supabase
      .from('users')
      .select('id')
      .or(`wallet_address.ilike.${pattern},email.ilike.${pattern}`),
    supabase
      .from('user_profiles')
      .select('user_id')
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      ),
  ])

  fromUsers?.forEach((row) => ids.add(row.id))
  fromProfiles?.forEach((row) => ids.add(row.user_id))

  return [...ids]
}

/** True if any of the provided strings match the search query. */
export function anyFieldMatchesSearch(
  search: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => textMatchesSearch(f, q))
}
