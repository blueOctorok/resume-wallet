'use client'

import { AlertTriangle, Car, FileWarning, StickyNote, ShieldCheck, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { employerScreeningReportReady } from '@/lib/hub-document-types'
import { detectOutreachAttention } from '@/lib/outreach-attention'
import type { Invite, ScreeningRow } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString()
}

interface KanbanCardProps {
  invite: Invite
  files: ScreeningRow[]
  /** Latest company-scoped screening consent bundle for this candidate, if any */
  consentBundle?: ConsentBundleSummary | null
  theme: string
  onClick: (invite: Invite) => void
}

/**
 * Compact tile for status-based kanban. Column = `invite.status` (set by the
 * candidate flow), so the card has no column picker — open the modal for actions.
 */
export default function KanbanCard({ invite, files, consentBundle, onClick }: KanbanCardProps) {
  const reportReadyFiles = files.filter((f) => employerScreeningReportReady(f.status))
  const needsReviewFiles = files.filter(
    (f) => String(f.status ?? '').toLowerCase() === 'needs_review',
  )
  const pendingFiles = files.filter((f) => !employerScreeningReportReady(f.status))

  const consentComplete = consentBundle?.status === 'complete'
  const consentPending = Boolean(consentBundle && !consentComplete)

  const completedCount =
    reportReadyFiles.length - needsReviewFiles.length + (consentComplete ? 1 : 0)
  const pendingCount = pendingFiles.length + (consentPending ? 1 : 0)

  const hasNotes = Boolean((invite.recruiterNotes ?? '').trim())
  const isExpiringSoon = (() => {
    if (!invite.expiresAt) return false
    if (['completed', 'cancelled', 'expired'].includes(invite.status)) return false
    const ms = new Date(invite.expiresAt).getTime() - Date.now()
    return ms > 0 && ms < 7 * 86400000
  })()

  // Derived "needs attention" signal — drives the red dot, tooltip, and
  // ring color. Pure function of (invite, files) so it stays in sync wherever
  // those two are rendered (board, detail modal, info modal copy).
  const attention = detectOutreachAttention(invite, files)

  return (
    <button
      type="button"
      onClick={() => onClick(invite)}
      title={attention ? attention.label : undefined}
      className="group relative min-w-0 w-full rounded-lg border border-stone-200 bg-white text-left transition-colors hover:border-ironside/50 hover:bg-stone-50"
    >
      {attention && (
        <span
          aria-label={attention.label}
          className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#f15a2b] ring-2 ring-white"
        />
      )}
      <div className="flex min-w-0 items-center gap-2 px-2.5 pt-2.5">
        <Avatar
          name={invite.candidateName || invite.candidateEmail || '?'}
          avatarUrl={null}
          size="xs"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-xs font-semibold leading-tight text-[#173150]">
            {invite.candidateName || invite.candidateEmail || (
              <span className="text-ironside">Anonymous</span>
            )}
          </p>
          {invite.candidateName && invite.candidateEmail && (
            <p className="truncate text-[10px] leading-tight text-ironside">
              {invite.candidateEmail}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 pb-2 pt-1 text-[10px] text-ironside">
        <span className="shrink-0">{timeAgo(invite.createdAt)}</span>

        {needsReviewFiles.length > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-[#8a6d3b]"
            title="Report ready — review recommended"
          >
            <FileWarning className="h-2.5 w-2.5" />
            {needsReviewFiles.length}
          </span>
        )}
        {completedCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-emerald-700">
            <ShieldCheck className="h-2.5 w-2.5" />
            {completedCount}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {pendingFiles.length > 0 ? (
              pendingFiles[0].kind === 'mvr' ? (
                <Car className="h-2.5 w-2.5" />
              ) : (
                <FileWarning className="h-2.5 w-2.5" />
              )
            ) : (
              <FileCheck className="h-2.5 w-2.5" />
            )}
            {pendingCount}
          </span>
        )}

        {hasNotes && (
          <span title="Has notes" className="shrink-0">
            <StickyNote className="h-2.5 w-2.5" aria-hidden />
          </span>
        )}

        {isExpiringSoon && (
          <span className="shrink-0" title="Expiring soon">
            <AlertTriangle className="h-2.5 w-2.5 text-[#8a6d3b]" />
          </span>
        )}
      </div>
    </button>
  )
}
