import { create } from 'zustand'
import { shallow } from 'zustand/shallow'
import { BLOCK_DEFINITIONS, getBlockDefinition } from '@/lib/block-registry'
import type { BlockDefinition } from '@/lib/block-registry'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A block as it exists in the database (hub_blocks row) */
export interface InstalledBlock {
  id: string           // hub_blocks.id (UUID)
  blockType: string    // e.g. 'driver-dot-application'
  position: number
  config: Record<string, unknown>
  addedAt: string
  /** Resolved from the registry — null if block_type is unknown */
  definition: BlockDefinition | null
}

/** What the user has told us about themselves (hub_onboarding row) */
export interface HubOnboarding {
  occupation: string
  seekingReason: string
  suggestedCategories: string[]
  extraContext: string | null
  completedAt: string
}

/** Normalize API snake_case to store camelCase */
function normalizeOnboarding(raw: {
  occupation?: string
  seeking_reason?: string
  suggested_categories?: string[] | null
  extra_context?: string | null
  completed_at?: string
  updated_at?: string
} | null): HubOnboarding | null {
  if (!raw) return null
  return {
    occupation: raw.occupation ?? '',
    seekingReason: raw.seeking_reason ?? '',
    suggestedCategories: raw.suggested_categories ?? [],
    extraContext: raw.extra_context ?? null,
    completedAt: raw.completed_at ?? '',
  }
}

/** Lightweight profile info shown in the hub header */
export interface HubUserProfile {
  firstName: string
  lastName: string
  avatarUrl: string | null
  headline: string | null
}

interface HubBlocksState {
  installedBlocks: InstalledBlock[]
  onboarding: HubOnboarding | null
  userProfile: HubUserProfile | null
  /** Synced from GET /api/hub/blocks — DB `users.ava_auto_welcome_candidate_at` */
  avaAutoWelcomeCandidateDone: boolean
  /** Synced from GET /api/hub/blocks — DB `users.stormi_walkthrough_dismissed_at` (per wallet) */
  walkthroughDismissed: boolean

  isLoading: boolean
  isPickerOpen: boolean
  isEditMode: boolean
  fetchError: string | null

  /** Whether the mandatory onboarding form needs to be shown */
  needsOnboarding: boolean
  /** "Tell Stormi more about you" modal open state */
  isStormiContextModalOpen: boolean
}

interface HubBlocksActions {
  // Data fetching
  fetchHubData: (walletAddress: string) => Promise<void>

  // Block management
  addBlock: (blockType: string, walletAddress: string) => Promise<void>
  removeBlock: (blockId: string, walletAddress: string) => Promise<void>
  /**
   * Reorder blocks after a drag-and-drop. Accepts the new ordered list of
   * installed blocks. Optimistically updates local state, then syncs to API.
   */
  reorderBlocks: (reordered: InstalledBlock[], walletAddress: string) => Promise<void>

  // Onboarding
  completeOnboarding: (
    occupation: string,
    seekingReason: string,
    walletAddress: string,
    extraContext?: string | null
  ) => Promise<void>
  /** Open the Stormi context modal — edit hub onboarding answers anytime (wired in StormiChatPanel + HubProfileHeader) */
  openStormiContextModal: () => void
  closeStormiContextModal: () => void

  /** After Stormi auto-welcome completes server-side (keeps UI in sync without full refetch); DB column names unchanged */
  setStormiAutoWelcomeCandidateDone: (done: boolean) => void
  /** After PATCH walkthrough preference or full hub refetch */
  setWalkthroughDismissed: (dismissed: boolean) => void

  // Profile
  updateAvatarUrl: (url: string) => void
  updateUserProfile: (patch: Partial<HubUserProfile>) => void

  // Edit mode (jiggle / rearrange)
  setEditMode: (on: boolean) => void

