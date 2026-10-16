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
import { personColumn, type OutreachPerson } from '@/lib/outreach-person'
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
  /** One entry per person. The column is `primary.status`. */
  people: OutreachPerson[]
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
 * One card per person. The column follows the ask that is still open
 * (`person.primary`). Other asks for that person open inside the same modal.
 */
export default function KanbanBoard({
  people,
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
  const [activePersonKey, setActivePersonKey] = useState<string | null>(null)

  const activePerson = useMemo(
    () => people.find((person) => person.key === activePersonKey) ?? null,
    [people, activePersonKey],
  )
  const activeInvite = activePerson?.primary ?? null

  const filesFor = (inv: Invite) => (inv.usedByUserId ? screeningsByUserId?.get(inv.usedByUserId) ?? [] : [])
  const bundleFor = (inv: Invite) => (inv.usedByUserId ? consentBundleByUserId?.get(inv.usedByUserId) : undefined)

  const byColumn = useMemo(() => {
    const m = new Map<OutreachKanbanColumn, OutreachPerson[]>()
    for (const col of OUTREACH_KANBAN_COLUMNS) m.set(col, [])
    for (const person of people) {
      const col = personColumn(person)
      if (col) m.get(col)!.push(person)
    }
    // Within each column, float "needs attention" cards to the top so the
    // recruiter sees stalled / failed screenings first — same idea as a stable
    // sort by attention then preserving incoming order for ties.
    for (const [col, list] of m) {
      const flagged: OutreachPerson[] = []
      const rest: OutreachPerson[] = []
      for (const person of list) {
        const invite = person.primary
        const files = invite.usedByUserId ? screeningsByUserId?.get(invite.usedByUserId) ?? [] : []
        if (detectOutreachAttention(invite, files)) flagged.push(person)
        else rest.push(person)
      }
      m.set(col, [...flagged, ...rest])
    }
    return m
  }, [people, screeningsByUserId])

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
                {columnInvites.map((person) => (
                  <KanbanCard
                    key={person.key}
                    invite={person.primary}
                    files={filesFor(person.primary)}
                    consentBundle={bundleFor(person.primary)}
                    askCount={person.invites.length}
                    onClick={() => setActivePersonKey(person.key)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal — same block shell as "New outreach" so the two feel like one tool.
          The card renders its own header (avatar + name + status + close). */}
      {activeInvite && activePerson && (
        <Modal
          onClose={() => setActivePersonKey(null)}
          maxWidth="max-w-2xl"
          zIndex={1100}
          panelShape="block"
          panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
        >
          <OutreachCandidateCard
            invite={activeInvite}
            otherInvites={activePerson.invites.filter((invite) => invite.id !== activeInvite.id)}
            files={filesFor(activeInvite)}
            consentBundle={bundleFor(activeInvite)}
            onClose={() => setActivePersonKey(null)}
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
              setActivePersonKey(null)
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
