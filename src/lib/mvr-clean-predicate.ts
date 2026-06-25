/**
 * P3.4-A — shared predicate + witness shape for `mvr_clean_36_months`.
 *
 * Off-chain builder prepares fixed slots for the Compact circuit; the circuit
 * compares each active violation's YYYYMMDD against the public window bounds.
 * Taxonomy v1 mirrors `fact-registry.ts`: any parseable violation date inside
 * the 36-month window disqualifies the attestation.
 */

import type { MvrViolation } from '@/types/driver-profile'

/** Must match the fixed loop bound in `mvr-clean-36.compact`. */
export const MVR_CLEAN_MAX_VIOLATION_SLOTS = 32

/** Bump when disqualifying rules change (compliance + circuit witness encoding). */
export const MVR_CLEAN_PREDICATE_VERSION = 'v1-any-violation-in-window'

export const MVR_CLEAN_WINDOW_MONTHS = 36

export interface MvrCleanViolationSlot {
  /** YYYYMMDD integer, e.g. 20240315. Zero when slot inactive. */
  dateYmd: number
  /** True when this slot carries a real violation from the MVR. */
  active: boolean
}

export interface MvrCleanVerificationWindow {
  windowStart: Date
  windowEnd: Date
  /** Inclusive YYYYMMDD bounds passed as public circuit inputs. */
  windowStartYmd: number
  windowEndYmd: number
}

export interface MvrCleanWitnessPayload {
  predicateVersion: typeof MVR_CLEAN_PREDICATE_VERSION
  window: MvrCleanVerificationWindow
  slots: MvrCleanViolationSlot[]
}

export function subtractMonths(anchor: Date, months: number): Date {
  const d = new Date(anchor)
  d.setMonth(d.getMonth() - months)
  return d
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Parse Accio / hub violation dates into UTC midnight Date objects. */
export function parseViolationDate(raw: string | undefined | null): Date | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
    const d = new Date(`${iso}T00:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

export function dateToYmdInt(date: Date): number {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  return y * 10_000 + m * 100 + d
}

export function ymdIntToIso(ymd: number): string {
  const y = Math.floor(ymd / 10_000)
  const m = Math.floor((ymd % 10_000) / 100)
  const d = ymd % 100
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function computeMvrCleanVerificationWindow(anchor: Date): MvrCleanVerificationWindow {
  const windowEnd = anchor
  const windowStart = subtractMonths(anchor, MVR_CLEAN_WINDOW_MONTHS)
  return {
    windowStart,
    windowEnd,
    windowStartYmd: dateToYmdInt(windowStart),
    windowEndYmd: dateToYmdInt(windowEnd),
  }
}

function emptySlots(): MvrCleanViolationSlot[] {
  return Array.from({ length: MVR_CLEAN_MAX_VIOLATION_SLOTS }, () => ({
    dateYmd: 0,
    active: false,
  }))
}

/**
 * Map parsed MVR violations into fixed circuit slots (chronological, capped).
 * Violations without a parseable date are skipped — they cannot enter the predicate.
 */
export function buildMvrCleanViolationSlots(
  violations: readonly Pick<MvrViolation, 'date'>[],
): MvrCleanViolationSlot[] {
  const parsed = violations
    .map((v) => {
      const d = parseViolationDate(v.date)
      return d ? { dateYmd: dateToYmdInt(d) } : null
    })
    .filter((v): v is { dateYmd: number } => v !== null)
    .sort((a, b) => a.dateYmd - b.dateYmd)

  if (parsed.length > MVR_CLEAN_MAX_VIOLATION_SLOTS) {
    throw new Error(
      `MVR has ${parsed.length} dated violations — exceeds circuit capacity (${MVR_CLEAN_MAX_VIOLATION_SLOTS})`,
    )
  }

  const slots = emptySlots()
  for (let i = 0; i < parsed.length; i++) {
    slots[i] = { dateYmd: parsed[i].dateYmd, active: true }
  }
  return slots
}

/** True when any active violation date falls inside [windowStartYmd, windowEndYmd]. */
export function hasViolationInWindow(
  slots: readonly MvrCleanViolationSlot[],
  window: Pick<MvrCleanVerificationWindow, 'windowStartYmd' | 'windowEndYmd'>,
): boolean {
  return slots.some(
    (s) =>
      s.active &&
      s.dateYmd >= window.windowStartYmd &&
      s.dateYmd <= window.windowEndYmd,
  )
}

export function buildMvrCleanWitnessPayload(input: {
  violations: readonly Pick<MvrViolation, 'date'>[]
  anchor: Date
}): MvrCleanWitnessPayload {
  const window = computeMvrCleanVerificationWindow(input.anchor)
  const slots = buildMvrCleanViolationSlots(input.violations)
  return {
    predicateVersion: MVR_CLEAN_PREDICATE_VERSION,
    window,
    slots,
  }
}

/** Off-chain preflight — must match what the Compact circuit will reject. */
export function assertMvrCleanPredicatePasses(payload: MvrCleanWitnessPayload): void {
  if (hasViolationInWindow(payload.slots, payload.window)) {
    throw new Error(
      'Moving violations found within the 36-month verification window — cannot prove clean MVR',
    )
  }
}
