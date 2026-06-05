'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import Image from 'next/image'
import { useEffect, useCallback, useState, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useStormiAutoWelcomeCandidateDone,
} from '@/stores/hub-blocks-store'
import { useUIModeStore } from '@/stores/ui-mode-store'
import { getBlockDefinition, isCoreBlock } from '@/lib/block-registry'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockPickerModal from './BlockPickerModal'
import StormiContextModal from './StormiContextModal'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useHubContext } from '@/lib/ava-chat'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import StormiNudgeBanner from '@/components/stormi/StormiNudgeBanner'
import HubWorkspaceCareerCard from '@/components/hub/HubWorkspaceCareerCard'
import HubInboxSection from '@/components/hub/HubInboxSection'
import HubAccountSection from '@/components/hub/HubAccountSection'

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

// ── CandidateHub ─────────────────────────────────────────────────────────────

export default function CandidateHub() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)

  const [refreshKey, setRefreshKey] = useState(0)
  const lastHubRefreshNonce = useRef<number | null>(null)

  const isLoading = useHubBlocksStore((s) => s.isLoading)
  const fetchError = useHubBlocksStore((s) => s.fetchError)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const setStormiAutoWelcomeCandidateDone = useHubBlocksStore((s) => s.setStormiAutoWelcomeCandidateDone)
  const openPicker = useHubBlocksStore((s) => s.openPicker)

  const openPickerAfterHub = useUIModeStore((s) => s.openPickerAfterHub)
  const setOpenPickerAfterHub = useUIModeStore((s) => s.setOpenPickerAfterHub)

  const installedBlocks = useInstalledBlocks()
  const hubContext = useHubContext()
  const stormiAutoWelcomeCandidateDone = useStormiAutoWelcomeCandidateDone()
  const isStormiContextModalOpen = useHubBlocksStore((s) => s.isStormiContextModalOpen)

  const candidateEmptyHub = installedBlocks.every((b) => isCoreBlock(b.blockType))

  // Primary fetchHubData call lives in CandidateShell (serves both modes).
  // syncDriverHubFromApi is already called inside fetchHubData, but we keep
  // this for in-Construct refreshes (e.g. after block edits).
  useEffect(() => {
    if (sessionUserId) void syncDriverHubFromApi(sessionUserId)
  }, [sessionUserId])

  /** One-shot from Apply mode: open the block picker once Construct is visible. */
  useEffect(() => {
    if (!openPickerAfterHub) return
    openPicker()
    setOpenPickerAfterHub(false)
  }, [openPickerAfterHub, openPicker, setOpenPickerAfterHub])

  const refreshHub = useCallback(() => {
    if (sessionUserId) fetchHubData(sessionUserId)
    setRefreshKey((k) => k + 1)
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
      {isStormiContextModalOpen && <StormiContextModal />}

      <div className='w-full'>
        <div className='flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-x-8'>
          <div className='min-w-0 space-y-6 lg:col-start-1 lg:row-start-1'>
            {sessionUserId ? (
              <StormiNudgeBanner isDark={isDark} sessionUserId={sessionUserId} />
            ) : null}

            <ReturnToApplyBanner isDark={isDark} />

            <HubWorkspaceCareerCard refreshNonce={refreshKey} />

            <HubInboxSection
              sessionUserId={sessionUserId}
              onNavigateToResume={(targetBlockType) => {
                const route = targetBlockType ? getBlockDefinition(targetBlockType)?.pageRoute : null
                if (route) setCurrentPage(route as PageType)
                else setCurrentPage('storm-resume')
              }}
              onNavigateToDotApp={() => setCurrentPage('dotapp')}
            />

            {sessionUserId ? <HubAccountSection /> : null}
          </div>

          <aside className='min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start'>
            <div id='stormi-hub-panel' className='scroll-mt-24'>
              <HubSectionPanel isDark={isDark} accent='violet'>
                <BlockCard
                  variant='embed'
                  headerIconSlot={
                    <Image
                      src='/ava-robot.png'
                      alt=''
                      width={36}
                      height={36}
                      className={cn('object-contain', !isDark && 'invert')}
                    />
                  }
                  title='Ask Stormi'
                  description='Ranked jobs, interview practice, and talking points from your Career Card — you choose every apply.'
                >
                  <StormiChatPanel
                    mode='candidate'
                    sessionUserId={sessionUserId}
                    hubContext={hubContext}
                    candidateEmptyHub={candidateEmptyHub}
                    stormiAutoWelcomeCandidateDone={stormiAutoWelcomeCandidateDone}
                    onStormiAutoWelcomeSynced={() => {
                      setStormiAutoWelcomeCandidateDone(true)
                      if (sessionUserId) void fetchHubData(sessionUserId)
                    }}
                    hubEmbedSurface
                  />
                </BlockCard>
              </HubSectionPanel>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
