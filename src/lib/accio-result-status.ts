/**
 * Single source of truth for translating Accio's `filledStatus` + `filledCode`
 * into Storm's order status + a friendly outcome we surface in the UI.
 *
 * Per Accio's `result_receipt.md` section 2.10 ("postResults Attribute Definitions"),
 * the only valid filledCode values Accio ever sends are:
 *   no hits | hits | clear | discrepancy | unknown | drugpositive | drugnegative |
 *   contact MRO | lab-reject | test-canceled | unobtainable |
 *   previous-positive | pass | fail
 *
 * MVR-specific: `discrepancy` = completed report with hits and/or identity
 * mismatch alerts (Key Background shows "COMPLETE - discrepancy").
 *
 * filledStatus values per Accio docs: `filled` (success), `unfilled` (vendor
 * couldn't fulfill — terminal), `failed` (terminal error), `in progress`
 * (transient). We treat anything other than `in progress` as terminal so
 * orders never get stuck pending forever (which also broke email dedup —
 * see notify-screening-complete.ts).
 *
 * The previous code checked `filledCode === 'verified'` — a value Accio never
 * sends — so EVERY completed report was being silently stamped `needs_review`.
 * That's the bug this module exists to never let recur.
 */

export type ScreeningOrderStatus =
  | 'pending'
  | 'completed'
  | 'needs_review'
  | 'failed'
  | 'expired'

/**
 * High-level outcome surfaced to candidates and employers.
 * `clear` / `no_hits` / `pass` = green; `hits` / `fail` = amber; `unknown` = grey.
 * `null` means the order has not finished yet.
 */
export type ScreeningOutcome =
  | 'clear'
  | 'no_hits'
  | 'hits'
  | 'discrepancy'
  | 'pass'
  | 'fail'
  | 'unknown'
  | null

export interface DeriveScreeningStatusInput {
  /** Accio's `filledStatus` attribute on the subOrder (e.g. "filled", "in progress", "failed"). */
  filledStatus?: string | null
  /** Accio's `filledCode` attribute on the subOrder. See valid values above. */
  filledCode?: string | null
  /** True when Accio set `held_for_review="Y"` — vendor wants a human to look. */
  heldForReview?: boolean | null
}

export interface DeriveScreeningStatusResult {
  status: ScreeningOrderStatus
  outcome: ScreeningOutcome
}

const CLEAN_CODES = new Set(['clear', 'no hits', 'no_hits'])
const HIT_CODES = new Set(['hits', 'previous-positive', 'drugpositive'])
const DISCREPANCY_CODES = new Set(['discrepancy'])
const PASS_CODES = new Set(['pass', 'drugnegative'])
const FAIL_CODES = new Set(['fail'])
const REVIEW_CODES = new Set(['contact mro', 'lab-reject', 'test-canceled'])
// `unobtainable` is the vendor saying "we tried, the source said no" — that's a
// failure of the order, not a review item, and the candidate should be told.
const FAILED_CODES = new Set(['unobtainable'])

function normalize(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

// Only `in progress` is a transient filledStatus. Everything else
// (`filled`, `unfilled`, `failed`, missing) is terminal — leaving an order
// `pending` after a webhook fires breaks both the UI and the email dedup
// guard (see notify-screening-complete.ts: `previousStatus !== 'pending'`).
const TRANSIENT_FILLED_STATUSES = new Set(['in progress', 'inprogress'])

export function deriveScreeningStatus(
  input: DeriveScreeningStatusInput,
): DeriveScreeningStatusResult {
  const filledStatus = normalize(input.filledStatus)
  const code = normalize(input.filledCode)

  // Only "in progress" keeps the order pending. The webhook handler short-circuits
  // these before reaching here, but we double-check for safety.
  if (TRANSIENT_FILLED_STATUSES.has(filledStatus)) {
    return { status: 'pending', outcome: null }
  }

  // If Accio explicitly says the order failed, mirror that.
  if (filledStatus === 'failed') {
    return { status: 'failed', outcome: code === 'unknown' ? 'unknown' : null }
  }

  // `unfilled` = "vendor was unable to fulfill". Terminal, not transient.
  // Surface as failed/unknown so admin can adjudicate and re-order if needed.
  // Common cause: FMCSA has no PSP records for the driver (new CDL holder,
  // no carrier-reported events) or the source rejected the identity match.
  if (filledStatus === 'unfilled') {
    return { status: 'failed', outcome: 'unknown' }
  }

  // Vendor flagged for human review — keep the order in needs_review even on
  // a "clear" code so admin can adjudicate before it shows green to employers.
  if (input.heldForReview) {
    return { status: 'needs_review', outcome: outcomeFromCode(code) }
  }

  if (FAILED_CODES.has(code)) {
    return { status: 'failed', outcome: null }
  }

  if (REVIEW_CODES.has(code)) {
    return { status: 'needs_review', outcome: 'unknown' }
  }

  // From here down the order is genuinely complete — Accio successfully fetched
  // the data. "Hits" is still a complete report; it just contains records.
  if (CLEAN_CODES.has(code)) {
    return { status: 'completed', outcome: code === 'no hits' ? 'no_hits' : 'clear' }
  }
  if (HIT_CODES.has(code)) {
    return { status: 'completed', outcome: 'hits' }
  }
  if (DISCREPANCY_CODES.has(code)) {
    return { status: 'completed', outcome: 'discrepancy' }
  }
  if (PASS_CODES.has(code)) {
    return { status: 'completed', outcome: 'pass' }
  }
  if (FAIL_CODES.has(code)) {
    return { status: 'completed', outcome: 'fail' }
  }
  if (code === 'unknown' || code === '') {
    // `filledStatus="filled"` with no recognized code — treat as needs_review.
    // Don't silently drop the order to "completed/clear" because we don't actually know.
    return { status: 'needs_review', outcome: 'unknown' }
  }

  // Truly unknown code — log to needs_review so admin notices and we can extend
  // the mapping. Better to ask a human than to lie to the candidate/employer.
  return { status: 'needs_review', outcome: 'unknown' }
}

function outcomeFromCode(code: string): ScreeningOutcome {
  if (CLEAN_CODES.has(code)) return code === 'no hits' ? 'no_hits' : 'clear'
  if (HIT_CODES.has(code)) return 'hits'
  if (DISCREPANCY_CODES.has(code)) return 'discrepancy'
  if (PASS_CODES.has(code)) return 'pass'
  if (FAIL_CODES.has(code)) return 'fail'
  return 'unknown'
}

/** Human-readable label for a `ScreeningOutcome` — used in badges and emails. */
export function outcomeLabel(outcome: ScreeningOutcome): string {
  switch (outcome) {
    case 'clear':
      return 'Clear'
    case 'no_hits':
      return 'No hits'
    case 'hits':
      return 'Hits found'
    case 'discrepancy':
      return 'Discrepancy'
    case 'pass':
      return 'Pass'
    case 'fail':
      return 'Fail'
    case 'unknown':
      return 'Pending review'
    case null:
      return 'Processing'
  }
}

/** Tailwind chip classes for a `ScreeningOutcome` — keeps badges consistent everywhere. */
export function outcomeBadgeClasses(outcome: ScreeningOutcome): string {
  switch (outcome) {
    case 'clear':
    case 'no_hits':
    case 'pass':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
    case 'hits':
    case 'discrepancy':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
    case 'fail':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
    case 'unknown':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30'
    case null:
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30'
  }
}
