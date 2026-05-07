'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Pending employer screening request (MVR or PSP) for the current candidate.
 * Used by MvrOrderForm + PspOrderForm to show the FCRA disclosure gate
 * even when the candidate deep-links straight into the order page from a notification.
 *
 * Shape mirrors the subset of fields these forms actually need from
 * `/api/candidate/requests` — kept minimal so changes to the requests API
 * don't ripple into every form.
 */
export interface PendingScreeningRequest {
  id: string
  companyName: string
  createdAt: string
}

type Kind = 'mvr' | 'psp'

interface RawRequest {
  id: string
  requestType: string
  targetBlockType: string | null
  status: string
  createdAt: string
  company: { name?: string | null } | null
}

function isPendingForKind(kind: Kind, r: RawRequest): boolean {
  if (r.status !== 'pending' && r.status !== 'viewed') return false
  if (kind === 'mvr') {
    return (
      r.requestType === 'mvr_order' ||
      (r.requestType === 'block_request' && r.targetBlockType === 'driver-mvr')
    )
  }
  return (
    r.requestType === 'psp_order' ||
    (r.requestType === 'block_request' && r.targetBlockType === 'driver-psp')
  )
}

/**
 * Fetches the most recent pending screening request of `kind` for this candidate.
 * Returns `null` when none is pending. Refetch by calling `refresh()`.
 *
 * Why hook (not store): MVR + PSP forms are the only consumers, the data is
 * short-lived (cleared the moment the candidate signs disclosure), and keeping
 * it local avoids cross-form cache invalidation bugs.
 */
export function usePendingScreeningRequest(kind: Kind, walletAddress: string | null) {
  const [request, setRequest] = useState<PendingScreeningRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPending = useCallback(async () => {
    if (!walletAddress) {
      setRequest(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/candidate/requests', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!res.ok) {
        setRequest(null)
        return
      }
      const data = await res.json()
      const raw: RawRequest[] = data?.requests ?? []
      const match = raw.find((r) => isPendingForKind(kind, r))
      setRequest(
        match
          ? {
              id: match.id,
              companyName: match.company?.name ?? 'An employer',
              createdAt: match.createdAt,
            }
          : null,
      )
    } catch (err) {
      console.error('[usePendingScreeningRequest] fetch error:', err)
      setRequest(null)
    } finally {
      setIsLoading(false)
    }
  }, [kind, walletAddress])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  return { pendingRequest: request, isLoading, refresh: fetchPending }
}
