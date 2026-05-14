'use client'

import { AlertTriangle, Car, FileWarning, StickyNote, Package, Users, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import Avatar from '@/components/ui/Avatar'
import { hubDocStatusFromScreeningOrder } from '@/lib/hub-document-types'
import { getBlockDefinition } from '@/lib/block-registry'
import { detectOutreachAttention } from '@/lib/outreach-attention'
import type { Invite, ScreeningRow } from './types'

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
  theme: string
  onClick: (invite: Invite) => void
}

/**
 * Compact tile for status-based kanban. Column = `invite.status` (set by the
 * candidate flow), so the card has no column picker — open the modal for actions.
 */
export default function KanbanCard({ invite, files, theme, onClick }: KanbanCardProps) {
  const isDark = isDarkTheme(theme)

  const blockDef = invite.targetBlockType ? getBlockDefinition(invite.targetBlockType) : null
  const blockLabel = blockDef?.label ?? (invite.targetBlockType ? invite.targetBlockType : 'General')

  const completedFiles = files.filter(
    (f) => hubDocStatusFromScreeningOrder(f.status) === 'complete',
  )
  const pendingFiles = files.filter(
    (f) => hubDocStatusFromScreeningOrder(f.status) !== 'complete',
  )

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
      className={cn(
        'group relative w-full rounded-lg border text-left transition-colors',
        attention
          ? isDark
            ? 'border-red-500/50 bg-red-950/30 hover:border-red-500 hover:bg-red-950/40'
            : 'border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-100/60'
          : isDark
            ? 'border-gray-700/80 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-900/70'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700/80 dark:bg-gray-900/40 dark:hover:border-gray-600',
      )}
    >
      {attention && (
        <span
          aria-label={attention.label}
          className="pointer-events-none absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"
        />
      )}
      <div className="flex min-w-0 items-center gap-2 px-2.5 pt-2.5">
        <Avatar
          name={invite.candidateName || invite.candidateEmail || '?'}
          avatarUrl={null}
          size="xs"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={cn(
              'truncate text-xs font-semibold leading-tight',
              isDark ? 'text-gray-100' : 'text-gray-900',
            )}
          >
            {invite.candidateName || invite.candidateEmail || (
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Anonymous</span>
            )}
          </p>
          {invite.candidateName && invite.candidateEmail && (
            <p className={cn('truncate text-[10px] leading-tight', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {invite.candidateEmail}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 pb-2.5 pt-1 text-[10px]">
        <span className={cn('inline-flex shrink-0 items-center gap-0.5', isDark ? 'text-gray-500' : 'text-gray-500')}>
          {invite.targetBlockType ? <Package className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
          {blockLabel}
        </span>
        <span className={cn('shrink-0', isDark ? 'text-gray-600' : 'text-gray-400')}>·</span>
        <span className={cn('shrink-0', isDark ? 'text-gray-500' : 'text-gray-500')}>{timeAgo(invite.createdAt)}</span>

        {completedFiles.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-2.5 w-2.5" />
            {completedFiles.length}
          </span>
        )}
        {pendingFiles.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
            {pendingFiles[0].kind === 'mvr' ? (
              <Car className="h-2.5 w-2.5" />
            ) : (
              <FileWarning className="h-2.5 w-2.5" />
            )}
            {pendingFiles.length}
          </span>
        )}

        {hasNotes && (
          <span title="Has notes" className="shrink-0">
            <StickyNote className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" aria-hidden />
          </span>
        )}

        {isExpiringSoon && (
          <span className="shrink-0">
            <AlertTriangle className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" aria-hidden />
          </span>
        )}
      </div>
    </button>
  )
}
