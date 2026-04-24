import { create } from 'zustand'
import type { CareerCardLens } from '@/lib/career-card-lenses'

/**
 * Career Card Lenses — client store.
 *
 * The default "Full profile" lens is guaranteed server-side (migration 068 +
 * trigger + helper backfill), so this store can assume `defaultLensId` is set
 * once `isLoaded` is true.
 *
 * All writes go through the API first, then we refresh from server (single
 * source of truth). Optimistic updates aren't worth the complexity here — CRUD
 * is rare, and lens switching is already instant because projection happens
 * on GET /api/career-card.
 */

interface CareerCardLensesState {
  lenses: CareerCardLens[]
  defaultLensId: string | null
  isLoaded: boolean
  isMutating: boolean
  error: string | null
}

interface CareerCardLensesActions {
  fetchLenses: (walletAddress: string) => Promise<void>
  createLens: (
    walletAddress: string,
    input: {
      name: string
      visibleBlockTypes?: string[] | null
      emphasizedBlockTypes?: string[]
      customSummary?: string | null
    },
  ) => Promise<CareerCardLens | null>
  renameLens: (walletAddress: string, id: string, name: string) => Promise<boolean>
  updateLens: (
    walletAddress: string,
    id: string,
    patch: {
      name?: string
      visibleBlockTypes?: string[] | null
      emphasizedBlockTypes?: string[]
      customSummary?: string | null
    },
  ) => Promise<boolean>
  deleteLens: (walletAddress: string, id: string) => Promise<boolean>
  reset: () => void
}

type RequestResult<T> = { ok: true; data: T; error?: never } | { ok: false; error: string; data?: never }

async function request<T>(
  url: string,
  walletAddress: string,
  init: RequestInit = {},
): Promise<RequestResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-wallet-address': walletAddress,
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: (body as { error?: string }).error ?? 'Request failed' }
  }
  return { ok: true, data: body as T }
}

export const useCareerCardLensesStore = create<
  CareerCardLensesState & CareerCardLensesActions
>((set, get) => ({
  lenses: [],
  defaultLensId: null,
  isLoaded: false,
  isMutating: false,
  error: null,

  fetchLenses: async (walletAddress) => {
    const result = await request<{ lenses: CareerCardLens[] }>(
      '/api/career-card/lenses',
      walletAddress,
    )
    if (!result.ok) {
      set({ error: result.error, isLoaded: true })
      return
    }
    const lenses = result.data.lenses ?? []
    const def = lenses.find((l) => l.isDefault) ?? null
    set({
      lenses,
      defaultLensId: def?.id ?? null,
      isLoaded: true,
      error: null,
    })
  },

  createLens: async (walletAddress, input) => {
    set({ isMutating: true, error: null })
    const result = await request<{ lens: CareerCardLens }>(
      '/api/career-card/lenses',
      walletAddress,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
    set({ isMutating: false })
    if (!result.ok) {
      set({ error: result.error })
      return null
    }
    await get().fetchLenses(walletAddress)
    return result.data.lens
  },

  renameLens: async (walletAddress, id, name) =>
    get().updateLens(walletAddress, id, { name }),

  updateLens: async (walletAddress, id, patch) => {
    set({ isMutating: true, error: null })
    const result = await request<{ lens: CareerCardLens }>(
      `/api/career-card/lenses/${id}`,
      walletAddress,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    )
    set({ isMutating: false })
    if (!result.ok) {
      set({ error: result.error })
      return false
    }
    await get().fetchLenses(walletAddress)
    return true
  },

  deleteLens: async (walletAddress, id) => {
    set({ isMutating: true, error: null })
    const result = await request<{ success: boolean }>(
      `/api/career-card/lenses/${id}`,
      walletAddress,
      { method: 'DELETE' },
    )
    set({ isMutating: false })
    if (!result.ok) {
      set({ error: result.error })
      return false
    }
    await get().fetchLenses(walletAddress)
    return true
  },

  reset: () =>
    set({
      lenses: [],
      defaultLensId: null,
      isLoaded: false,
      isMutating: false,
      error: null,
    }),
}))

export const useLenses = () => useCareerCardLensesStore((s) => s.lenses)
export const useDefaultLensId = () => useCareerCardLensesStore((s) => s.defaultLensId)
