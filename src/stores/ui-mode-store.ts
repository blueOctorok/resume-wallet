import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * UI Mode Store
 *
 * Controls which chrome the candidate sees:
 * - `simple`   → job-first split view (`SimpleModeShell`) — new user default
 * - `hub`      → the composable workspace (`CandidateHub`) — power users
 *
 * The underlying data (hub blocks, career card, Stormi) is identical in both
 * modes. This store only toggles the chrome.
 *
 * Persistence: localStorage (instant UX). The server DB column
 * `users.ui_mode_preference` mirrors this value so preference is portable
 * across devices — hydrated via `hydrateFromServer` once the profile loads.
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
  /** One-shot: open the block picker once after landing in Construct from Apply. */
  openPickerAfterHub: boolean
}

interface UIModeActions {
  setMode: (mode: UIMode) => void
  toggleMode: () => void
  /** Called after `/api/user/profile` resolves. No-op if the local value already matches. */
  hydrateFromServer: (serverMode: UIMode | null | undefined) => void
  setReturnToApply: (value: boolean) => void
  setOpenPickerAfterHub: (value: boolean) => void
}

const DEFAULT_MODE: UIMode = 'simple'

export const useUIModeStore = create<UIModeState & UIModeActions>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_MODE,
      hydrated: false,
      returnToApply: false,
      openPickerAfterHub: false,

      setMode: (mode) =>
        set({
          mode,
          ...(mode === 'simple'
            ? { returnToApply: false, openPickerAfterHub: false }
            : {}),
        }),

      toggleMode: () =>
        set({
          mode: get().mode === 'simple' ? 'hub' : 'simple',
          returnToApply: false,
          openPickerAfterHub: false,
        }),

      hydrateFromServer: (serverMode) => {
        if (get().hydrated) return
        if (serverMode === 'simple' || serverMode === 'hub') {
          set({ mode: serverMode, hydrated: true })
        } else {
          set({ hydrated: true })
        }
      },

      setReturnToApply: (value) => set({ returnToApply: value }),
      setOpenPickerAfterHub: (value) => set({ openPickerAfterHub: value }),
    }),
    {
      name: 'stormchain-ui-mode',
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
)

export const useUIMode = () => useUIModeStore((s) => s.mode)
