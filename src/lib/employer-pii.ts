/**
 * Tier 3 minimization for consent `form_data` blobs.
 *
 * Consent snapshots (`bgcheck_consents.form_data`, `psp_consents.form_data`,
 * `screening_consent_bundles.cdlis_form_data`) are written at signing time and
 * carry the driver's date of birth and street address. Two separate employer
 * endpoints echoed the blob straight back to the browser.
 *
 * What stays and why:
 *   - `city` / `state` / `zip` — an employer verifying a consent needs the
 *     jurisdiction it was signed in.
 *   - `dlNumber` / `dlState` — Tier 2. Governed by the `viewScreeningResults`
 *     role gate, not removed.
 *   - `firstName` / `lastName` / `email` — already on the career card.
 *
 * `ssn` is listed defensively; no row currently stores one under that key, and
 * the consented flow keeps SSN encrypted in `screening_consent_bundles` where it
 * is decrypted server-side at order time and never returned.
 */
export const TIER3_CONSENT_FIELDS = ['ssn', 'dateOfBirth', 'dob', 'address'] as const

/** Drops Tier 3 keys and flattens the rest to strings. Null/undefined → `{}`. */
export function stripTier3FromFormData(
  formData: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!formData || typeof formData !== 'object') return {}
  const blocked = TIER3_CONSENT_FIELDS as readonly string[]
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (value == null) continue
    if (blocked.includes(key)) continue
    out[key] = typeof value === 'string' ? value : String(value)
  }
  return out
}
