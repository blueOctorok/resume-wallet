'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  OUTREACH_KANBAN_COLUMNS,
  OUTREACH_KANBAN_LABEL,
  type OutreachKanbanColumn,
} from '@/lib/outreach-invite-buckets'
import { detectOutreachAttention } from '@/lib/outreach-attention'
import type { Invite, InviteStatus, ScreeningRow, ScreeningsByUserId } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'
import KanbanCard from './KanbanCard'
import OutreachCandidateCard from './OutreachCandidateCard'

const COLUMN_ACCENTS: Record<OutreachKanbanColumn, { bar: string; title: string }> = {
  pending: {
    bar: 'bg-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
  },
  viewed: {
    bar: 'bg-blue-400',
    title: 'text-blue-800 dark:text-blue-200',
  },
  in_progress: {
    bar: 'bg-purple-400',
    title: 'text-purple-800 dark:text-purple-200',
  },
  completed: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    title: 'text-emerald-800 dark:text-emerald-200',
  },
}

export interface KanbanBoardProps {
  invites: Invite[]
  screeningsByUserId?: ScreeningsByUserId
  /** Latest screening consent bundle per candidate — file badges on cards + modal */
  consentBundleByUserId?: Map<string, ConsentBundleSummary>
  theme: string
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  removingId: string | null
  savingNotesId: string | null
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite, emailOverride?: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  onEdit: (invite: Invite) => void
  onAskStormi: (invite: Invite) => void
  onRecruiterNotesSave: (inviteId: string, notes: string) => void | Promise<void>
  /**
   * Fired when the employer hits "Resend consent" inside the detail modal.
   * Parent owns the resend flow (creates a new invite + email) — we just
   * forward the trigger. Receives the invite that needs rescue.
   */
  onResendConsent?: (invite: Invite) => void | Promise<void>
  /** Invite id currently mid-resend so the button can disable itself. */
  resendingId?: string | null
  /** Kanban detail modal: employer may PATCH `invite.status` with override flag. */
  onPipelineStatusOverride?: (inviteId: string, status: InviteStatus) => Promise<void>
  statusOverrideSavingId?: string | null
}

/**
 * Kanban columns mirror `Invite.status` (candidate lifecycle). Placement is
 * automatic — employers do not drag between arbitrary pipeline buckets.
 * Stale completed invites are excluded here (they live under the Archive tab).
 */
