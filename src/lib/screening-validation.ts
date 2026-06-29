import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'

/**
 * Pre-flight validation for MVR / PSP order submission.
 *
 * Why this exists:
 *   Accio charges per order placed, and a "successful" placement of bad data
 *   results in `filledStatus="unfilled"` 30-60 minutes later — by which time
 *   the user has navigated away. Worse, stale postbacks for unrelated orders
 *   can corrupt the wrong row (see `screening-webhook-match.ts` for the
 *   matching hardening). We want to fail at the door: bad data → 400 with a
 *   clear message → user fixes and resubmits → no Accio call, no charge.
 *
 * Validation philosophy:
 *   - Format-strict on things that have one valid shape (SSN, state code, DOB)
 *   - Format-loose on DL number — every state has multiple valid formats and
 *     a per-state regex creates more false positives than it catches typos.
 *     We just check non-empty, alphanumeric (+ dashes), 5-17 chars.
 *   - Cross-row strict on duplicates — no second pending order for the same
 *     driver + same screening kind within 24 hours.
 *
 * Returns either { ok: true, normalized: ... } with sanitized values you
 * should write to the DB, or { ok: false, error: string } with a user-safe
 * message. Always show the error string verbatim to the user — it's already
 * phrased for them.
 */

export interface ScreeningOrderInput {
  firstName: string
  lastName: string
  /** YYYY-MM-DD or YYYYMMDD */
  dob: string
  /** 2-letter US state code, case-insensitive */
  dlState: string
  dlNumber: string
  /** Full 9-digit SSN (digits only or with dashes — we normalize) */
  ssn: string
}

export interface ScreeningOrderNormalized {
  firstName: string
  lastName: string
  /** YYYYMMDD — Accio's expected format */
  dob: string
  /** Uppercase 2-letter state code */
  dlState: string
  /** Trimmed, uppercased DL number */
  dlNumber: string
  /** 9-digit SSN, no dashes */
  ssn: string
}

export type ValidationResult =
  | { ok: true; normalized: ScreeningOrderNormalized }
  | { ok: false; error: string }

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', // District of Columbia
])

/** Driver license format: alphanumeric (and dashes — some states use them), 5-17 chars. */
const DL_NUMBER_RE = /^[A-Z0-9-]{5,17}$/i

/**
 * Strip everything that's not A-Z so we can compare a DL number to a name
 * without dashes / spaces / punctuation getting in the way.
 *
 * Why this is a separate step: someone may type "MARTIN-A" or "MARTIN " — we
 * still want to catch that as "this is your last name, not a license number".
 */
function lettersOnly(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '')
}

/**
 * Lightweight client-side guard so disclosure forms can show inline errors
 * BEFORE the user signs. Same rule as the server validator below — keep both
 * in sync. Returns a user-safe error string, or null when the value is OK.
 *
 * `dlNumber` is required to be non-empty by the form already; this only
 * fires when the user typed something that looks like a name.
 */
export function checkDlNumberIsNotName(input: {
  dlNumber: string
  firstName: string
  lastName: string
}): string | null {
  const dl = lettersOnly(input.dlNumber)
  if (!dl) return null
  const first = lettersOnly(input.firstName)
  const last = lettersOnly(input.lastName)
  if (dl === first || dl === last || dl === first + last) {
    return "That looks like your name, not your driver license number. The DL number is printed on the front of your license."
  }
  return null
}

function trimSafe(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** User-safe DOB check for disclosure steps (before consent is persisted). */
export function validateDateOfBirth(input: string): { ok: true } | { ok: false; error: string } {
  const dob = normalizeDob(trimSafe(input))
  if (!dob) {
    return {
      ok: false,
      error: 'Date of birth is missing or invalid. Use YYYY-MM-DD format and confirm the year is correct.',
    }
  }
  return { ok: true }
}

/** YYYY-MM-DD or YYYYMMDD → YYYYMMDD. Returns null if not parseable. */
function normalizeDob(input: string): string | null {
  const stripped = input.replace(/[^\d]/g, '')
  if (stripped.length !== 8) return null
  const yyyy = parseInt(stripped.slice(0, 4), 10)
  const mm = parseInt(stripped.slice(4, 6), 10)
  const dd = parseInt(stripped.slice(6, 8), 10)
  if (!yyyy || !mm || !dd) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null

  // Round-trip through Date to validate (catches Feb 30, etc.). UTC to avoid
  // timezone weirdness — DOB is a calendar date, not a moment in time.
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null
  }

  // Reasonable age bounds — catches "20260105" typos (would-be -36 years old)
  // and stops Accio from being asked about 200-year-old drivers.
  const now = new Date()
  const ageYears = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageYears < 16 || ageYears > 100) return null

  return `${yyyy.toString().padStart(4, '0')}${mm.toString().padStart(2, '0')}${dd.toString().padStart(2, '0')}`
}

