/**
 * Driver orientation — when the brief popup is allowed to interrupt.
 *
 * The brief itself is written per driver (see `dq-coach-brief.ts`). This file
 * only remembers which brief they were last shown and how often, so the popup
 * comes up for a new step and stops nagging about an old one.
 */

/** Visits one brief may open on by itself before it goes quiet. */
export const BRIEF_SHOW_CAP = 3

/** Quiet stretch that counts as "came back later", not the next day. */
export const BRIEF_LONG_GAP_MS = 30 * 24 * 60 * 60 * 1000

export type DriverOrientationState = {
  briefKey: string | null
  shownCount: number
  lastShownAt: string | null
}

export const EMPTY_DRIVER_ORIENTATION: DriverOrientationState = {
  briefKey: null,
  shownCount: 0,
  lastShownAt: null,
}

export function parseDriverOrientation(raw: unknown): DriverOrientationState {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const count = row.shownCount
  return {
    briefKey: typeof row.briefKey === 'string' && row.briefKey ? row.briefKey : null,
    shownCount:
      typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
    lastShownAt: typeof row.lastShownAt === 'string' && row.lastShownAt ? row.lastShownAt : null,
  }
}

export function shouldShowBrief(
  state: DriverOrientationState,
  briefKey: string,
  nowMs: number,
): boolean {
  // A different step is news. It always gets its turn.
  if (state.briefKey !== briefKey) return true
  // Closing a popup is not the same as reading it, so the same step may come
  // back on a later visit, up to the cap.
  if (state.shownCount < BRIEF_SHOW_CAP) return true
  // Past the cap it stays quiet, except for someone returning after a long time away.
  const last = state.lastShownAt ? Date.parse(state.lastShownAt) : Number.NaN
  return Number.isFinite(last) && nowMs - last >= BRIEF_LONG_GAP_MS
}

export function recordBriefShown(
  state: DriverOrientationState,
  briefKey: string,
  nowIso: string,
): DriverOrientationState {
  return {
    briefKey,
    shownCount: state.briefKey === briefKey ? state.shownCount + 1 : 1,
    lastShownAt: nowIso,
  }
}
