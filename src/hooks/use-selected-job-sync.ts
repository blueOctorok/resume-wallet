'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSimpleModeStore, type JobSource } from '@/stores/simple-mode-store'

/**
 * Keep `?selected=<id>&source=<stormchain|adzuna|saved>&lens=<id>` and the
 * selection store in sync. URL wins on first paint (so shared links + browser
 * back do the right thing); after that the store is authoritative and writes
 * back to the URL using `router.replace` (shallow, no scroll).
 *
 * `?lens=` only appears when the user has explicitly overridden auto-pick
 * (Stormi's silent switches stay out of the URL so they don't feel sticky
 * across reloads).
 */
export function useSelectedJobSync() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedJobId = useSimpleModeStore((s) => s.selectedJobId)
  const selectedJobSource = useSimpleModeStore((s) => s.selectedJobSource)
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const overrideAutoPick = useSimpleModeStore((s) => s.overrideAutoPick)

  const hydratedRef = useRef(false)

  // First paint — hydrate store from URL if it arrived with a selection
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    const urlId = searchParams.get('selected')
    const urlSource = searchParams.get('source') as JobSource | null
    const urlLens = searchParams.get('lens')
    if (urlId && urlSource && !useSimpleModeStore.getState().selectedJobId) {
      // We don't have the snapshot yet — the rail will set a full snapshot once
      // the matching job loads. For now stash id + source so components can
      // show a loading placeholder keyed to this id.
      useSimpleModeStore.setState({
        selectedJobId: urlId,
        selectedJobSource: urlSource,
      })
    }
    // If the URL has ?lens= and the user hasn't picked one in the store yet,
    // treat it as an explicit override — Stormi should respect their choice.
    if (urlLens && !useSimpleModeStore.getState().activeLensId) {
      useSimpleModeStore.getState().setActiveLens(urlLens)
    }
    // We only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Store → URL (shallow, no scroll)
  useEffect(() => {
    if (!hydratedRef.current) return
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    const nextId = selectedJobId ?? ''
    const nextSource = selectedJobSource ?? ''
    // Only mirror the lens when it was a user override; silent auto-picks
    // stay ephemeral. This also keeps shared URLs lean.
    const nextLens = overrideAutoPick && activeLensId ? activeLensId : ''

    const currentId = current.get('selected') ?? ''
    const currentSource = current.get('source') ?? ''
    const currentLens = current.get('lens') ?? ''
    if (currentId === nextId && currentSource === nextSource && currentLens === nextLens) return

    if (nextId) {
      current.set('selected', nextId)
      current.set('source', nextSource)
    } else {
      current.delete('selected')
      current.delete('source')
    }
    if (nextLens) {
      current.set('lens', nextLens)
    } else {
      current.delete('lens')
    }

    const qs = current.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [selectedJobId, selectedJobSource, activeLensId, overrideAutoPick, pathname, router, searchParams])
}
