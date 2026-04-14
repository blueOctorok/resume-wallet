'use client'

import { useCallback, useMemo, useState } from 'react'
import { Shield, X, Sparkles, ClipboardList, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useUIStore } from '@/stores/ui-store'
import type { PageType } from '@/stores/types'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useInstalledBlocks, useHubBlocksStore } from '@/stores/hub-blocks-store'

const STORAGE_PREFIX = 'stormi_nudge_dismissed:'

interface StormiNudgeBannerProps {
  isDark: boolean
  walletAddress: string
}

type NudgeId = 'verify-resume' | 'cdl-empty' | 'dot-stale' | 'views-grow'

interface Nudge {
  id: NudgeId
  title: string
  body: string
  cta: string
  icon: typeof Shield
  onCta: () => void
}

function isDismissed(wallet: string, id: NudgeId): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + wallet + ':' + id) === '1'
  } catch {
    return false
  }
}

function persistDismiss(wallet: string, id: NudgeId) {
  try {
    localStorage.setItem(STORAGE_PREFIX + wallet + ':' + id, '1')
  } catch {
    /* ignore */
  }
}

export default function StormiNudgeBanner({ isDark, walletAddress }: StormiNudgeBannerProps) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)

  const resumes = useDriverHubStore((s) => s.resumes)
  const dotApplications = useDriverHubStore((s) => s.dotApplications)
  const stats = useDriverHubStore((s) => s.stats)
  const profile = useDriverHubStore((s) => s.profile)
  const installedBlocks = useInstalledBlocks()

  const [bump, setBump] = useState(0)

  const go = useCallback(
    (page: PageType) => {
      setCurrentPage(page)
    },
    [setCurrentPage],
  )

  const visible = useMemo((): Nudge[] => {
    const list: Nudge[] = []
    const hasResumeNotOnChain = resumes.some(
      (r) =>
        String(r.verificationStatus || '').toUpperCase() !== 'VERIFIED' ||
        !(r.blockchainTxHash && String(r.blockchainTxHash).length > 10),
    )
    if (resumes.length > 0 && hasResumeNotOnChain) {
      list.push({
        id: 'verify-resume',
        title: 'Verify your resume on-chain',
        body: 'Verified resumes signal trust to employers reviewing your Career Card.',
        cta: 'Go to resume',
        icon: Shield,
        onCta: () => go('storm-resume'),
      })
    }

    const hasCdlBlock = installedBlocks.some((b) => b.blockType === 'driver-cdl-credentials')
    const pr = profile as { cdl_number?: string | null; cdl_state?: string | null } | null
    const cdlThin = !pr?.cdl_number || !pr?.cdl_state
    if (hasCdlBlock && cdlThin) {
      list.push({
        id: 'cdl-empty',
        title: 'Finish your CDL block',
        body: 'Many trucking employers filter by CDL class and state — yours is still light.',
        cta: 'Open block picker',
        icon: Sparkles,
        // CDL block has no full page route — hub tile is the entry point
        onCta: () => openPicker(),
      })
    }

    const staleDot = dotApplications.find((a) => {
      if (a.isComplete) return false
      const started = new Date(a.createdAt).getTime()
      return Date.now() - started > 5 * 86400000
    })
    if (staleDot) {
      list.push({
        id: 'dot-stale',
        title: 'DOT application waiting',
        body: 'You started your DOT application a few days ago — finishing strengthens your file.',
        cta: 'Continue',
        icon: ClipboardList,
        onCta: () => go('dotapp'),
      })
    }

    const week = stats?.careerCardViewsThisWeek ?? 0
    if (week > 0 && installedBlocks.length < 4) {
      list.push({
        id: 'views-grow',
        title: 'Employers are looking',
        body: `Your card was viewed ${week} time${week === 1 ? '' : 's'} this week — more blocks can increase visibility.`,
        cta: 'Browse blocks',
        icon: LayoutGrid,
        onCta: () => openPicker(),
      })
    }

    return list.filter((n) => !isDismissed(walletAddress, n.id))
  }, [bump, resumes, profile, installedBlocks, dotApplications, stats, walletAddress, go, openPicker])

  const current = visible[0]

  const dismissCurrent = useCallback(() => {
    if (!current) return
    persistDismiss(walletAddress, current.id)
    setBump((b) => b + 1)
  }, [current, walletAddress])

  if (!current) return null

  const Icon = current.icon

  return (
    <Card
      variant='elevated'
      className={cn(
        'relative p-4 sm:p-5 border overflow-hidden',
        isDark ? 'border-violet-500/25 bg-gray-900/50' : 'border-violet-200/80 bg-white',
      )}
    >
      <div className='flex gap-3 pr-10'>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700',
          )}
        >
          <Icon className='h-5 w-5' aria-hidden />
        </div>
        <div className='min-w-0 flex-1'>
          <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{current.title}</p>
          <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>{current.body}</p>
          <div className='mt-3 flex flex-wrap gap-2'>
            <Button type='button' variant='primary' size='sm' onClick={current.onCta}>
              {current.cta}
            </Button>
            <Button type='button' variant='secondary' size='sm' onClick={dismissCurrent}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
      <button
        type='button'
        onClick={dismissCurrent}
        className={cn(
          'absolute top-3 right-3 p-1.5 rounded-lg transition-colors',
          isDark ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
        )}
        aria-label='Dismiss nudge'
      >
        <X className='w-4 h-4' />
      </button>
    </Card>
  )
}
