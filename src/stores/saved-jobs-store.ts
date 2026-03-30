import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Staging lanes on Hunt Desk — not employer pipeline semantics. */
export type ShortlistLane = 'watching' | 'pursuing' | 'ready'

/** Local shortlist — no auto-apply; user stars roles to revisit (e.g. after MVR). */
export interface SavedJobEntry {
  id: string
  title: string
  company: string
  location: string
  description: string | null
  salary: string | null
  redirectUrl: string | null
  isStormChain: boolean
  savedAt: string
  /** Hunt Desk column; omitted in persisted data before this field → treat as `watching`. */
  lane?: ShortlistLane
}

interface SavedJobsState {
  jobs: SavedJobEntry[]
}

interface SavedJobsActions {
  toggleSaved: (job: Omit<SavedJobEntry, 'savedAt' | 'lane'>) => void
  removeSaved: (id: string) => void
  isSaved: (id: string) => boolean
  clearAll: () => void
  moveJobToLane: (id: string, lane: ShortlistLane) => void
}

export const useSavedJobsStore = create<SavedJobsState & SavedJobsActions>()(
  persist(
    (set, get) => ({
      jobs: [],

      toggleSaved: (job) => {
        const existing = get().jobs.find((j) => j.id === job.id)
        if (existing) {
          set({ jobs: get().jobs.filter((j) => j.id !== job.id) })
          return
        }
        const entry: SavedJobEntry = {
          ...job,
          savedAt: new Date().toISOString(),
          lane: 'watching',
        }
        set({ jobs: [entry, ...get().jobs.filter((j) => j.id !== job.id)] })
      },

      removeSaved: (id) => set({ jobs: get().jobs.filter((j) => j.id !== id) }),

      isSaved: (id) => get().jobs.some((j) => j.id === id),

      clearAll: () => set({ jobs: [] }),

      moveJobToLane: (id, lane) =>
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? { ...j, lane } : j)),
        })),
    }),
    {
      name: 'stormchain-saved-jobs',
      partialize: (s) => ({ jobs: s.jobs }),
    },
  ),
)