  // Picker modal
  openPicker: () => void
  closePicker: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useHubBlocksStore = create<HubBlocksState & HubBlocksActions>()((set, get) => ({
  installedBlocks: [],
  onboarding: null,
  userProfile: null,
  avaAutoWelcomeCandidateDone: false,
  walkthroughDismissed: false,
  isLoading: false,
  isPickerOpen: false,
  isEditMode: false,
  fetchError: null,
  needsOnboarding: false,
  isStormiContextModalOpen: false,

  // ── Fetch ───────────────────────────────────────────────────────────────────
  fetchHubData: async (walletAddress) => {
    set({ isLoading: true, fetchError: null })
    try {
      const res = await fetch('/api/hub/blocks', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!res.ok) throw new Error('Failed to fetch hub data')
      const data = await res.json()

      const installedBlocks: InstalledBlock[] = (data.blocks ?? []).map(
        (row: { id: string; block_type: string; position: number; config: Record<string, unknown>; added_at: string }) => ({
          id: row.id,
          blockType: row.block_type,
          position: row.position,
          config: row.config ?? {},
          addedAt: row.added_at,
          definition: getBlockDefinition(row.block_type) ?? null,
        })
      )

      const rawProfile = data.profile as { first_name: string; last_name: string; avatar_url: string | null; headline?: string | null } | null
      const userProfile: HubUserProfile | null = rawProfile
        ? {
            firstName: rawProfile.first_name ?? '',
            lastName: rawProfile.last_name ?? '',
            avatarUrl: rawProfile.avatar_url ?? null,
            headline: rawProfile.headline ?? null,
          }
        : null

      set({
        installedBlocks,
        onboarding: normalizeOnboarding(data.onboarding ?? null),
        userProfile,
        needsOnboarding: !data.onboarding,
        avaAutoWelcomeCandidateDone: Boolean(data.avaAutoWelcomeCandidateDone),
        walkthroughDismissed: Boolean(data.walkthroughDismissed),
        isLoading: false,
      })

      // Stormi journey reads driver-hub-store (resume / DOT / MVR) — candidates never hit legacy DriverHub
      await syncDriverHubFromApi(walletAddress)
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
      })
    }
  },

  // ── Add block ───────────────────────────────────────────────────────────────
  addBlock: async (blockType, walletAddress) => {
    // Guard: don't add unknown block types or duplicates
    const definition = getBlockDefinition(blockType)
    if (!definition) return
    const alreadyInstalled = get().installedBlocks.some((b) => b.blockType === blockType)
    if (alreadyInstalled) return

    const nextPosition = get().installedBlocks.length

    // Optimistic update
    const optimistic: InstalledBlock = {
      id: `optimistic-${blockType}`,
      blockType,
      position: nextPosition,
      config: {},
      addedAt: new Date().toISOString(),
      definition,
    }
    set((state) => ({ installedBlocks: [...state.installedBlocks, optimistic] }))

    try {
      const res = await fetch('/api/hub/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ blockType, position: nextPosition }),
      })
      if (!res.ok) throw new Error('Failed to add block')
      const { block } = await res.json()

      // Replace optimistic entry with real row from DB
      set((state) => ({
        installedBlocks: state.installedBlocks.map((b) =>
          b.id === optimistic.id
            ? { ...b, id: block.id, addedAt: block.added_at }
            : b
        ),
      }))
    } catch (err) {
      // Roll back optimistic update on failure
      set((state) => ({
        installedBlocks: state.installedBlocks.filter((b) => b.id !== optimistic.id),
      }))
      console.error('[HubBlocksStore] addBlock failed:', err)
    }
  },

