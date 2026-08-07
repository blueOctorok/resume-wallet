'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Share2,
  FileText,
  ArrowRight,
  Blocks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useDotApplicationStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useJourneyProgress } from '@/stores/journey-store'
import { getBlockDefinition } from '@/lib/block-registry'
import { getDriverNextAction } from '@/lib/driver-next-action'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import DisclosurePreferencesModal from '@/components/hub/DisclosurePreferencesModal'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import { downloadDriverResumePacketPdf } from '@/lib/driver-resume-packet-download'
import type { ResumeProjection } from '@/lib/resume-projection'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'
import type { PageType } from '@/stores/types'

interface CareerCardViewProps {
  /** Flip to the Build (DQ board) workspace */
  onBack: () => void
}

/**
 * Driver home — the Career Card showroom.
 * One primary "what's next" CTA (usually Start DOT), section taps deep-link
 * into blocks, and a Build flip so the DQ board is always one click away.
 */
export default function CareerCardView({ onBack }: CareerCardViewProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setShowPrefillUpload = useDotApplicationStore((s) => s.setShowPrefillUpload)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const journey = useJourneyProgress()
  const nextAction = getDriverNextAction(journey)

  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [resumeProjection, setResumeProjection] = useState<ResumeProjection | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [resumeDownloading, setResumeDownloading] = useState(false)

  const fetchCard = useCallback(async (silent = false) => {
    if (!sessionUserId) return
    if (silent) setIsRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/career-card')
      if (!res.ok) throw new Error('Failed to load career card')
      const json = await res.json()
      setData(json.card)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [sessionUserId])

  useEffect(() => {
    fetchCard()
  }, [fetchCard])

  useEffect(() => {
    const handleFocus = () => fetchCard(true)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchCard])

  const goToBlock = useCallback(
    (blockType: string) => {
      const route = getBlockDefinition(blockType)?.pageRoute
      if (route) setCurrentPage(route as PageType)
    },
    [setCurrentPage],
  )

  const runNextAction = useCallback(() => {
    if (!nextAction) return
    if (nextAction.id === 'profile' || nextAction.page === null) {
      setShowProfileSetup(true)
      return
    }
    if (nextAction.page === 'dotapp' && nextAction.isFreshStart) {
      setShowPrefillUpload(true)
    }
    setCurrentPage(nextAction.page)
  }, [nextAction, setShowProfileSetup, setShowPrefillUpload, setCurrentPage])

  const openResumePreview = useCallback(async () => {
    setResumeLoading(true)
    setResumeError(null)
    try {
      const res = await fetch('/api/driver/resume-projection')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Failed to load resume projection')
      }
      const json = (await res.json()) as { projection: ResumeProjection }
      setResumeProjection(json.projection)
    } catch (err) {
      console.error('[CareerCardView] resume projection:', err)
      setResumeError(err instanceof Error ? err.message : 'Failed to load resume')
    } finally {
      setResumeLoading(false)
    }
  }, [])

  const downloadResumePdf = useCallback(async () => {
    if (!resumeProjection?.packet) return
    setResumeDownloading(true)
    try {
      await downloadDriverResumePacketPdf(resumeProjection.packet, resumeProjection.title)
    } catch (err) {
      console.error('[CareerCardView] resume PDF:', err)
    } finally {
      setResumeDownloading(false)
    }
  }, [resumeProjection])

  const continueDotFromResume = useCallback(() => {
    setResumeProjection(null)
    if (!resumeProjection?.hasDotApp) setShowPrefillUpload(true)
    setCurrentPage('dotapp')
  }, [resumeProjection, setShowPrefillUpload, setCurrentPage])

  if (loading) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div className='flex items-center justify-center py-20'>
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-gray-500')} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div
          className={cn(
            'rounded-xl border p-6 text-center',
            isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200',
          )}
        >
          <AlertCircle className='w-8 h-8 text-red-500 mx-auto mb-3' />
          <p className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
            Failed to load your career card
          </p>
          <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>{error}</p>
          <Button variant='secondary' size='sm' onClick={() => fetchCard()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='flex items-center justify-between gap-3 mb-4'>
        <Button type='button' variant='secondary' size='sm' onClick={onBack} title='Open your DQ file board'>
          <Blocks className='w-3.5 h-3.5' />
          Build
        </Button>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => fetchCard(true)}
            disabled={isRefreshing}
            title='Refresh career card'
            className={cn(
              'p-1.5 rounded-lg transition-all',
              isRefreshing ? 'opacity-50 cursor-not-allowed' : '',
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>
          <Button
            variant='secondary'
            size='sm'
            isLoading={resumeLoading}
            onClick={() => void openResumePreview()}
            title='Preview & download your live resume packet'
          >
            <FileText className='w-3.5 h-3.5' />
            Resume
          </Button>
          <Button variant='primary' size='sm' onClick={() => setShareOpen(true)}>
            <Share2 className='w-3.5 h-3.5' />
            Share
          </Button>
        </div>
      </div>

      {/* Primary next step — one button, biggest click target */}
      {nextAction ? (
        <button
          type='button'
          onClick={runNextAction}
          className={cn(
            'mb-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
            isDark
              ? 'border-teal-400/30 bg-teal-500/15 hover:bg-teal-500/25'
              : 'border-teal-200 bg-teal-50 hover:bg-teal-100/80',
          )}
        >
          <span className='min-w-0'>
            <span
              className={cn(
                'block text-[11px] font-semibold uppercase tracking-wide',
                isDark ? 'text-teal-300/80' : 'text-teal-700/80',
              )}
            >
              Up next
            </span>
            <span
              className={cn(
                'block truncate text-sm font-semibold',
                isDark ? 'text-teal-100' : 'text-teal-900',
              )}
            >
              {nextAction.label}
            </span>
          </span>
          <ArrowRight className={cn('h-4 w-4 shrink-0', isDark ? 'text-teal-200' : 'text-teal-700')} />
        </button>
      ) : (
        <div
          className={cn(
            'mb-4 rounded-xl border px-4 py-3',
            isDark
              ? 'border-emerald-400/20 bg-emerald-500/10'
              : 'border-emerald-200 bg-emerald-50/80',
          )}
        >
          <p className={cn('text-sm font-semibold', isDark ? 'text-emerald-200' : 'text-emerald-900')}>
            Your card is looking solid.
          </p>
          <p className={cn('mt-0.5 text-xs', isDark ? 'text-emerald-300/70' : 'text-emerald-800/80')}>
            Share it, or open Build to review your full DQ file.
          </p>
        </div>
      )}

      {resumeError && !resumeProjection && (
        <p
          className={cn('mb-4 flex items-center gap-1.5 text-xs', isDark ? 'text-red-300' : 'text-red-700')}
          role='alert'
        >
          <AlertCircle className='h-3.5 w-3.5 shrink-0' aria-hidden />
          {resumeError}
        </p>
      )}

      {/* Section taps deep-link into the matching block (DOT empty state → Start application) */}
      <ProjectedCareerCard
        data={data}
        mode='self'
        sessionUserId={sessionUserId ?? undefined}
        onNavigateToBlock={goToBlock}
        onAvatarUploadSuccess={(url) => {
          updateAvatarUrl(url)
          void fetchCard(true)
        }}
        onEditProfile={() => setShowProfileSetup(true)}
      />

      {/* Footer flip — same destination as the header Build button + nav toggle */}
      <div className='mt-6 flex justify-center'>
        <Button type='button' variant='secondary' size='sm' onClick={onBack}>
          <Blocks className='w-3.5 h-3.5' />
          Open Build — full DQ file
        </Button>
      </div>

      {sessionUserId && (
        <>
          <CareerCardShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            sessionUserId={sessionUserId}
            displayName={data.name?.trim() || undefined}
            onShareUpdated={() => void fetchCard(true)}
            onManagePrivacy={() => setDisclosureOpen(true)}
          />
          <DisclosurePreferencesModal
            isOpen={disclosureOpen}
            onClose={() => setDisclosureOpen(false)}
            zIndex={1200}
          />
        </>
      )}

      {resumeProjection && (
        <ResumePreviewModal
          title={resumeProjection.title}
          structuredData={resumeProjection.structuredData}
          packet={resumeProjection.packet}
          onClose={() => {
            setResumeProjection(null)
            setResumeError(null)
          }}
          onDownload={() => void downloadResumePdf()}
          isDownloading={resumeDownloading}
          theme={theme}
          onShare={() => setShareOpen(true)}
          onEdit={continueDotFromResume}
          editLabel={resumeProjection.hasDotApp ? 'Continue DOT' : 'Start DOT'}
          subtitle={
            resumeProjection.status === 'ready'
              ? 'Download PDF for applications · Share card to bring people to Provven'
              : resumeProjection.status === 'building'
                ? 'Draft packet — download or share anytime; it fills as you complete DOT'
                : 'Empty packet — start DOT to fill this resume, or share your card as-is'
          }
        />
      )}
    </div>
  )
}
