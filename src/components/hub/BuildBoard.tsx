'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowRight, FolderCheck } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useJourneyProgress } from '@/stores/journey-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useTheme } from '@/contexts/ThemeContext'
import type { PageType } from '@/stores/types'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import DqCoachPanel from '@/components/hub/DqCoachPanel'
import DqBriefModal from '@/components/hub/DqBriefModal'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import DisclosurePreferencesModal from '@/components/hub/DisclosurePreferencesModal'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import { downloadDriverResumePacketPdf } from '@/lib/driver-resume-packet-download'
import type { ResumeProjection } from '@/lib/resume-projection'
import { DQ_ITEM_DEFINITIONS } from '@/lib/dq-file-registry'
import { dqItemHasWorkToShow, type DqItemStatus } from '@/lib/dq-file-status'
import { DqStatusBadge } from '@/components/employer/drivers/DriverBlockBadges'
import DocumentsSection from '@/components/career-card/sections/DocumentsSection'
import EmployerAskBanner from '@/components/career-card/EmployerAskBanner'
import CardVisibility from '@/components/hub/CardVisibility'
import ResumePaperCard, { PaperKicker } from '@/components/hub/ResumePaperCard'

/**
 * File board — AI-ordered next steps, then the full DQ packet
 * (including items we have not shipped yet).
 */

const PACKET_PAGE: Partial<Record<string, PageType | 'profile'>> = {
  profile: 'profile',
  mvr: 'mvr',
  psp: 'psp',
  dot_application: 'dotapp',
  cdlis_consent: 'screening-consent',
  employment_verification: 'employment-verification',
  dl_images: 'license',
}

