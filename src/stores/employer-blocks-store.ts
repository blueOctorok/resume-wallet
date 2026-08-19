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
  isLoading: boolean
  fetchError: string | null
}

interface EmployerBlocksActions {
  /**
   * Loads the company's employer blocks. The API auto-provisions every
   * installable block server-side, so after this resolves the full capability
   * set is installed — there is no client-side install/remove flow.
   */
  fetchEmployerBlocks: (sessionUserId: string) => Promise<void>
}

export const useEmployerBlocksStore = create<EmployerBlocksState & EmployerBlocksActions>()((set) => ({
  installedBlocks: [],
  isLoading: false,
  fetchError: null,

  fetchEmployerBlocks: async () => {
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
      set({ installedBlocks: blocks, isLoading: false })
    } catch (e) {
      set({
        fetchError: e instanceof Error ? e.message : 'Unknown error',
        isLoading: false,
      })
    }
  },
}))
