import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The invite stores the phone from the moment it was created. Once the driver
 * has an account, their profile is the number they actually use. A blank
 * profile leaves the invite's phone alone, so a recruiter can still type one
 * in before the driver has added theirs.
 */
export function phoneFromDriverProfile(
  invitePhone: string | null | undefined,
  profilePhone: string | null | undefined,
): string | null {
  const live = profilePhone?.trim()
  if (live) return live
  const stored = invitePhone?.trim()
  return stored || null
}

type InvitePhoneRow = {
  used_by_user_id?: string | null
  candidate_phone?: string | null
}

/** Fill claimed invites with the phone currently on the driver's profile. */
export async function applyLiveDriverPhones<T extends InvitePhoneRow>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<T[]> {
  const ids = [...new Set(rows.map((row) => row.used_by_user_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return rows

  const phones = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const { data, error } = await supabase.from('user_profiles').select('user_id, phone').in('user_id', chunk)
    if (error) {
      console.error('[OUTREACH] live phone lookup failed:', error)
      return rows
    }
    for (const row of data ?? []) {
      const phone = (row.phone as string | null | undefined)?.trim()
      if (phone && row.user_id) phones.set(row.user_id as string, phone)
    }
  }

  return rows.map((row) => {
    const live = row.used_by_user_id ? phones.get(row.used_by_user_id) : undefined
    if (!live) return row
    return { ...row, candidate_phone: phoneFromDriverProfile(row.candidate_phone, live) }
  })
}
