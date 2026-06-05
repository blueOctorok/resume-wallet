import { create } from 'zustand'

export interface EmployerInstalledHubBlock {
  id: string
  blockType: string
  position: number
  config: Record<string, unknown>
  addedAt: string
}

interface EmployerBlocksState {
  installedBlocks: EmployerInstalledHubBlock[]
  canManageEmployerBlocks: boolean
  recentAudit: Array<{
    id: string
    block_type: string
    action: string
    actor_kind: string
    reason: string | null
    created_at: string
  }>
  isLoading: boolean
  fetchError: string | null
  isPickerOpen: boolean
}

interface EmployerBlocksActions {
  fetchEmployerBlocks: (sessionUserId: string) => Promise<void>
  installBlock: (sessionUserId: string, blockType: string, reason?: string | null) => Promise<boolean>
  removeBlock: (sessionUserId: string, rowId: string, reason?: string | null) => Promise<boolean>
  openPicker: () => void
  closePicker: () => void
}

export const useEmployerBlocksStore = create<EmployerBlocksState & EmployerBlocksActions>()((set, get) => ({
  installedBlocks: [],
  canManageEmployerBlocks: false,
  recentAudit: [],
  isLoading: false,
  fetchError: null,
  isPickerOpen: false,

  fetchEmployerBlocks: async (sessionUserId) => {
    set({ isLoading: true, fetchError: null })
    try {
      const res = await fetch('/api/employer/hub/blocks')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Failed to load employer blocks')
      }
      const data = await res.json()
      const blocks: EmployerInstalledHubBlock[] = (data.blocks ?? []).map(
        (row: {
          id: string
          block_type: string
          position: number
          config: Record<string, unknown> | null
          added_at: string
        }) => ({
          id: row.id,
          blockType: row.block_type,
          position: row.position,
          config: row.config ?? {},
          addedAt: row.added_at,
        }),
      )
      set({
        installedBlocks: blocks,
        canManageEmployerBlocks: Boolean(data.canManageEmployerBlocks),
        recentAudit: data.recentAudit ?? [],
        isLoading: false,
      })
    } catch (e) {
      set({
        fetchError: e instanceof Error ? e.message : 'Unknown error',
        isLoading: false,
      })
    }
  },

  installBlock: async (sessionUserId, blockType, reason) => {
    try {
      const res = await fetch('/api/employer/hub/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockType, reason: reason ?? undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Install failed')
      }
      await get().fetchEmployerBlocks(sessionUserId)
      return true
    } catch (e) {
      console.error('[EmployerBlocksStore] installBlock:', e)
      return false
    }
  },

  removeBlock: async (sessionUserId, rowId, reason) => {
    try {
      const res = await fetch(`/api/employer/hub/blocks/${rowId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason ?? undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Remove failed')
      }
      await get().fetchEmployerBlocks(sessionUserId)
      return true
    } catch (e) {
      console.error('[EmployerBlocksStore] removeBlock:', e)
      return false
    }
  },

  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false }),
}))
