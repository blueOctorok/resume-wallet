'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useCallback, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useUIModeStore } from '@/stores/ui-mode-store'
import Button from '@/components/ui/Button'
import BlockPickerModal from './BlockPickerModal'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import BuildBoard from '@/components/hub/BuildBoard'

/** Shown when the user jumped from Apply mode to Construct to edit a block. */
function ReturnToApplyBanner({ isDark }: { isDark: boolean }) {
  const returnToApply = useUIModeStore((s) => s.returnToApply)
  const setReturnToApply = useUIModeStore((s) => s.setReturnToApply)
  const setMode = useUIModeStore((s) => s.setMode)
  if (!returnToApply) return null
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        isDark ? 'border-teal-400/25 bg-teal-500/10' : 'border-teal-200 bg-teal-50/80',
      )}
    >
      <p className={cn('text-sm font-medium', isDark ? 'text-gray-100' : 'text-slate-900')}>
        Done updating? Head back to Apply mode to keep shaping your card for jobs.
      </p>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' variant='primary' size='sm' onClick={() => setMode('simple')}>
          Back to Apply
        </Button>
        <Button type='button' variant='secondary' size='sm' onClick={() => setReturnToApply(false)}>
          Keep building
        </Button>
      </div>
    </div>
  )
}

/**
 * Candidate hub home — career card builder only.
 * Inbox lives under My Hub. AI watches this DQ board — not a Help chat.
 */
export default function CandidateHub() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)

  const lastHubRefreshNonce = useRef<number | null>(null)

  const isLoading = useHubBlocksStore((s) => s.isLoading)
  const fetchError = useHubBlocksStore((s) => s.fetchError)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const openPicker = useHubBlocksStore((s) => s.openPicker)

  const openPickerAfterHub = useUIModeStore((s) => s.openPickerAfterHub)
  const setOpenPickerAfterHub = useUIModeStore((s) => s.setOpenPickerAfterHub)

  useEffect(() => {
    if (sessionUserId) void syncDriverHubFromApi(sessionUserId)
  }, [sessionUserId])

  useEffect(() => {
    if (!openPickerAfterHub) return
    openPicker()
    setOpenPickerAfterHub(false)
  }, [openPickerAfterHub, openPicker, setOpenPickerAfterHub])

  const refreshHub = useCallback(() => {
    if (!sessionUserId) return
    fetchHubData(sessionUserId)
    // Re-sync the driver hub too — the Build board's DQ statuses live there.
    void syncDriverHubFromApi(sessionUserId)
  }, [sessionUserId, fetchHubData])

  useEffect(() => {
    if (lastHubRefreshNonce.current === null) {
      lastHubRefreshNonce.current = hubRefreshNonce
      return
    }
    if (hubRefreshNonce === lastHubRefreshNonce.current) return
    lastHubRefreshNonce.current = hubRefreshNonce
    if (!sessionUserId) return
    refreshHub()
  }, [hubRefreshNonce, sessionUserId, refreshHub])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-slate-600')} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div
        className={cn(
          'mx-auto max-w-md rounded-xl border p-6 text-center',
          isDark ? 'border-gray-700 bg-gray-800/60' : 'border-slate-300 bg-slate-100/95',
        )}
      >
        <AlertCircle className='mx-auto mb-3 h-8 w-8 text-red-500' />
        <p className={cn('mb-1 text-sm font-medium', isDark ? 'text-white' : 'text-slate-800')}>Failed to load your hub</p>
        <p className={cn('mb-4 text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>{fetchError}</p>
        <Button variant='secondary' size='sm' onClick={() => sessionUserId && fetchHubData(sessionUserId)}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <>
      <BlockPickerModal />

      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <ReturnToApplyBanner isDark={isDark} />
        <BuildBoard />
      </div>
    </>
  )
}
