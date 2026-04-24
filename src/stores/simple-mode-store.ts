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
}

interface SimpleModeActions {
  setSelection: (snapshot: SelectedJobSnapshot | null) => void
  clearSelection: () => void
  openCardSheet: () => void
  closeCardSheet: () => void
  setFilter: <K extends keyof SimpleJobFilters>(key: K, value: SimpleJobFilters[K]) => void
  resetFilters: () => void
}

export const useSimpleModeStore = create<SimpleModeState & SimpleModeActions>((set) => ({
  selectedJobId: null,
  selectedJobSource: null,
  selectedJobSnapshot: null,
  isCardSheetOpen: false,
  filters: DEFAULT_FILTERS,

  setSelection: (snapshot) =>
    set({
      selectedJobId: snapshot?.id ?? null,
      selectedJobSource: snapshot?.source ?? null,
      selectedJobSnapshot: snapshot,
    }),

  clearSelection: () =>
    set({ selectedJobId: null, selectedJobSource: null, selectedJobSnapshot: null }),

  openCardSheet: () => set({ isCardSheetOpen: true }),
  closeCardSheet: () => set({ isCardSheetOpen: false }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}))

export const useSelectedJobSnapshot = () =>
  useSimpleModeStore((s) => s.selectedJobSnapshot)
