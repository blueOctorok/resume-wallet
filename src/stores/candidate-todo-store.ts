import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useAuthStore } from './auth-store'
import { useHubBlocksStore } from './hub-blocks-store'
import { useJourneyProgress } from './journey-store'
import {
  buildCandidateTodo,
  type CandidateTodo,
  type PendingEmployerRequest,
} from '@/lib/candidate-todo'

/**
 * Holds the one server signal the to-do needs that no other store has:
 * the newest pending employer request (with company name). Everything else
 * is derived live from journey/hub stores in useCandidateTodo below.
 */

interface RawRequest {
  id: string
  requestType: string
  targetBlockType: string | null
  status: string
  createdAt: string
  company: { name?: string | null } | null
}

interface CandidateTodoState {
  pendingRequest: PendingEmployerRequest | null
  hasFetched: boolean
  isFetching: boolean
  fetchPendingRequest: () => Promise<void>
  clear: () => void
}

export const useCandidateTodoStore = create<CandidateTodoState>((set, get) => ({
  pendingRequest: null,
  hasFetched: false,
  isFetching: false,

  fetchPendingRequest: async () => {
    if (get().isFetching) return
    set({ isFetching: true })
    try {
      const res = await fetch('/api/candidate/requests')
      if (!res.ok) {
        set({ pendingRequest: null, hasFetched: true })
        return
      }
      const data = await res.json()
      const raw: RawRequest[] = data?.requests ?? []
      // Rows come newest-first from the API; take the first still-open one.
      const match = raw.find((r) => r.status === 'pending' || r.status === 'viewed')
      set({
        pendingRequest: match
          ? {
              id: match.id,
              companyName: match.company?.name ?? 'An employer',
              targetBlockType: match.targetBlockType,
              requestType: match.requestType,
            }
          : null,
        hasFetched: true,
      })
    } catch (err) {
      console.error('[CANDIDATE TODO] pending request fetch error:', err)
      set({ pendingRequest: null, hasFetched: true })
    } finally {
      set({ isFetching: false })
    }
  },

  clear: () => set({ pendingRequest: null, hasFetched: false }),
}))

/**
 * Derived "what's next" checklist for the signed-in candidate.
 * Journey/hub stores update live; the pending-request fetch runs once
 * per session (first component to mount the hook triggers it).
 */
export function useCandidateTodo(): CandidateTodo {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)
  const journey = useJourneyProgress()
  const { pendingRequest, hasFetched, fetchPendingRequest } = useCandidateTodoStore()

  useEffect(() => {
    if (sessionUserId && !hasFetched) fetchPendingRequest()
  }, [sessionUserId, hasFetched, fetchPendingRequest])

  const hasBlocks = installedBlocks.length > 0

  return useMemo(
    () => buildCandidateTodo(journey, pendingRequest, hasBlocks),
    [journey, pendingRequest, hasBlocks],
  )
}
