'use client'

import { useEffect, useRef } from 'react'
import type { PageType } from '@/stores/types'
import { useUIStore } from '@/stores'

const INIT = Symbol('init')

function isPageReload(): boolean {
  if (typeof performance === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}

/**
 * Syncs `history.state` with candidate shell `currentPage` so the browser/OS back gesture
 * returns to the hub (or the prior in-app state) instead of leaving the app in one jump.
 *
 * Browsers do not allow removing the back control; this is the standard SPA mitigation.
 */
export function useCandidateShellHistory(enabled: boolean, currentPage: PageType) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const syncRef = useRef<PageType | typeof INIT>(INIT)

  useEffect(() => {
    if (!enabled) syncRef.current = INIT
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const path = window.location.pathname + window.location.search
    const persistedPage =
      (window.history.state as { sc?: { page: PageType } } | null)?.sc?.page ?? null

    if (syncRef.current === INIT) {
      // Zustand resets on F5 but history.state keeps the last block route — without this,
      // popstate/back or a stale state entry resurrects screening-consent on refresh.
      if (isPageReload() && persistedPage) {
        window.history.replaceState({ sc: { page: null } }, '', path)
        syncRef.current = null
        if (currentPage !== null) setCurrentPage(null)
        return
      }

      window.history.replaceState({ sc: { page: currentPage } }, '', path)
      syncRef.current = currentPage
      return
    }

    const prev = syncRef.current as PageType
    if (prev === currentPage) return

    if (prev === null && currentPage !== null) {
      window.history.pushState({ sc: { page: currentPage } }, '', path)
    } else if (prev !== null && currentPage !== null) {
      window.history.replaceState({ sc: { page: currentPage } }, '', path)
    } else if (prev !== null && currentPage === null) {
      // Returned to hub — clear stale block route from history.state
      window.history.replaceState({ sc: { page: null } }, '', path)
    }

    syncRef.current = currentPage
  }, [enabled, currentPage, setCurrentPage])

  useEffect(() => {
    if (!enabled) return

    const onPop = (e: PopStateEvent) => {
      const st = (e.state as { sc?: { page: PageType } })?.sc
      if (!st || !Object.prototype.hasOwnProperty.call(st, 'page')) return
      syncRef.current = st.page
      setCurrentPage(st.page)
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [enabled, setCurrentPage])
}
