import { describe, expect, it } from 'vitest'
import {
  BRIEF_LONG_GAP_MS,
  BRIEF_SHOW_CAP,
  EMPTY_DRIVER_ORIENTATION,
  parseDriverOrientation,
  recordBriefShown,
  shouldShowBrief,
  type DriverOrientationState,
} from './driver-orientation'

const NOW = Date.parse('2026-11-24T12:00:00.000Z')
const YESTERDAY = new Date(NOW - 24 * 60 * 60 * 1000).toISOString()
const KEY = 'working|license|scan your license barcode'

function shown(count: number, lastShownAt: string | null = YESTERDAY): DriverOrientationState {
  return { briefKey: KEY, shownCount: count, lastShownAt }
}

describe('shouldShowBrief', () => {
  it('shows the first brief to a driver with no memory', () => {
    expect(shouldShowBrief(EMPTY_DRIVER_ORIENTATION, KEY, NOW)).toBe(true)
  })

  it('shows the same brief again on a later visit, under the cap', () => {
    expect(shouldShowBrief(shown(BRIEF_SHOW_CAP - 1), KEY, NOW)).toBe(true)
  })

  it('goes quiet once the same brief has hit the cap', () => {
    expect(shouldShowBrief(shown(BRIEF_SHOW_CAP), KEY, NOW)).toBe(false)
  })

  it('shows a new step even when the last one hit the cap', () => {
    expect(shouldShowBrief(shown(BRIEF_SHOW_CAP), 'working|dotapp|finish dot application', NOW)).toBe(
      true,
    )
  })

  it('shows a capped brief again after a long time away', () => {
    const longAgo = new Date(NOW - BRIEF_LONG_GAP_MS).toISOString()
    expect(shouldShowBrief(shown(BRIEF_SHOW_CAP, longAgo), KEY, NOW)).toBe(true)
  })
})

describe('recordBriefShown', () => {
  const nowIso = new Date(NOW).toISOString()

  it('counts up for the same brief', () => {
    expect(recordBriefShown(shown(1), KEY, nowIso)).toEqual({
      briefKey: KEY,
      shownCount: 2,
      lastShownAt: nowIso,
    })
  })

  it('starts over at one for a new brief', () => {
    expect(recordBriefShown(shown(3), 'caught_up|none|', nowIso)).toEqual({
      briefKey: 'caught_up|none|',
      shownCount: 1,
      lastShownAt: nowIso,
    })
  })

  it('moves the long-gap clock, so the gap show happens once', () => {
    const longAgo = new Date(NOW - BRIEF_LONG_GAP_MS).toISOString()
    const after = recordBriefShown(shown(BRIEF_SHOW_CAP, longAgo), KEY, nowIso)
    expect(shouldShowBrief(after, KEY, NOW)).toBe(false)
  })
})

describe('parseDriverOrientation', () => {
  it('reads empty memory from nothing, or from the fields the old welcome saved', () => {
    expect(parseDriverOrientation(null)).toEqual(EMPTY_DRIVER_ORIENTATION)
    expect(parseDriverOrientation({ openedAt: YESTERDAY, autoShowCount: 2 })).toEqual(
      EMPTY_DRIVER_ORIENTATION,
    )
  })

  it('keeps a saved brief and rejects a bad count', () => {
    expect(parseDriverOrientation({ briefKey: KEY, shownCount: -4, lastShownAt: YESTERDAY })).toEqual({
      briefKey: KEY,
      shownCount: 0,
      lastShownAt: YESTERDAY,
    })
  })
})
