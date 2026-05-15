'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScreeningRow, ScreeningsByUserId } from '@/components/employer/outreach/types'

interface ScreeningsResponse {
  success: boolean
  mvr: ScreeningRow[]
  psp: ScreeningRow[]
  consentBundles?: Array<{
    id: string
    driverUserId: string
    candidateName: string | null
    avatarUrl: string | null
    status: string
    completedAt: string | null
    createdAt: string
    cdlisSignedAt: string | null
    cdlisSignedName: string | null
    bg: { signedName: string | null; signedAt: string } | null
    psp: { signedName: string | null; signedAt: string; formVersion: string | null } | null
  }>
}

export type ConsentBundleSummary = NonNullable<ScreeningsResponse['consentBundles']>[number]

interface UseEmployerScreeningsResult {
  rows: ScreeningRow[]
  byUserId: ScreeningsByUserId
  /** All consent bundles for this company, newest first */
  consentBundles: ConsentBundleSummary[]
  /** Latest consent bundle per candidate user id (for outreach card pills) */
  consentBundleByUserId: Map<string, ConsentBundleSummary>
  loading: boolean
  refreshing: boolean
  error: string | null
  /** Re-fetch — pass `silent` for background refresh that doesn't tear down the UI. */
  refresh: (silent?: boolean) => Promise<void>
}

/**
 * One-fetch source of truth for company-purchased screenings (MVR + PSP).
 *
 * Both the Active outreach tab (per-candidate file pills on each card) and the
 * Files vault tab read from this hook so the data is loaded once and shared.
 * The `byUserId` map keys on `driver_user_id`, which is the same id exposed
 * on `Invite.usedByUserId` — that's how cards link to their files.
 */
export function useEmployerScreenings(
  walletAddress: string | null | undefined,
): UseEmployerScreeningsResult {
  const [rows, setRows] = useState<ScreeningRow[]>([])
  const [consentBundles, setConsentBundles] = useState<NonNullable<ScreeningsResponse['consentBundles']>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (silent = false) => {
      if (!walletAddress) return
      try {
        if (silent) setRefreshing(true)
        else setLoading(true)
        setError(null)

        const res = await fetch('/api/employer/screenings', {
          headers: { 'x-wallet-address': walletAddress },
        })
        const data = (await res.json()) as ScreeningsResponse | { error: string }
        if (!res.ok || !('success' in data)) {
          throw new Error('error' in data ? data.error : 'Failed to load screenings')
        }
        const merged = [...data.mvr, ...data.psp].sort(
          (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
        )
        setRows(merged)
        setConsentBundles(data.consentBundles ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load screenings')
        setRows([])
        setConsentBundles([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [walletAddress],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Bucket by candidate user id so cards can read O(1) by `invite.usedByUserId`.
  // We Map<string, ScreeningRow[]>; rows without a `candidateUserId` are ignored
  // (those are screenings whose candidate has somehow been detached — they still
  // appear in the flat `rows` for the vault tab, just not as inline file pills).
  const byUserId = useMemo<ScreeningsByUserId>(() => {
    const m: ScreeningsByUserId = new Map()
    for (const row of rows) {
      if (!row.candidateUserId) continue
      const existing = m.get(row.candidateUserId)
      if (existing) existing.push(row)
      else m.set(row.candidateUserId, [row])
    }
    return m
  }, [rows])

  const consentBundleByUserId = useMemo(() => {
    const m = new Map<string, ConsentBundleSummary>()
    for (const b of consentBundles) {
      if (!b.driverUserId) continue
      if (!m.has(b.driverUserId)) m.set(b.driverUserId, b)
    }
    return m
  }, [consentBundles])

  return { rows, byUserId, consentBundles, consentBundleByUserId, loading, refreshing, error, refresh }
}
