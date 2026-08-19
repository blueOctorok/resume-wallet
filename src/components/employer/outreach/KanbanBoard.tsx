'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
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

const COLUMN_DOTS: Record<OutreachKanbanColumn, string> = {
  pending: 'bg-amber-400',
  viewed: 'bg-sky-400',
  in_progress: 'bg-slate-400',
  completed: 'bg-emerald-500',
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
  sendingSmsId: string | null
  smsSentId: string | null
  removingId: string | null
  savingNotesId: string | null
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite, emailOverride?: string) => void
  onSendSms: (invite: Invite, phoneOverride?: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  onViewConsent?: (bundle: ConsentBundleSummary) => void
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
  /** Refresh screenings data — forwarded to OutreachCandidateCard refresh button */
  onRefreshScreenings?: () => void
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
  sendingSmsId,
  smsSentId,
  removingId,
  savingNotesId,
  onCopy,
  onShowQr,
  onSendEmail,
  onSendSms,
  onCancel,
  onRemove,
  onViewFile,
  onViewConsent,
  onEdit,
  onAskStormi,
  onRecruiterNotesSave,
  onResendConsent,
  resendingId,
  onPipelineStatusOverride,
  statusOverrideSavingId,
  onRefreshScreenings,
}: KanbanBoardProps) {
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

  // Empty columns (usually In progress) give their width to columns that
  // actually have people. The grid is always 100% of the panel — never a
  // horizontal strip of fixed-width wells.
  const visibleColumns = OUTREACH_KANBAN_COLUMNS.filter(
    (status) => (byColumn.get(status)?.length ?? 0) > 0,
  )
  const colCount = visibleColumns.length
  const gridCols =
    colCount <= 1
      ? 'grid-cols-1'
      : colCount === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : colCount === 3
          ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'

  return (
    <>
      <div className={cn('mt-4 grid min-w-0 gap-4 overflow-x-hidden', gridCols)}>
        {visibleColumns.map((status) => {
          const columnInvites = byColumn.get(status) ?? []
          return (
            <div key={status} className="flex min-w-0 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-stone-200 pb-2">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COLUMN_DOTS[status])} aria-hidden />
                <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-[#173150]">
                  {OUTREACH_KANBAN_LABEL[status]}
                </h3>
                <span className="shrink-0 text-[11px] tabular-nums text-ironside">
                  {columnInvites.length}
                </span>
              </div>

              <div className="scrollbar-none flex max-h-[min(55vh,28rem)] flex-col gap-1.5 overflow-y-auto overflow-x-hidden pt-2">
                {columnInvites.map((invite) => (
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
                ))}
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
              sendingSmsId={sendingSmsId}
              smsSentId={smsSentId}
              removingId={removingId}
              notesSaving={savingNotesId === activeInvite.id}
              onCopy={onCopy}
              onShowQr={onShowQr}
              onSendEmail={onSendEmail}
              onSendSms={onSendSms}
              onCancel={onCancel}
              onRemove={(id) => {
                onRemove(id)
                setActiveInviteId(null)
              }}
              onViewFile={onViewFile}
              onViewConsent={onViewConsent}
              onEdit={(inv) => {
                setActiveInviteId(null)
                onEdit(inv)
              }}
              onAskStormi={onAskStormi}
              onRecruiterNotesSave={onRecruiterNotesSave}
              onResendConsent={onResendConsent}
              resending={resendingId === activeInvite.id}
              onRefreshScreenings={onRefreshScreenings}
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
