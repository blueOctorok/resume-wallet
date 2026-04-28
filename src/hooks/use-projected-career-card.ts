'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'

/**
 * Fetches the same payload as GET /api/career-card (self view).
 * Used by Workspace hub card and can be shared by other surfaces.
 */
export function useProjectedCareerCard(
  walletAddress: string | null,
  options?: { lensId?: string | null; refreshNonce?: number; installedBlockCount?: number }
) {
  const lensId = options?.lensId ?? null
  const refreshNonce = options?.refreshNonce ?? 0
  const installedBlockCount = options?.installedBlockCount ?? 0

  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    setError(null)
    try {
      const qs = lensId ? `?lens=${encodeURIComponent(lensId)}` : ''
      const res = await fetch(`/api/career-card${qs}`, {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!res.ok) throw new Error('Failed to load career card')
      const json = await res.json()
      setCard(json.card ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [walletAddress, lensId])

  useEffect(() => {
    if (!walletAddress) {
      setCard(null)
      setError(null)
      setLoading(false)
      return
    }
    void refresh()
  }, [walletAddress, refresh, refreshNonce, installedBlockCount])

  return { card, loading, error, refresh }
}