/**
 * Pure validation — no DB call, no async. Use this in client-side form
 * validation too if you want consistent rules.
 */
export function validateScreeningOrderInput(input: ScreeningOrderInput): ValidationResult {
  const firstName = trimSafe(input.firstName)
  const lastName = trimSafe(input.lastName)
  const dlState = trimSafe(input.dlState).toUpperCase()
  const dlNumber = trimSafe(input.dlNumber).toUpperCase()
  const ssnDigits = normalizeSsnDigits(input.ssn)

  if (firstName.length < 1) {
    return { ok: false, error: 'First name is required.' }
  }
  if (lastName.length < 1) {
    return { ok: false, error: 'Last name is required.' }
  }
  if (firstName.length > 50 || lastName.length > 50) {
    return { ok: false, error: 'Name fields must be under 50 characters.' }
  }

  const dob = normalizeDob(trimSafe(input.dob))
  if (!dob) {
    return {
      ok: false,
      error: 'Date of birth is missing or invalid. Use YYYY-MM-DD format and confirm the year is correct.',
    }
  }

  if (!US_STATE_CODES.has(dlState)) {
    return {
      ok: false,
      error: `"${dlState || '(empty)'}" is not a valid US state code. Use the 2-letter abbreviation (e.g. OH, CA, TX).`,
    }
  }

  if (!DL_NUMBER_RE.test(dlNumber)) {
    return {
      ok: false,
      error: 'Driver license number must be 5-17 letters, digits, or dashes. Check the number on the physical card.',
    }
  }

  // Catch the most common data-entry mistake we see in production:
  // the candidate (or a prefill) puts their NAME in the DL field. Accio happily
  // accepts it, charges the company, and the lookup comes back unfilled hours later.
  // Compare on letters-only so "MARTIN ", "Martin-A", etc. all trip the check.
  const dlLetters = lettersOnly(dlNumber)
  const firstLetters = lettersOnly(firstName)
  const lastLetters = lettersOnly(lastName)
  const fullLetters = firstLetters + lastLetters
  if (
    dlLetters.length > 0 &&
    (dlLetters === firstLetters || dlLetters === lastLetters || dlLetters === fullLetters)
  ) {
    return {
      ok: false,
      error:
        'Your driver license number cannot match your name. The DL number is printed on the front of your license — usually a mix of letters and digits.',
    }
  }

  if (!isValidSsn(ssnDigits)) {
    return {
      ok: false,
      error: 'SSN is invalid. Enter all 9 digits exactly as they appear on the Social Security card.',
    }
  }

  return {
    ok: true,
    normalized: {
      firstName,
      lastName,
      dob,
      dlState,
      dlNumber,
      ssn: ssnDigits,
    },
  }
}

/**
 * Cross-row check: prevent accidental double-orders for the same driver +
 * same screening kind within a 24-hour window. Any pending OR completed
 * order in the window blocks a new one — completed within 24h means the user
 * already has a fresh report and shouldn't be charged again.
 *
 * Returns null if it's safe to place a new order; returns an error string
 * (user-safe wording) if a recent order blocks placement.
 */
export async function checkRecentDuplicateOrder(
  supabase: SupabaseClient,
  params: {
    driverUserId: string
    kind: 'mvr' | 'psp'
    /** Window in milliseconds. Defaults to 24h. */
    windowMs?: number
  },
): Promise<string | null> {
  const { driverUserId, kind, windowMs = 24 * 60 * 60 * 1000 } = params
  const since = new Date(Date.now() - windowMs).toISOString()
  const table = kind === 'mvr' ? 'mvr_orders' : 'psp_orders'

  const { data, error } = await supabase
    .from(table)
    .select('id, status, ordered_at')
    .eq('driver_user_id', driverUserId)
    .in('status', ['pending', 'completed'])
    .gte('ordered_at', since)
    .order('ordered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Don't block placement on a transient DB error; log so we notice.
    console.warn(`[SCREENING VALIDATION] Duplicate check failed for ${kind}:`, error)
    return null
  }
  if (!data) return null

  const label = kind === 'mvr' ? 'MVR' : 'PSP'
  if (data.status === 'pending') {
    return `A ${label} order placed ${friendlyAge(data.ordered_at)} is still pending. Wait for it to finish before ordering another.`
  }
  return `A ${label} order completed ${friendlyAge(data.ordered_at)}. Reports are valid for 30 days — re-order after ${new Date(new Date(data.ordered_at).getTime() + windowMs).toLocaleDateString()} or contact support if you need a fresh pull.`
}

function friendlyAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
