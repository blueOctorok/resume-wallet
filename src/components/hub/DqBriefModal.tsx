'use client'

import { useEffect } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useAuthStore, useUIStore } from '@/stores'
import { useDqCoachStore } from '@/stores/dq-coach-store'
import { useDriverOrientationStore } from '@/stores/driver-orientation-store'
import { useUIModeStore } from '@/stores/ui-mode-store'
import { PaperRule, paperPrimaryButtonClass, paperSecondaryButtonClass } from '@/components/hub/ResumePaperCard'
import type { DqBriefActionId, DqCoachBrief } from '@/lib/dq-coach-brief'
import type { PageType } from '@/stores/types'

/** Buttons that open a page. "jobs" switches to Apply and "resume" opens the preview instead. */
const ACTION_PAGE: Partial<Record<DqBriefActionId, PageType>> = {
  'scan-license': 'license',
  'confirm-license': 'license',
  'start-dot': 'dotapp',
  'finish-dot': 'dotapp',
}

/**
 * The message itself: the guide for this driver's stage and its buttons.
 * The popup shows it on arrival. After the driver closes the popup, the
 * Career path card shows this same message.
 */

export function DqBriefMessage({
  brief,
  showTitle = true,
  onViewResume,
  resumeLoading = false,
  resumeError = null,
  onActed,
}: {
  brief: DqCoachBrief
  /** The popup already has the title in its header. */
  showTitle?: boolean
  onViewResume: () => void
  resumeLoading?: boolean
  resumeError?: string | null
  /** The popup uses this to close itself before a button navigates. */
  onActed?: () => void
}) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setMode = useUIModeStore((s) => s.setMode)

  const run = (id: DqBriefActionId) => {
    onActed?.()
    const page = ACTION_PAGE[id]
    if (page) setCurrentPage(page)
    else if (id === 'jobs') setMode('simple')
    else onViewResume()
  }

  return (
    <div className="space-y-4">
      {showTitle ? (
        <h3 className="text-center text-xl font-bold tracking-tight text-[#173150]">{brief.title}</h3>
      ) : null}
      {brief.sections.map((section) => {
        // Numbered when the order is the point: the steps a new driver follows.
        const List = section.ordered ? 'ol' : 'ul'
        return (
          <section key={section.heading}>
            <h4 className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              {section.heading}
            </h4>
            <PaperRule />
            <List
              className={cn(
                'mt-1.5 space-y-1 pl-5 text-sm leading-snug text-[#173150]',
                section.ordered ? 'list-decimal' : 'list-disc',
              )}
            >
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </List>
          </section>
        )
      })}
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        {brief.actions.map((action, index) =>
          action.id === 'resume' ? (
            <Button
              key={action.id}
              type="button"
              variant="ghost"
              isLoading={resumeLoading}
              onClick={() => run(action.id)}
              className="resume-border-spin whitespace-nowrap rounded-2xl px-6 py-2.5 text-sm transition-none hover:bg-transparent hover:text-white"
            >
              {action.label}
            </Button>
          ) : (
            <Button
              key={action.id}
              type="button"
              // The first button is the one step that matters most right now.
              variant={index === 0 ? 'primary' : 'secondary'}
              onClick={() => run(action.id)}
              className={cn(
                'whitespace-nowrap rounded-2xl px-6 py-2.5',
                index === 0 ? paperPrimaryButtonClass : paperSecondaryButtonClass,
              )}
            >
              {action.label}
            </Button>
          ),
        )}
      </div>
      {resumeError ? (
        <p className="text-center text-xs text-red-700" role="alert">
          {resumeError}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Opens the message as a popup once per arrival. Closing it does not lose the
 * message — the Career path card takes it from there.
 */
export default function DqBriefModal({
  onViewResume,
  resumeLoading,
  resumeError,
}: {
  onViewResume: () => void
  resumeLoading: boolean
  resumeError: string | null
}) {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const showProfileSetup = useAuthStore((s) => s.showProfileSetup)
  const brief = useDqCoachStore((s) => s.brief)
  const loaded = useDriverOrientationStore((s) => s.loaded)
  const briefOpen = useDriverOrientationStore((s) => s.briefOpen)
  const load = useDriverOrientationStore((s) => s.load)
  const considerBrief = useDriverOrientationStore((s) => s.considerBrief)
  const closeBrief = useDriverOrientationStore((s) => s.closeBrief)

  useEffect(() => {
    if (sessionUserId) void load()
  }, [sessionUserId, load])

  useEffect(() => {
    // The name form is a modal too. The brief waits so the two never stack.
    if (!brief || !loaded || showProfileSetup) return
    considerBrief(brief.key)
  }, [brief, loaded, showProfileSetup, considerBrief])

  if (!briefOpen || !brief) return null

  return (
    <Modal onClose={closeBrief} maxWidth="max-w-md" paper zIndex={1100}>
      <ModalHeader title={brief.title} onClose={closeBrief} paper />
      <div className="p-4 sm:p-5">
        <DqBriefMessage
          brief={brief}
          showTitle={false}
          onActed={closeBrief}
          onViewResume={onViewResume}
          resumeLoading={resumeLoading}
          resumeError={resumeError}
        />
      </div>
    </Modal>
  )
}