  // ── Remove block ────────────────────────────────────────────────────────────
  removeBlock: async (blockId, walletAddress) => {
    const previous = get().installedBlocks

    // Optimistic removal
    set((state) => ({
      installedBlocks: state.installedBlocks.filter((b) => b.id !== blockId),
    }))

    try {
      const res = await fetch(`/api/hub/blocks/${blockId}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!res.ok) throw new Error('Failed to remove block')
    } catch (err) {
      // Roll back on failure
      set({ installedBlocks: previous })
      console.error('[HubBlocksStore] removeBlock failed:', err)
    }
  },

  // ── Reorder blocks ──────────────────────────────────────────────────────────
  reorderBlocks: async (reordered, walletAddress) => {
    // Reassign positions based on new order
    const updated = reordered.map((block, index) => ({ ...block, position: index }))

    // Optimistic update
    set({ installedBlocks: updated })

    try {
      const res = await fetch('/api/hub/blocks/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          order: updated.map((b) => ({ id: b.id, position: b.position })),
        }),
      })
      if (!res.ok) throw new Error('Failed to reorder blocks')
    } catch (err) {
      console.error('[HubBlocksStore] reorderBlocks failed:', err)
      // No rollback here — a stale order is recoverable on next fetch.
      // Silently re-fetch to get consistent server state.
      await get().fetchHubData(walletAddress)
    }
  },

  // ── Onboarding ──────────────────────────────────────────────────────────────
  completeOnboarding: async (occupation, seekingReason, walletAddress, extraContext) => {
    try {
      const res = await fetch('/api/hub/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ occupation, seekingReason, extraContext: extraContext ?? undefined }),
      })
      if (!res.ok) throw new Error('Failed to save onboarding')
      const { onboarding } = await res.json()

      set({
        onboarding: normalizeOnboarding(onboarding),
        needsOnboarding: false,
      })
    } catch (err) {
      console.error('[HubBlocksStore] completeOnboarding failed:', err)
      throw err // Surface to the form so it can show an error state
    }
  },

  openStormiContextModal: () => set({ isStormiContextModalOpen: true }),
  closeStormiContextModal: () => set({ isStormiContextModalOpen: false }),

  setStormiAutoWelcomeCandidateDone: (done) => set({ avaAutoWelcomeCandidateDone: done }),

  setWalkthroughDismissed: (dismissed) => set({ walkthroughDismissed: dismissed }),

  // ── Picker ──────────────────────────────────────────────────────────────────
  // ── Profile ─────────────────────────────────────────────────────────────────
  updateAvatarUrl: (url) =>
    set((s) => ({
      userProfile: s.userProfile
        ? { ...s.userProfile, avatarUrl: url }
        : { firstName: '', lastName: '', avatarUrl: url, headline: null },
    })),

  updateUserProfile: (patch) =>
    set((s) => ({
      userProfile: s.userProfile
        ? { ...s.userProfile, ...patch }
        : { firstName: '', lastName: '', avatarUrl: null, headline: null, ...patch },
    })),

  // ── Edit mode ──────────────────────────────────────────────────────────────
  setEditMode: (on) => set({ isEditMode: on }),

  // ── Picker ─────────────────────────────────────────────────────────────────
  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false }),
}))

// ── Selector hooks ────────────────────────────────────────────────────────────
// Fine-grained selectors prevent re-renders when unrelated state changes.

export const useInstalledBlocks = () =>
  useHubBlocksStore((s) => s.installedBlocks)

export const useIsPickerOpen = () =>
  useHubBlocksStore((s) => s.isPickerOpen)

export const useIsEditMode = () =>
  useHubBlocksStore((s) => s.isEditMode)

export const useNeedsOnboarding = () =>
  useHubBlocksStore((s) => s.needsOnboarding)

export const useHubOnboarding = () =>
  useHubBlocksStore((s) => s.onboarding)

export const useStormiAutoWelcomeCandidateDone = () =>
  useHubBlocksStore((s) => s.avaAutoWelcomeCandidateDone)

export const useWalkthroughDismissed = () =>
  useHubBlocksStore((s) => s.walkthroughDismissed)

/**
 * Returns block definitions the user has NOT yet installed.
 * Uses shallow equality so a new array reference from .filter()
 * doesn't cause an infinite re-render loop.
 */
export const useAvailableBlocks = () =>
  useHubBlocksStore(
    (s) => {
      const installedTypes = new Set(s.installedBlocks.map((b) => b.blockType))
      return BLOCK_DEFINITIONS.filter((b) => !installedTypes.has(b.id))
    },
    shallow
  )
