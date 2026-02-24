'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * useVisibilityRefresh - Auto-refresh data when browser tab becomes visible
 * 
 * This hook solves the stale data problem when users:
 * - Switch between browser tabs
 * - Return to the app after being away
 * - Make changes in another tab (like admin panel)
 * 
 * How it works:
 * 1. Listens for the browser's 'visibilitychange' event
 * 2. When tab becomes visible AND enough time has passed, triggers refresh
 * 3. Prevents excessive refreshes with a configurable stale time
 * 
 * @param refreshFn - The function to call when data should be refreshed
 * @param options.staleTime - Minimum ms before data is considered stale (default: 30s)
 * @param options.enabled - Whether the hook is active (default: true)
 * 
 * @example
 * ```tsx
 * const fetchData = useCallback(async () => {
 *   const res = await fetch('/api/data')
 *   setData(await res.json())
 * }, [])
 * 
 * // Refresh when tab becomes visible after 30 seconds
 * const { refresh, lastRefreshedAt, isStale } = useVisibilityRefresh(fetchData)
 * 
 * // Manual refresh button
 * <button onClick={refresh}>Refresh</button>
 * ```
 */
export function useVisibilityRefresh(
  refreshFn: () => void | Promise<void>,
  options: {
    staleTime?: number
    enabled?: boolean
  } = {}
) {
  const { staleTime = 30000, enabled = true } = options
  
  const lastRefreshedAt = useRef<number>(Date.now())
  const isRefreshing = useRef<boolean>(false)

  const isStale = useCallback(() => {
    return Date.now() - lastRefreshedAt.current > staleTime
  }, [staleTime])

  const refresh = useCallback(async () => {
    if (isRefreshing.current) return
    
    isRefreshing.current = true
    try {
      await refreshFn()
      lastRefreshedAt.current = Date.now()
    } finally {
      isRefreshing.current = false
    }
  }, [refreshFn])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStale()) {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, isStale, refresh])

  return {
    refresh,
    lastRefreshedAt: lastRefreshedAt.current,
    isStale: isStale(),
  }
}

/**
 * useRefreshInterval - Periodic refresh for real-time data needs
 * 
 * Use this sparingly - only for data that truly needs real-time updates.
 * For most cases, useVisibilityRefresh is more efficient.
 * 
 * @param refreshFn - The function to call periodically
 * @param interval - How often to refresh in ms (default: 60s)
 * @param enabled - Whether polling is active
 */
export function useRefreshInterval(
  refreshFn: () => void | Promise<void>,
  interval: number = 60000,
  enabled: boolean = true
) {
  const isRefreshing = useRef<boolean>(false)

  useEffect(() => {
    if (!enabled) return

    const tick = async () => {
      if (isRefreshing.current) return
      
      isRefreshing.current = true
      try {
        await refreshFn()
      } finally {
        isRefreshing.current = false
      }
    }

    const id = setInterval(tick, interval)

    return () => clearInterval(id)
  }, [refreshFn, interval, enabled])
}
