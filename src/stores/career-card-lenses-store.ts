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
  fetchLenses: (sessionUserId: string) => Promise<void>
  createLens: (
    sessionUserId: string,
    input: {
      name: string
      visibleBlockTypes?: string[] | null
      emphasizedBlockTypes?: string[]
      customSummary?: string | null
    },
  ) => Promise<CareerCardLens | null>
  renameLens: (sessionUserId: string, id: string, name: string) => Promise<boolean>
  updateLens: (
    sessionUserId: string,
    id: string,
    patch: {
      name?: string
      visibleBlockTypes?: string[] | null
      emphasizedBlockTypes?: string[]
      customSummary?: string | null
    },
  ) => Promise<boolean>
  deleteLens: (sessionUserId: string, id: string) => Promise<boolean>
  reset: () => void
}

type RequestResult<T> = { ok: true; data: T; error?: never } | { ok: false; error: string; data?: never }

async function request<T>(
  url: string,
  sessionUserId: string,
  init: RequestInit = {},
): Promise<RequestResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json',
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

  fetchLenses: async (sessionUserId) => {
    const result = await request<{ lenses: CareerCardLens[] }>(
      '/api/career-card/lenses',
      sessionUserId,
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

  createLens: async (sessionUserId, input) => {
    set({ isMutating: true, error: null })
    const result = await request<{ lens: CareerCardLens }>(
      '/api/career-card/lenses',
      sessionUserId,
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
    await get().fetchLenses(sessionUserId)
    return result.data.lens
  },

  renameLens: async (sessionUserId, id, name) =>
    get().updateLens(sessionUserId, id, { name }),

  updateLens: async (sessionUserId, id, patch) => {
    set({ isMutating: true, error: null })
    const result = await request<{ lens: CareerCardLens }>(
      `/api/career-card/lenses/${id}`,
      sessionUserId,
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
    await get().fetchLenses(sessionUserId)
    return true
  },

  deleteLens: async (sessionUserId, id) => {
    set({ isMutating: true, error: null })
    const result = await request<{ success: boolean }>(
      `/api/career-card/lenses/${id}`,
      sessionUserId,
      { method: 'DELETE' },
    )
    set({ isMutating: false })
    if (!result.ok) {
      set({ error: result.error })
      return false
    }
    await get().fetchLenses(sessionUserId)
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
