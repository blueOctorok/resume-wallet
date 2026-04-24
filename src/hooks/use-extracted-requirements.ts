/**
 * Fetches LLM-extracted structured requirements for an external (Adzuna) job.
 * Idempotent: the API caches results so repeat calls for the same job are free.
 * Returns null while loading or for StormChain jobs (which use role_requirements).
 */

import { useEffect, useRef, useState } from 'react'
import type { ExternalRequirement } from '@/lib/job-fit'
import type { SelectedJobSnapshot } from '@/stores/simple-mode-store'

export function useExtractedRequirements(
  snap: SelectedJobSnapshot | null,
  walletAddress: string | null,
): ExternalRequirement[] | null {
  const [reqs, setReqs] = useState<ExternalRequirement[] | null>(null)
  // Track which job id we last fetched for to avoid stale state
  const lastFetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!snap || snap.isStormChain || !walletAddress) {
      setReqs(null)
      lastFetchedRef.current = null
      return
    }

    if (lastFetchedRef.current === snap.id) return
    lastFetchedRef.current = snap.id
    setReqs(null)

    let cancelled = false

    fetch('/api/ai/extract-job-requirements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress,
      },
      body: JSON.stringify({
        jobId: snap.id,
        source: 'adzuna',
        title: snap.title,
        description: snap.description ?? '',
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.requirements) return
        setReqs(data.requirements as ExternalRequirement[])
      })
      .catch(() => {
        // Heuristic fallback already covers this case
      })

    return () => {
      cancelled = true
    }
  }, [snap, walletAddress])

  return reqs
}