export default function BuildBoard() {
  const dqFile = useDriverHubStore((s) => s.dqFile)
  const journey = useJourneyProgress()
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const { theme } = useTheme()
  const [resumeProjection, setResumeProjection] = useState<ResumeProjection | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [resumeDownloading, setResumeDownloading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)

  const displayName = [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ')

  const openResumePreview = useCallback(async () => {
    setResumeLoading(true)
    setResumeError(null)
    try {
      const res = await fetch('/api/driver/resume-projection')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Failed to load resume')
      }
      const json = (await res.json()) as { projection: ResumeProjection }
      setResumeProjection(json.projection)
    } catch (err) {
      console.error('[FILE] resume projection:', err)
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
      console.error('[FILE] resume PDF:', err)
    } finally {
      setResumeDownloading(false)
    }
  }, [resumeProjection])

  const { completedCount, totalCount, packet } = useMemo(() => {
    const live = DQ_ITEM_DEFINITIONS.filter((d) => d.blocksOverallCompletion)
    const profileDone = journey.steps.some((s) => s.id === 'profile' && s.status === 'complete')
    const dqDone = live.filter(
      (d) => dqFile?.items.find((i) => i.id === d.id)?.status === 'complete',
    ).length

    const profileStatus: DqItemStatus | 'todo' = profileDone
      ? 'complete'
      : journey.steps.some((s) => s.id === 'profile' && s.status === 'in_progress')
        ? 'in_progress'
        : 'todo'

    return {
      completedCount: (profileDone ? 1 : 0) + dqDone,
      totalCount: 1 + live.length,
      packet: [
        {
          id: 'profile',
          label: 'Profile',
          hint: profileDone ? null : 'Name, contact, and location',
          live: true,
          shipped: true,
          status: profileStatus,
        },
        ...DQ_ITEM_DEFINITIONS.map((def) => {
          const resolved = dqFile?.items.find((i) => i.id === def.id)
          return {
            id: def.id,
            label: def.label,
            // Same words as the employer file: a finished report past its
            // window is still complete, and the hint says a fresh pull is due.
            hint: resolved?.refreshDue ? 'refresh due' : (def.cfrNote ?? null),
            live: def.blocksOverallCompletion,
            shipped: def.blocksOverallCompletion || def.id === 'dl_images',
            status: (resolved?.status ?? (def.blocksOverallCompletion ? 'missing' : 'coming_soon')) as DqItemStatus,
          }
        }),
      ],
    }
  }, [dqFile, journey.steps])

  const overallStatus =
    completedCount >= totalCount ? 'complete' : completedCount > 0 ? 'in-progress' : 'empty'

  return (
    <HubSectionPanel isDark={false} accent='teal'>
      <BlockCard
        variant='embed'
        paper
        icon={FolderCheck}
        title='Career Card'
        description='What to do first, then every piece a complete file needs — including ones we have not shipped yet.'
        status={overallStatus}
        headerActions={
          <span className='rounded-full border border-ironside/30 bg-stone-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#173150]'>
            {completedCount}/{totalCount} live
          </span>
        }
      >
        {sessionUserId ? <EmployerAskBanner sessionUserId={sessionUserId} isDark={false} /> : null}
        <CardVisibility onShare={() => setShareOpen(true)} />
        <DqCoachPanel
          onViewResume={() => void openResumePreview()}
          resumeLoading={resumeLoading}
          resumeError={resumeError && !resumeProjection ? resumeError : null}
        />
        <DqBriefModal
          onViewResume={() => void openResumePreview()}
          resumeLoading={resumeLoading}
          resumeError={resumeError && !resumeProjection ? resumeError : null}
        />

        <div className='mt-6'>
          <DocumentsSection data={{ files: [] }} mode='self' isDark={false} paper />
        </div>

        <div className='mt-6'>
          <ResumePaperCard>
            <PaperKicker>Full DQ packet</PaperKicker>
            <ul className='grid grid-cols-1 md:grid-cols-2 md:gap-x-10'>
            {packet.map((row) => {
              const page = PACKET_PAGE[row.id]
              const badgeStatus: DqItemStatus = row.status === 'todo' ? 'missing' : row.status
              // Same gate as the employer file: View once there's something to
              // open. Start is only for work the driver still has to do.
              const canView = row.status !== 'todo' && (dqItemHasWorkToShow(row.status) || row.status === 'processing')
              const canStart = row.status === 'todo' || row.status === 'missing' || row.status === 'failed' || row.status === 'requested'
              const open = () => {
                if (!page) return
                if (page === 'profile') {
                  setShowProfileSetup(true)
                  return
                }
                setCurrentPage(page)
              }
              return (
                <li
                  key={row.id}
                  className='flex items-center justify-between gap-3 border-b border-stone-300/80 py-2.5'
                >
                  <span className='min-w-0'>
                    <span className='block text-sm font-medium text-[#173150]'>{row.label}</span>
                    {row.hint ? (
                      <span className='block text-[10px] leading-tight text-ironside'>{row.hint}</span>
                    ) : null}
                  </span>
                  <span className='flex shrink-0 items-center gap-2'>
                    <DqStatusBadge status={badgeStatus} />
                    {page && row.shipped && (canView || canStart) ? (
                      <button
                        type='button'
                        onClick={open}
                        className='inline-flex items-center gap-0.5 text-xs font-semibold text-[#f15a2b] hover:text-[#173150]'
                      >
                        {canView ? 'View' : 'Start'}
                        <ArrowRight className='h-3.5 w-3.5' aria-hidden />
                      </button>
                    ) : null}
                  </span>
                </li>
              )
            })}
            </ul>
          </ResumePaperCard>
        </div>
      </BlockCard>

      {sessionUserId ? (
        <>
          <CareerCardShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            sessionUserId={sessionUserId}
            displayName={displayName || undefined}
            onManagePrivacy={() => setDisclosureOpen(true)}
          />
          <DisclosurePreferencesModal
            isOpen={disclosureOpen}
            onClose={() => setDisclosureOpen(false)}
            zIndex={1200}
          />
        </>
      ) : null}

      {resumeProjection ? (
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
          subtitle={
            resumeProjection.status === 'ready'
              ? 'Download PDF for applications · Share card to bring people to Provven'
              : resumeProjection.status === 'building'
                ? 'Draft packet — download or share anytime; it fills as you complete DOT'
                : 'Empty packet — start DOT to fill this resume, or share your card as-is'
          }
        />
      ) : null}
    </HubSectionPanel>
  )
}
