/**
 * Unwrap a to-one embedded resource from a Supabase select.
 *
 * Without generated DB types, supabase-js can't tell a to-one FK join
 * (`companies(*)` on `job_postings.company_id`) from a to-many one, so it
 * types the field as `T | T[] | null` while the runtime value is a single
 * object. This normalizes both shapes so call sites don't need per-field casts.
 */
export function joinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
