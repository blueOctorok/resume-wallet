'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSimpleModeStore, type JobSource } from '@/stores/simple-mode-store'

/**
 * Keep `?selected=<id>&source=<stormchain|adzuna|saved>` and the selection
 * store in sync. URL wins on first paint (so shared links + browser back do
 * the right thing); after that the store is authoritative and writes back to
 * the URL using `router.replace` (shallow, no scroll).
 */
export function useSelectedJobSync() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedJobId = useSimpleModeStore((s) => s.selectedJobId)
  const selectedJobSource = useSimpleModeStore((s) => s.selectedJobSource)

  const hydratedRef = useRef(false)

  // First paint — hydrate store from URL if it arrived with a selection
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    const urlId = searchParams.get('selected')
    const urlSource = searchParams.get('source') as JobSource | null
    if (urlId && urlSource && !useSimpleModeStore.getState().selectedJobId) {
      // We don't have the snapshot yet — the rail will set a full snapshot once
      // the matching job loads. For now stash id + source so components can
      // show a loading placeholder keyed to this id.
      useSimpleModeStore.setState({
        selectedJobId: urlId,
        selectedJobSource: urlSource,
      })
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

    const currentId = current.get('selected') ?? ''
    const currentSource = current.get('source') ?? ''
    if (currentId === nextId && currentSource === nextSource) return

    if (nextId) {
      current.set('selected', nextId)
      current.set('source', nextSource)
    } else {
      current.delete('selected')
      current.delete('source')
    }

    const qs = current.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [selectedJobId, selectedJobSource, pathname, router, searchParams])
}
