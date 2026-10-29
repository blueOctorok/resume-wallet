import { create } from 'zustand'

/**
 * UI Mode Store
 *
 * Controls which chrome the candidate sees:
 * - `hub`      → Career Card, the DQ file (`CandidateHub`) — where a visit opens
 * - `simple`   → Apply, the job split view (`SimpleModeShell`)
 *
 * The underlying data (hub blocks, career card, Stormi) is identical in both
 * modes. This store only toggles the chrome for the current visit. A reload
 * opens Career Card again. The old `users.ui_mode_preference` default of
 * `simple` is not a visit choice — nothing writes the nav toggle — so
 * `hydrateFromServer` does not apply it.
 */

export type UIMode = 'simple' | 'hub'

interface UIModeState {
  mode: UIMode
  /** True once the server preference has been applied (prevents flash). */
  hydrated: boolean
  /**
   * User left Apply mode to work in Construct; hub can show "Back to Apply?"
   * Not persisted — session-only.
   */
  returnToApply: boolean
}

interface UIModeActions {
  setMode: (mode: UIMode) => void
  toggleMode: () => void
  /** Called after hub data loads. Marks hydration; does not move the visit off Career Card. */
  hydrateFromServer: (serverMode: UIMode | null | undefined) => void
  setReturnToApply: (value: boolean) => void
}

const DEFAULT_MODE: UIMode = 'hub'

export const useUIModeStore = create<UIModeState & UIModeActions>()((set, get) => ({
  mode: DEFAULT_MODE,
  hydrated: false,
  returnToApply: false,

  setMode: (mode) =>
    set({
      mode,
      ...(mode === 'simple' ? { returnToApply: false } : {}),
    }),

  toggleMode: () =>
    set({
      mode: get().mode === 'simple' ? 'hub' : 'simple',
      returnToApply: false,
    }),

  hydrateFromServer: () => {
    if (get().hydrated) return
    // Do not apply the stored preference. It still defaults to Apply from
    // when that was the home, and a reload should open Career Card.
    // Leaving `mode` alone also keeps an Apply click that happened before
    // this hub response arrived.
    set({ hydrated: true })
  },

  setReturnToApply: (value) => set({ returnToApply: value }),
}))

export const useUIMode = () => useUIModeStore((s) => s.mode)
