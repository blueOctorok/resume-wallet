'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Pending employer screening request for the current candidate.
 * MVR and PSP hooks share the same matcher — employer asks now normalize to
 * `driver-screening-consent` on the server.
 */
export interface PendingScreeningRequest {
  id: string
  companyName: string
  createdAt: string
  requestType: string
  targetBlockType: string | null
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

function isPendingEmployerScreeningRow(r: RawRequest): boolean {
  if (r.status !== 'pending' && r.status !== 'viewed') return false
  if (r.requestType === 'mvr_order' || r.requestType === 'psp_order') return true
  if (r.requestType !== 'block_request') return false
  const t = r.targetBlockType
  return t === 'driver-screening-consent' || t === 'driver-mvr' || t === 'driver-psp'
}

function isPendingForKind(_kind: Kind, r: RawRequest): boolean {
  return isPendingEmployerScreeningRow(r)
}

/**
 * Fetches the most recent pending screening request for this candidate.
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
              requestType: match.requestType,
              targetBlockType: match.targetBlockType,
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
