'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import {
  OUTREACH_KANBAN_COLUMNS,
  OUTREACH_KANBAN_LABEL,
  type OutreachKanbanColumn,
} from '@/lib/outreach-invite-buckets'
import { detectOutreachAttention } from '@/lib/outreach-attention'
import type { BlockDefinition } from '@/lib/block-registry'
import type { Invite, InviteStatus, ScreeningRow, ScreeningsByUserId } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'
import KanbanCard from './KanbanCard'
import OutreachCandidateCard from './OutreachCandidateCard'
import type { SendSelection } from './SendBlocksPanel'
import type { ContactPatch } from './ContactFields'

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

  // ── Detail modal: send + edit ──────────────────────────────────────────
  sendableBlocks: BlockDefinition[]
  /** Block type → createdAt of a live invite already out for this candidate. */
  alreadySentFor: (invite: Invite) => ReadonlyMap<string, string>
  /** Invite id whose detail modal currently has a send in flight. */
  sendingId: string | null
  onSendBlocks: (invite: Invite, selection: SendSelection) => Promise<void>
  onSaveContact: (inviteId: string, patch: ContactPatch) => Promise<void>

  // ── Detail modal: existing-link tools ──────────────────────────────────
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  sendingSmsId: string | null
  smsSentId: string | null
  removingId: string | null
  savingNotesId: string | null
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite) => void
  onSendSms: (invite: Invite) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  onViewConsent?: (bundle: ConsentBundleSummary) => void
  onAskStormi: (invite: Invite) => void
  onRecruiterNotesSave: (inviteId: string, notes: string) => void | Promise<void>
  onResendConsent?: (invite: Invite) => void | Promise<void>
  resendingId?: string | null
  onPipelineStatusOverride?: (inviteId: string, status: InviteStatus) => Promise<void>
  statusOverrideSavingId?: string | null
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
  sendableBlocks,
  alreadySentFor,
  sendingId,
  onSendBlocks,
  onSaveContact,
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

  const filesFor = (inv: Invite) => (inv.usedByUserId ? screeningsByUserId?.get(inv.usedByUserId) ?? [] : [])
  const bundleFor = (inv: Invite) => (inv.usedByUserId ? consentBundleByUserId?.get(inv.usedByUserId) : undefined)

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
                    files={filesFor(invite)}
                    consentBundle={bundleFor(invite)}
                    onClick={(inv) => setActiveInviteId(inv.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal — same block shell as "New outreach" so the two feel like one tool.
          The card renders its own header (avatar + name + status + close). */}
      {activeInvite && (
        <Modal
          onClose={() => setActiveInviteId(null)}
          maxWidth="max-w-2xl"
          zIndex={1100}
          panelShape="block"
          panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
        >
          <OutreachCandidateCard
            invite={activeInvite}
            files={filesFor(activeInvite)}
            consentBundle={bundleFor(activeInvite)}
            onClose={() => setActiveInviteId(null)}
            sendableBlocks={sendableBlocks}
            alreadySent={alreadySentFor(activeInvite)}
            sending={sendingId === activeInvite.id}
            onSendBlocks={onSendBlocks}
            onSaveContact={onSaveContact}
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
            onAskStormi={onAskStormi}
            onRecruiterNotesSave={onRecruiterNotesSave}
            onResendConsent={onResendConsent}
            resending={resendingId === activeInvite.id}
            onRefreshScreenings={onRefreshScreenings}
            onPipelineStatusOverride={onPipelineStatusOverride}
            statusOverrideSaving={statusOverrideSavingId === activeInvite.id}
          />
        </Modal>
      )}
    </>
  )
}
