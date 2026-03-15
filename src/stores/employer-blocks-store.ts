import { create } from 'zustand'
import { shallow } from 'zustand/shallow'
import {
  EMPLOYER_BLOCK_DEFINITIONS,
  getEmployerBlockDefinition,
} from '@/lib/employer-block-registry'
import type { EmployerBlockDefinition } from '@/lib/employer-block-registry'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InstalledEmployerBlock {
  id: string
  blockType: string
  position: number
  config: Record<string, unknown>
  addedAt: string
  definition: EmployerBlockDefinition | null
}

interface EmployerBlocksState {
  installedBlocks: InstalledEmployerBlock[]
  companyId: string | null

  isLoading: boolean
  isPickerOpen: boolean
  isEditMode: boolean
  fetchError: string | null
}

interface EmployerBlocksActions {
  fetchEmployerBlocks: (walletAddress: string) => Promise<void>
  addBlock: (blockType: string, walletAddress: string) => Promise<void>
  removeBlock: (blockId: string, walletAddress: string) => Promise<void>

  setEditMode: (on: boolean) => void
  openPicker: () => void
  closePicker: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEmployerBlocksStore = create<EmployerBlocksState & EmployerBlocksActions>()(
  (set, get) => ({
    installedBlocks: [],
    companyId: null,
    isLoading: false,
    isPickerOpen: false,
    isEditMode: false,
    fetchError: null,

    // ── Fetch ─────────────────────────────────────────────────────────────────
    fetchEmployerBlocks: async (walletAddress) => {
      set({ isLoading: true, fetchError: null })
      try {
        const res = await fetch('/api/employer/blocks', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!res.ok) throw new Error('Failed to fetch employer blocks')
        const data = await res.json()

        const installedBlocks: InstalledEmployerBlock[] = (data.blocks ?? []).map(
          (row: { id: string; block_type: string; position: number; config: Record<string, unknown>; added_at: string }) => ({
            id: row.id,
            blockType: row.block_type,
            position: row.position,
            config: row.config ?? {},
            addedAt: row.added_at,
            definition: getEmployerBlockDefinition(row.block_type) ?? null,
          })
        )

        set({
          installedBlocks,
          companyId: data.companyId ?? null,
          isLoading: false,
        })
      } catch (err) {
        set({
          fetchError: err instanceof Error ? err.message : 'Unknown error',
          isLoading: false,
        })
      }
    },

    // ── Add block ─────────────────────────────────────────────────────────────
    addBlock: async (blockType, walletAddress) => {
      const definition = getEmployerBlockDefinition(blockType)
      if (!definition) return
      if (get().installedBlocks.some((b) => b.blockType === blockType)) return

      const nextPosition = get().installedBlocks.length

      const optimistic: InstalledEmployerBlock = {
        id: `optimistic-${blockType}`,
        blockType,
        position: nextPosition,
        config: {},
        addedAt: new Date().toISOString(),
        definition,
      }
      set((s) => ({ installedBlocks: [...s.installedBlocks, optimistic] }))

      try {
        const res = await fetch('/api/employer/blocks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify({ blockType, position: nextPosition }),
        })
        if (!res.ok) throw new Error('Failed to add block')
        const { block } = await res.json()

        set((s) => ({
          installedBlocks: s.installedBlocks.map((b) =>
            b.id === optimistic.id
              ? { ...b, id: block.id, addedAt: block.added_at }
              : b
          ),
        }))
      } catch (err) {
        set((s) => ({
          installedBlocks: s.installedBlocks.filter((b) => b.id !== optimistic.id),
        }))
        console.error('[EmployerBlocksStore] addBlock failed:', err)
      }
    },

    // ── Remove block ──────────────────────────────────────────────────────────
    removeBlock: async (blockId, walletAddress) => {
      const previous = get().installedBlocks
      set((s) => ({
        installedBlocks: s.installedBlocks.filter((b) => b.id !== blockId),
      }))

      try {
        const res = await fetch(`/api/employer/blocks/${blockId}`, {
          method: 'DELETE',
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!res.ok) throw new Error('Failed to remove block')
      } catch (err) {
        set({ installedBlocks: previous })
        console.error('[EmployerBlocksStore] removeBlock failed:', err)
      }
    },

    // ── UI ────────────────────────────────────────────────────────────────────
    setEditMode: (on) => set({ isEditMode: on }),
    openPicker: () => set({ isPickerOpen: true }),
    closePicker: () => set({ isPickerOpen: false }),
  })
)

// ── Selectors ─────────────────────────────────────────────────────────────────

export const useEmployerInstalledBlocks = () =>
  useEmployerBlocksStore((s) => s.installedBlocks)

export const useEmployerIsPickerOpen = () =>
  useEmployerBlocksStore((s) => s.isPickerOpen)

export const useEmployerIsEditMode = () =>
  useEmployerBlocksStore((s) => s.isEditMode)

export const useAvailableEmployerBlocks = () =>
  useEmployerBlocksStore(
    (s) => {
      const installedTypes = new Set(s.installedBlocks.map((b) => b.blockType))
      return EMPLOYER_BLOCK_DEFINITIONS.filter((b) => !installedTypes.has(b.id))
    },
    shallow
  )