export default function KanbanBoard({
  invites,
  screeningsByUserId,
  consentBundleByUserId,
  theme,
  copiedId,
  sendingEmailId,
  emailSentId,
  removingId,
  savingNotesId,
  onCopy,
  onShowQr,
  onSendEmail,
  onCancel,
  onRemove,
  onViewFile,
  onEdit,
  onAskStormi,
  onRecruiterNotesSave,
  onResendConsent,
  resendingId,
  onPipelineStatusOverride,
  statusOverrideSavingId,
}: KanbanBoardProps) {
  const isDark = isDarkTheme(theme)
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)

  const activeInvite = useMemo(
    () => invites.find((inv) => inv.id === activeInviteId) ?? null,
    [invites, activeInviteId],
  )

  const byColumn = useMemo(() => {
    const m = new Map<OutreachKanbanColumn, Invite[]>()
    for (const col of OUTREACH_KANBAN_COLUMNS) m.set(col, [])
    for (const inv of invites) {
      const col = inv.status
      if (m.has(col as OutreachKanbanColumn)) {
        m.get(col as OutreachKanbanColumn)!.push(inv)
      }
    }
    // Within each column, float "needs attention" cards to the top so the
    // recruiter sees stalled / failed screenings first — same idea as a stable
    // sort by attention then preserving incoming order for ties.
    for (const [col, list] of m) {
      const flagged: Invite[] = []
      const rest: Invite[] = []
      for (const inv of list) {
        const files = inv.usedByUserId
          ? screeningsByUserId?.get(inv.usedByUserId) ?? []
          : []
        if (detectOutreachAttention(inv, files)) flagged.push(inv)
        else rest.push(inv)
      }
      m.set(col, [...flagged, ...rest])
    }
    return m
  }, [invites, screeningsByUserId])

  return (
    <>
      <div
        className={cn(
          'mt-4 flex gap-3 overflow-x-auto pb-3',
          '[scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1.5',
        )}
      >
        {OUTREACH_KANBAN_COLUMNS.map((status) => {
          const columnInvites = byColumn.get(status) ?? []
          const accent = COLUMN_ACCENTS[status]
          return (
            <div
              key={status}
              className={cn(
                'flex w-[min(100%,18rem)] shrink-0 flex-col rounded-xl border',
                isDark
                  ? 'border-gray-700/80 bg-gray-900/25'
                  : 'border-gray-200 bg-gray-50/80',
              )}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b px-3 py-2',
                  isDark ? 'border-gray-700/70' : 'border-gray-200',
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', accent.bar)} aria-hidden />
                <h3 className={cn('min-w-0 flex-1 text-xs font-semibold', accent.title)}>
                  {OUTREACH_KANBAN_LABEL[status]}
                </h3>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600',
                  )}
                >
                  {columnInvites.length}
                </span>
              </div>

              {/* Per-column scroll so the page does not grow with many cards */}
              <div className="flex max-h-[min(55vh,26rem)] min-h-[6rem] flex-col gap-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">
                {columnInvites.length === 0 ? (
                  <p
                    className={cn(
                      'rounded-lg border border-dashed px-2 py-5 text-center text-[11px]',
                      isDark ? 'border-gray-700/60 text-gray-500' : 'border-gray-200 text-gray-500',
                    )}
                  >
                    No candidates
                  </p>
                ) : (
                  columnInvites.map((invite) => (
                    <KanbanCard
                      key={invite.id}
                      invite={invite}
                      files={
                        invite.usedByUserId
                          ? screeningsByUserId?.get(invite.usedByUserId) ?? []
                          : []
                      }
                      consentBundle={
                        invite.usedByUserId
                          ? consentBundleByUserId?.get(invite.usedByUserId)
                          : undefined
                      }
                      theme={theme}
                      onClick={(inv) => setActiveInviteId(inv.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {activeInvite && (
        <Modal onClose={() => setActiveInviteId(null)} maxWidth="max-w-2xl" zIndex={1100}>
          <ModalHeader
            title={activeInvite.candidateName || activeInvite.candidateEmail || 'Candidate'}
            subtitle="Candidate detail"
            onClose={() => setActiveInviteId(null)}
          />
          <div className="p-4">
            <OutreachCandidateCard
              invite={activeInvite}
              files={
                activeInvite.usedByUserId
                  ? screeningsByUserId?.get(activeInvite.usedByUserId) ?? []
                  : []
              }
              consentBundle={
                activeInvite.usedByUserId
                  ? consentBundleByUserId?.get(activeInvite.usedByUserId)
                  : undefined
              }
              theme={theme}
              copiedId={copiedId}
              sendingEmailId={sendingEmailId}
              emailSentId={emailSentId}
              removingId={removingId}
              notesSaving={savingNotesId === activeInvite.id}
              onCopy={onCopy}
              onShowQr={onShowQr}
              onSendEmail={onSendEmail}
              onCancel={onCancel}
              onRemove={(id) => {
                onRemove(id)
                setActiveInviteId(null)
              }}
              onViewFile={onViewFile}
              onEdit={(inv) => {
                setActiveInviteId(null)
                onEdit(inv)
              }}
              onAskStormi={onAskStormi}
              onRecruiterNotesSave={onRecruiterNotesSave}
              onResendConsent={onResendConsent}
              resending={resendingId === activeInvite.id}
              showPipelineStatusOverride
              onPipelineStatusOverride={onPipelineStatusOverride}
              statusOverrideSaving={statusOverrideSavingId === activeInvite.id}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
