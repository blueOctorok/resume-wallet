import { create } from 'zustand'
import type { DqCoachReview } from '@/lib/dq-coach'

interface DqCoachState {
  review: DqCoachReview | null
  isLoading: boolean
  error: string | null
  scannedAt: string | null
  scan: () => Promise<void>
}

export const useDqCoachStore = create<DqCoachState>((set, get) => ({
  review: null,
  isLoading: false,
  error: null,
  scannedAt: null,

  scan: async () => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/ai/dq-review', { method: 'POST' })
      const json = (await res.json()) as { review?: DqCoachReview; error?: string }
      if (!res.ok || !json.review) {
        throw new Error(json.error || 'Review failed')
      }
      set({ review: json.review, scannedAt: new Date().toISOString(), isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Review failed',
        isLoading: false,
      })
    }
  },
}))
