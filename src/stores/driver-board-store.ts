import { create } from 'zustand'
import type { DqMonitorCandidateRow, DriverFileDetail } from '@/lib/dq-file-load'
import type { DqFileSnapshot } from '@/lib/dq-file-status'
import type { BallInCourt } from '@/lib/driver-journey'

export type DriverRosterRow = DqMonitorCandidateRow

export interface DriverFile {
  candidate: {
    userId: string
    name: string
    avatarUrl: string | null
    email: string | null
    phone: string | null
    headline: string | null
  }
  dqFile: DqFileSnapshot
  detail: DriverFileDetail
}

export type DriverBoardFilter = 'all' | 'recent' | 'signed-up' | BallInCourt

interface DriverBoardState {
  roster: DriverRosterRow[]
  includesSelfServe: boolean
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  filter: DriverBoardFilter
  search: string
  /** Whoever's file is open — set from a row on the status board. */
  selectedUserId: string | null
  fileByUserId: Record<string, DriverFile>
  fileLoading: boolean
  fileError: string | null
}

interface DriverBoardActions {
  fetchRoster: (silent?: boolean) => Promise<void>
  setFilter: (filter: DriverBoardFilter) => void
  setSearch: (search: string) => void
  openDriver: (userId: string) => void
  closeDriver: () => void
  /** Re-pull one file (after a report was viewed / consent resent) and refresh the roster row quietly. */
  refreshFile: (userId: string) => Promise<void>
}

async function fetchDriverFile(userId: string): Promise<DriverFile> {
  const res = await fetch(`/api/employer/dq-monitor/${userId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load driver file')
  return { candidate: data.candidate, dqFile: data.dqFile, detail: data.detail }
}

export const useDriverBoardStore = create<DriverBoardState & DriverBoardActions>()((set, get) => ({
  roster: [],
  includesSelfServe: false,
  isLoading: false,
  isRefreshing: false,
  error: null,
  filter: 'all',
  search: '',
  selectedUserId: null,
  fileByUserId: {},
  fileLoading: false,
  fileError: null,

  fetchRoster: async (silent = false) => {
    set(silent ? { isRefreshing: true, error: null } : { isLoading: true, error: null })
    try {
      const res = await fetch('/api/employer/dq-monitor')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drivers')
      set({ roster: data.candidates ?? [], includesSelfServe: Boolean(data.includesSelfServe) })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load drivers' })
    } finally {
      set({ isLoading: false, isRefreshing: false })
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),

  openDriver: (userId) => {
    set({ selectedUserId: userId, fileError: null })
    if (!get().fileByUserId[userId]) void get().refreshFile(userId)
  },

  closeDriver: () => set({ selectedUserId: null, fileError: null }),

  refreshFile: async (userId) => {
    set({ fileLoading: true, fileError: null })
    try {
      const file = await fetchDriverFile(userId)
      set((s) => ({ fileByUserId: { ...s.fileByUserId, [userId]: file } }))
      void get().fetchRoster(true)
    } catch (e) {
      set({ fileError: e instanceof Error ? e.message : 'Failed to load driver file' })
    } finally {
      set({ fileLoading: false })
    }
  },
}))
