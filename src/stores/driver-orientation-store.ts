'use client'

import { create } from 'zustand'
import {
  EMPTY_DRIVER_ORIENTATION,
  parseDriverOrientation,
  recordBriefShown,
  shouldShowBrief,
  type DriverOrientationState,
} from '@/lib/driver-orientation'

/**
 * The brief this tab last opened by itself. Coming back to the file re-runs
 * the coach, and without this the same brief would pop up on every return.
 */
const SESSION_KEY = 'provven-brief-shown'

type DriverOrientationStore = {
  state: DriverOrientationState
  /** True once memory is read. The popup never opens by itself before that. */
  loaded: boolean
  /** True once this visit has decided whether the popup opens. The section waits for it. */
  popupDecided: boolean
  briefOpen: boolean
  load: () => Promise<void>
  /** Opens the brief if the rules allow it, and records that it was shown. */
  considerBrief: (briefKey: string) => void
  closeBrief: () => void
}

export const useDriverOrientationStore = create<DriverOrientationStore>((set, get) => ({
  state: EMPTY_DRIVER_ORIENTATION,
  loaded: false,
  popupDecided: false,
  briefOpen: false,

  load: async () => {
    try {
      const res = await fetch('/api/driver/orientation')
      // Unreadable memory skips the popup. Opening it with no memory of the
      // last time would mean opening it on every visit. The section still shows it.
      if (!res.ok) {
        set({ loaded: true, popupDecided: true })
        return
      }
      const json = (await res.json()) as { orientation?: unknown }
      set({ state: parseDriverOrientation(json.orientation), loaded: true })
    } catch (err) {
      console.error('[ORIENTATION] Load failed:', err)
      set({ loaded: true, popupDecided: true })
    }
  },

  considerBrief: (briefKey) => {
    const { loaded, briefOpen, popupDecided, state } = get()
    if (!loaded || briefOpen || popupDecided) return
    // Already covered this step in this tab, or the cap says stay quiet.
    // Either way the message belongs in the section, not in another popup.
    if (sessionStorage.getItem(SESSION_KEY) === briefKey || !shouldShowBrief(state, briefKey, Date.now())) {
      set({ popupDecided: true })
      return
    }

    sessionStorage.setItem(SESSION_KEY, briefKey)
    set({
      briefOpen: true,
      popupDecided: true,
      state: recordBriefShown(state, briefKey, new Date().toISOString()),
    })
    void fetch('/api/driver/orientation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefKey }),
    }).catch((err) => console.error('[ORIENTATION] Save failed:', err))
  },

  closeBrief: () => set({ briefOpen: false }),
}))
