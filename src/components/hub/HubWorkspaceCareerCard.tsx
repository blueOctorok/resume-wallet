'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useCallback, useMemo, useState } from 'react'
import { Loader2, AlertCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useDotApplicationStore, useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import { getBlockDefinition } from '@/lib/block-registry'
import type { PageType } from '@/stores/types'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import DisclosurePreferencesModal from '@/components/hub/DisclosurePreferencesModal'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import { useProjectedCareerCard } from '@/hooks/use-projected-career-card'
import { useHubDocuments } from '@/hooks/use-hub-documents'
import { downloadDriverResumePacketPdf } from '@/lib/driver-resume-packet-download'
import type { ResumeProjection } from '@/lib/resume-projection'
import type { DotAppData, ProjectedCareerCard as CardData, ResumeData } from '@/types/career-card'
import type { HubDocument } from '@/lib/hub-document-types'

const RESUME_BLOCK_TYPES = new Set([
  'storm-resume',
  'driver-resume',
  'developer-resume',
  'general-resume',
])

type ResumeChromeStatus = 'not_started' | 'building' | 'ready'

function pickResumeDoc(documents: HubDocument[]): HubDocument | null {
  return (
    documents.find(
      (d) =>
        d.type === 'resume' &&
        d.id !== 'resume-hub-placeholder' &&
        d.status !== 'empty',
    ) ?? null
  )
}

function deriveResumeChromeStatus(
  card: CardData,
  resumeDoc: HubDocument | null,
): ResumeChromeStatus {
  if (resumeDoc) return 'ready'
  const resumeSection = card.sections.find((s) => RESUME_BLOCK_TYPES.has(s.blockType))
  if (resumeSection) {
    const d = resumeSection.data as ResumeData
    if (d.id && d.id !== '__storm_resume_placeholder__') return 'ready'
  }
  const dot = card.sections.find((s) => s.blockType === 'driver-dot-application')
  const dotData = dot?.data as DotAppData | undefined
  if (dotData && dotData.id && dotData.status !== 'empty') return 'building'
  return 'not_started'
}

export interface HubWorkspaceCareerCardProps {
  /** Bumps when hub data is refreshed so the card refetches from `/api/career-card`. */
  refreshNonce: number
}

/**
 * Full-size interactive career card for Construct (hub) — the hub "cake".
 * No outer panel wrapper — ProjectedCareerCard's VaultShell IS the container.
 * Header chrome: Resume chip only. Share card (link) lives in resume preview;
 * Privacy sits inside Share; profile edit is on the card name.
 */
export default function HubWorkspaceCareerCard({ refreshNonce }: HubWorkspaceCareerCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setShowPrefillUpload = useDotApplicationStore((s) => s.setShowPrefillUpload)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const addBlock = useHubBlocksStore((s) => s.addBlock)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const installedBlocks = useInstalledBlocks()
  const [shareOpen, setShareOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [resumeProjection, setResumeProjection] = useState<ResumeProjection | null>(null)
  const [resumeProjectionLoading, setResumeProjectionLoading] = useState(false)
  const [resumeProjectionError, setResumeProjectionError] = useState<string | null>(null)
  const [resumePdfDownloading, setResumePdfDownloading] = useState(false)

  const hubDocs = useHubDocuments(refreshNonce)

  const { card, loading, error, refresh } = useProjectedCareerCard(sessionUserId, {
    refreshNonce,
    installedBlockCount: installedBlocks?.length ?? 0,
  })

  const resumeDoc = useMemo(() => pickResumeDoc(hubDocs.documents), [hubDocs.documents])
  const resumeChrome = useMemo((): ResumeChromeStatus => {
    // Prefer live projection status once fetched (keeps chip in sync with modal)
    if (resumeProjection) return resumeProjection.status
    return card ? deriveResumeChromeStatus(card, resumeDoc) : 'not_started'
  }, [card, resumeDoc, resumeProjection])

  const handleNavigateToBlock = useCallback(
    (blockType: string) => {
      const route = getBlockDefinition(blockType)?.pageRoute
      if (route) setCurrentPage(route as PageType)
    },
    [setCurrentPage],
  )

  const openLiveResumeProjection = useCallback(async () => {
    setResumeProjectionLoading(true)
    setResumeProjectionError(null)
    try {
      const res = await fetch('/api/driver/resume-projection')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Failed to load resume projection')
      }
      const json = (await res.json()) as { projection: ResumeProjection }
      setResumeProjection(json.projection)
    } catch (err) {
      console.error('[HubWorkspaceCareerCard] resume projection:', err)
      setResumeProjectionError(err instanceof Error ? err.message : 'Failed to load resume')
    } finally {
      setResumeProjectionLoading(false)
    }
  }, [])

  const handleResumeChromeClick = useCallback(() => {
    void openLiveResumeProjection()
  }, [openLiveResumeProjection])

  const handleResumePdfDownload = useCallback(async () => {
    if (!resumeProjection?.packet) return
    setResumePdfDownloading(true)
    try {
      await downloadDriverResumePacketPdf(
        resumeProjection.packet,
        resumeProjection.title,
      )
    } catch (err) {
      console.error('[HubWorkspaceCareerCard] resume PDF:', err)
    } finally {
      setResumePdfDownloading(false)
    }
  }, [resumeProjection])

  const handleContinueDotFromResume = useCallback(() => {
    setResumeProjection(null)
    if (!resumeProjection?.hasDotApp) {
      setShowPrefillUpload(true)
    }
    setCurrentPage('dotapp')
  }, [resumeProjection, setShowPrefillUpload, setCurrentPage])

  const handleAddFeature = useCallback(
    async (blockType: string) => {
      if (!sessionUserId) return
      await addBlock(blockType, sessionUserId)
      const route = getBlockDefinition(blockType)?.pageRoute
      if (route) setCurrentPage(route as PageType)
      void refresh()
    },
    [sessionUserId, addBlock, setCurrentPage, refresh],
  )

  if (!sessionUserId) {
    return null
  }

  if (loading && !card) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className={cn('h-8 w-8 animate-spin', isDark ? 'text-gray-400' : 'text-slate-500')} />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div
        className={cn(
          'rounded-xl border p-6 text-center',
          isDark ? 'border-gray-700 bg-gray-800/60' : 'border-slate-200 bg-white dark:bg-gray-900',
        )}
      >
        <AlertCircle className='mx-auto mb-3 h-8 w-8 text-red-500' />
        <p className={cn('mb-1 text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
          Couldn&apos;t load your career card
        </p>
        <p className={cn('mb-4 text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>{error}</p>
        <Button variant='secondary' size='sm' onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className='min-w-0'>
      <ProjectedCareerCard
        data={card}
        mode='construct'
        hubDocuments={hubDocs}
        sessionUserId={sessionUserId}
        onNavigateToBlock={handleNavigateToBlock}
        onAddBlock={openPicker}
        onAddFeature={handleAddFeature}
        onCardMutation={() => void refresh()}
        onAvatarUploadSuccess={(url) => {
          updateAvatarUrl(url)
          void refresh()
        }}
        onEditProfile={() => setShowProfileSetup(true)}
        selfHeaderActions={
          <button
            type='button'
            onClick={handleResumeChromeClick}
            disabled={resumeProjectionLoading}
            title='Preview & share your live resume packet'
            aria-label={
              resumeChrome === 'ready'
                ? 'Resume ready — preview and share'
                : resumeChrome === 'building'
                  ? 'Resume building — preview live draft'
                  : 'Resume not started — preview live draft'
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
              resumeChrome === 'ready' &&
                (isDark
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'),
              resumeChrome === 'building' &&
                (isDark
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                  : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'),
              resumeChrome === 'not_started' &&
                (isDark
                  ? 'border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'),
            )}
          >
            {resumeProjectionLoading ? (
              <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin' aria-hidden />
            ) : (
              <FileText className='h-3.5 w-3.5 shrink-0' aria-hidden />
            )}
            <span className='hidden sm:inline'>Resume</span>
            <span
              className={cn(
                'rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide',
                resumeChrome === 'ready' &&
                  (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100/80'),
                resumeChrome === 'building' &&
                  (isDark ? 'bg-amber-500/20' : 'bg-amber-100/80'),
                resumeChrome === 'not_started' &&
                  (isDark ? 'bg-gray-700/80' : 'bg-slate-100'),
              )}
            >
              {resumeChrome === 'ready'
                ? 'Ready'
                : resumeChrome === 'building'
                  ? 'Building'
                  : 'None'}
            </span>
          </button>
        }
      />
      {hubDocs.renderModals()}
      <CareerCardShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        sessionUserId={sessionUserId}
        displayName={card.name?.trim() || undefined}
        onShareUpdated={() => void refresh()}
        onManagePrivacy={() => setDisclosureOpen(true)}
      />
      <DisclosurePreferencesModal
        isOpen={disclosureOpen}
        onClose={() => setDisclosureOpen(false)}
        zIndex={1200}
      />
      {resumeProjection && (
        <ResumePreviewModal
          title={resumeProjection.title}
          structuredData={resumeProjection.structuredData}
          packet={resumeProjection.packet}
          onClose={() => {
            setResumeProjection(null)
            setResumeProjectionError(null)
          }}
          onDownload={() => void handleResumePdfDownload()}
          isDownloading={resumePdfDownloading}
          theme={theme}
          onShare={() => setShareOpen(true)}
          onEdit={handleContinueDotFromResume}
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
      {resumeProjectionError && !resumeProjection && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            isDark ? 'text-red-300' : 'text-red-700',
          )}
          role='alert'
        >
          <AlertCircle className='h-3.5 w-3.5 shrink-0' aria-hidden />
          {resumeProjectionError}
        </p>
      )}
    </div>
  )
}
