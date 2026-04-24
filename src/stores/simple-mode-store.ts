import { create } from 'zustand'

/**
 * Simple-mode selection store
 *
 * The selected job is ephemeral session state — it's the "what am I targeting
 * right now?" pointer. The URL (`?selected=…&source=…`) is the source of truth
 * on first paint (so share / back / refresh work); after that, this store is
 * authoritative while the user clicks around.
 *
 * A snapshot of the job is kept so the right-hand card + Stormi can compute
 * fit without refetching on every render. The snapshot is intentionally
 * lightweight — fit scoring re-fetches the full job record when needed.
 */

export type JobSource = 'stormchain' | 'adzuna' | 'saved'

export interface SelectedJobSnapshot {
  id: string
  source: JobSource
  title: string
  company: string
  location: string
  description: string | null
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  redirectUrl: string | null
  targetRole: string | null
  remoteAllowed: boolean | null
  isStormChain: boolean
}

/** Contract types the filter chips can toggle. Adzuna supports all three. */
export type JobTypeFilter = 'full_time' | 'part_time' | 'contract'

/**
 * Filter chips for the Adzuna job rail. Kept tiny on purpose — salary floor,
 * job type, and a client-side "remote only" post-filter cover ~80% of intent
 * without turning Simple mode into the Hub's advanced search.
 */
export interface SimpleJobFilters {
  /** Hide listings below this minimum annual salary (USD). `null` disables. */
  salaryFloor: number | null
  /** Adzuna contract flag. `null` means any. */
  jobType: JobTypeFilter | null
  /** Post-filter: only show listings whose title/description hints at remote. */
  remoteOnly: boolean
}

export const DEFAULT_FILTERS: SimpleJobFilters = {
  salaryFloor: null,
  jobType: null,
  remoteOnly: false,
}

interface SimpleModeState {
  selectedJobId: string | null
  selectedJobSource: JobSource | null
  selectedJobSnapshot: SelectedJobSnapshot | null
  /** True when the mobile swipe-up card sheet is open. Desktop ignores this. */
  isCardSheetOpen: boolean
  filters: SimpleJobFilters
  /**
   * Which lens is currently projected over the user's card. `null` = the
   * default "Full profile" lens from the server. Ephemeral; URL sync lives
   * in a separate hook in Phase 4.
   */
  activeLensId: string | null
  /**
   * Remembered so the quiet "undo" affordance in the chip area knows which
   * lens Stormi auto-switched AWAY from when a new job is picked.
   */
  lastAutoPickedLensId: string | null
  /**
   * True when the user manually chose a lens this session. While true, the
   * Phase 3 auto-picker respects the pick and does NOT switch on job change.
   * Cleared automatically when the user switches to a different job.
   */
  overrideAutoPick: boolean
}

interface SimpleModeActions {
  setSelection: (snapshot: SelectedJobSnapshot | null) => void
  clearSelection: () => void
  openCardSheet: () => void
  closeCardSheet: () => void
  setFilter: <K extends keyof SimpleJobFilters>(key: K, value: SimpleJobFilters[K]) => void
  resetFilters: () => void
  /** User-initiated lens change. Marks overrideAutoPick so auto-pick backs off. */
  setActiveLens: (lensId: string | null) => void
  /** Stormi-initiated switch. Does NOT mark overrideAutoPick. */
  autoPickLens: (lensId: string | null) => void
}

export const useSimpleModeStore = create<SimpleModeState & SimpleModeActions>((set) => ({
  selectedJobId: null,
  selectedJobSource: null,
  selectedJobSnapshot: null,
  isCardSheetOpen: false,
  filters: DEFAULT_FILTERS,
  activeLensId: null,
  lastAutoPickedLensId: null,
  overrideAutoPick: false,

  setSelection: (snapshot) =>
    set((state) => ({
      selectedJobId: snapshot?.id ?? null,
      selectedJobSource: snapshot?.source ?? null,
      selectedJobSnapshot: snapshot,
      // A new job selection releases the override — Stormi gets to auto-pick
      // again. If the user doesn't love the new pick, they can switch back.
      overrideAutoPick:
        snapshot?.id && snapshot.id === state.selectedJobId ? state.overrideAutoPick : false,
    })),

  clearSelection: () =>
    set({ selectedJobId: null, selectedJobSource: null, selectedJobSnapshot: null }),

  openCardSheet: () => set({ isCardSheetOpen: true }),
  closeCardSheet: () => set({ isCardSheetOpen: false }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setActiveLens: (lensId) =>
    set({ activeLensId: lensId, overrideAutoPick: true }),

  autoPickLens: (lensId) =>
    set((state) => ({
      activeLensId: lensId,
      lastAutoPickedLensId: state.activeLensId,
    })),
}))

export const useSelectedJobSnapshot = () =>
  useSimpleModeStore((s) => s.selectedJobSnapshot)
