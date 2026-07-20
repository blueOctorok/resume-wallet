'use client'

import { useState, useEffect } from 'react'

/**
 * Client mirror of the server duplicate guard: is a new MVR/PSP order allowed
 * for the signed-in driver, or is a report already on file / in flight?
 * Backed by GET /api/candidate/screening-lock. Fails open (locked: false) on
 * fetch errors — the server guard still rejects, this hook only shapes UI.
 */
export interface ScreeningOrderLock {
  locked: boolean
  status?: string
  orderedAt?: string
  expiresAt?: string | null
}

const UNLOCKED: ScreeningOrderLock = { locked: false }

export function useScreeningOrderLock(kind: 'mvr' | 'psp', sessionUserId: string | null) {
  const [lock, setLock] = useState<ScreeningOrderLock>(UNLOCKED)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!sessionUserId) {
      setLock(UNLOCKED)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    void fetch('/api/candidate/screening-lock')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setLock((data?.[kind] as ScreeningOrderLock | undefined) ?? UNLOCKED)
      })
      .catch(() => {
        if (!cancelled) setLock(UNLOCKED)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, sessionUserId])

  return { lock, isLoading }
}
