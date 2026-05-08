/**
 * SSN helpers for screening order forms.
 *
 * Background-check vendors (Accio / FMCSA PSP, state DMVs for MVR) need the
 * full 9-digit SSN to match a subject directly. If we send last-4, Accio
 * routes the order to a slow identity-verification path that can take hours.
 *
 * SSN is **never persisted** in our database — these helpers exist purely so
 * forms can collect 9 digits from the user, send them to the order route, and
 * forget them. (See `WHERE column_name ILIKE '%ssn%'` — zero rows.)
 */

/** Strip everything that isn't a digit and cap at 9 chars. */
export function normalizeSsnDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9)
}

/** Return true if `value` (digits only) is a syntactically valid 9-digit SSN. */
export function isValidSsn(value: string): boolean {
  const digits = normalizeSsnDigits(value)
  if (digits.length !== 9) return false
  // SSA does not issue 000-, 666-, or 9xx- area numbers; group/serial cannot be 00 / 0000.
  if (/^000/.test(digits) || /^666/.test(digits) || /^9/.test(digits)) return false
  if (digits.slice(3, 5) === '00') return false
  if (digits.slice(5) === '0000') return false
  return true
}

/**
 * Format a digit string for display as the user types: `123-45-6789`.
 * Accepts partial input ("12", "12345" → "123-45") so we can use it inline
 * inside an onChange handler without breaking caret behavior badly.
 */
export function formatSsnDisplay(raw: string): string {
  const d = normalizeSsnDigits(raw)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** Mask all but the last 4 digits for display in confirmations: `***-**-6789`. */
export function maskSsn(raw: string): string {
  const d = normalizeSsnDigits(raw)
  if (d.length < 4) return '***-**-****'
  return `***-**-${d.slice(-4)}`
}
