import { create } from 'zustand'
import type { DisclosureAudiencePreferences } from '@/lib/disclosure-preferences'
import type { ShippedFactType } from '@/lib/fact-registry'

const DISCLOSURE_API = '/api/attestation/disclosure-preferences'

interface DisclosureFactTypeMeta {
  factType: ShippedFactType
  label: string
  description: string
  category: string
}

interface DisclosurePreferencesState {
  audiences: DisclosureAudiencePreferences[]
  factTypes: DisclosureFactTypeMeta[]
  isLoaded: boolean
  isMutating: boolean
  error: string | null
}

interface DisclosurePreferencesActions {
  fetchPreferences: () => Promise<void>
  setFactAllowed: (
    audienceId: string,
    factType: ShippedFactType,
    allowed: boolean,
  ) => Promise<boolean>
  reset: () => void
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function request<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: (body as { error?: string }).error ?? 'Request failed' }
  }
  return { ok: true, data: body as T }
}

export const useDisclosurePreferencesStore = create<
  DisclosurePreferencesState & DisclosurePreferencesActions
>((set, get) => ({
  audiences: [],
  factTypes: [],
  isLoaded: false,
  isMutating: false,
  error: null,

  fetchPreferences: async () => {
    set({ error: null })
    const result = await request<{
      audiences: DisclosureAudiencePreferences[]
      factTypes: DisclosureFactTypeMeta[]
    }>(DISCLOSURE_API)

    if (!result.ok) {
      set({ error: result.error, isLoaded: true })
      return
    }

    set({
      audiences: result.data.audiences ?? [],
      factTypes: result.data.factTypes ?? [],
      isLoaded: true,
      error: null,
    })
  },

  setFactAllowed: async (audienceId, factType, allowed) => {
    set({ isMutating: true, error: null })

    const result = await request<{ success: boolean }>(DISCLOSURE_API, {
      method: 'PATCH',
      body: JSON.stringify({ audienceId, factType, allowed }),
    })

    if (!result.ok) {
      set({ isMutating: false, error: result.error })
      return false
    }

    const audiences = get().audiences.map((audience) => {
      if (audience.companyId !== audienceId) return audience
      return {
        ...audience,
        facts: audience.facts.map((fact) =>
          fact.factType === factType ? { ...fact, allowed } : fact,
        ),
      }
    })

    set({ audiences, isMutating: false })
    return true
  },

  reset: () => {
    set({
      audiences: [],
      factTypes: [],
      isLoaded: false,
      isMutating: false,
      error: null,
    })
  },
}))
