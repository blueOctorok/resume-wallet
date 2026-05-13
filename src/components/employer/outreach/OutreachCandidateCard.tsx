'use client'

import { useState } from 'react'
import {
  Car,
  FileWarning,
  Eye,
  Mail,
  CheckCircle,
  Clock,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  XCircle,
  Trash2,
  Loader2,
  Send,
  X,
  ChevronDown,
  AlertTriangle,
  Package,
  Users,
  Pencil,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { getBlockDefinition } from '@/lib/block-registry'
import {
  hubDocStatusFromScreeningOrder,
  hubScreeningStatusLabel,
} from '@/lib/hub-document-types'
import { outcomeBadgeClasses, outcomeLabel } from '@/lib/accio-result-status'
import type { Invite, InviteStatus, ScreeningRow } from './types'

const STATUS_CONFIG: Record<
  InviteStatus,
  { label: string; icon: React.ReactNode; classes: string; dotClass: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  viewed: {
    label: 'Viewed',
    icon: <Eye className="h-3 w-3" />,
    classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  in_progress: {
    label: 'In progress',
    icon: <Loader2 className="h-3 w-3" />,
    classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    dotClass: 'bg-purple-400',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle className="h-3 w-3" />,
    classes: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotClass: 'bg-green-400',
  },
  expired: {
    label: 'Expired',
    icon: <Clock className="h-3 w-3" />,
    classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    dotClass: 'bg-gray-400',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="h-3 w-3" />,
    classes: 'bg-red-500/15 text-red-400 border-red-500/30',
    dotClass: 'bg-red-400',
  },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString()
}

/** "Expires in 5 days" / "Expires in 2 hours" — only meaningful when actionable. */
function expiryHint(expiresAt: string | null, status: InviteStatus): string | null {
  if (!expiresAt) return null
  if (status === 'completed' || status === 'cancelled' || status === 'expired') return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / 86400000)
  if (days >= 7) return null // not urgent enough to show
  if (days >= 1) return `Expires in ${days}d`
  const hours = Math.max(1, Math.floor(ms / 3600000))
  return `Expires in ${hours}h`
}

interface OutreachCandidateCardProps {
  invite: Invite
  /** Files (MVR/PSP) the company has paid for, scoped to this candidate. May be empty. */
  files: ScreeningRow[]
  walletAddress: string
  theme: string

  // Action handlers — owned by parent so optimistic updates land in one store.
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  removingId: string | null
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite, emailOverride?: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  onEdit: (invite: Invite) => void
  onAskStormi: (invite: Invite, files: ScreeningRow[]) => void
}

/**
 * One card = one outreached candidate. Combines:
 *   1. Identity (avatar, name, email, status)
 *   2. Inline file pills for any MVR/PSP this company has paid for
 *   3. Share + manage actions (copy link, QR, email, edit, cancel, remove)
 *   4. Ask Stormi — opens Stormi chat pre-loaded with this candidate's context
 */
export default function OutreachCandidateCard({
  invite,
  files,
  theme,
  copiedId,
  sendingEmailId,
  emailSentId,
  removingId,
  onCopy,
  onShowQr,
  onSendEmail,
  onCancel,
  onRemove,
  onViewFile,
  onEdit,
  onAskStormi,
}: OutreachCandidateCardProps) {
  const isDark = isDarkTheme(theme)
  const statusCfg = STATUS_CONFIG[invite.status] ?? STATUS_CONFIG.pending
  const blockDef = invite.targetBlockType ? getBlockDefinition(invite.targetBlockType) : null
  const blockLabel = blockDef?.label ?? (invite.targetBlockType ? invite.targetBlockType : 'General')

  const isCopiedLink = copiedId === invite.id
  const isSending = sendingEmailId === invite.id
  const isEmailSent = emailSentId === invite.id
  const isRemoving = removingId === invite.id
  const canAct = !['cancelled', 'completed', 'expired'].includes(invite.status)
  // Edit is allowed on pending/viewed invites only (not yet touched by candidate)
  const canEdit = ['pending', 'viewed'].includes(invite.status)

  // Inline email override input (when no email is on file yet).
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const expiry = expiryHint(invite.expiresAt, invite.status)

  return (
    <article
      className={cn(
        'group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border transition-colors',
        isDark
          ? 'border-gray-700/80 bg-gray-900/40 hover:border-gray-600'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-gray-600',
      )}
    >
      {/* ── Header: identity + badges ───────────────────────────────────────── */}
      <header className="flex min-w-0 items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700/70">
        <Avatar
          name={invite.candidateName || invite.candidateEmail || '?'}
          avatarUrl={null}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h4
              className={cn(
                'truncate text-sm font-semibold',
                isDark ? 'text-white' : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {invite.candidateName ||
                invite.candidateEmail ||
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Anonymous invite</span>}
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                statusCfg.classes,
              )}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </span>
          </div>
          {invite.candidateEmail && invite.candidateName && (
            <p className={cn('mt-0.5 truncate text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {invite.candidateEmail}
            </p>
          )}
          <div
            className={cn(
              'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]',
              isDark ? 'text-gray-500' : 'text-gray-500',
            )}
          >
            <span className="inline-flex items-center gap-1">
              {invite.targetBlockType ? <Package className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              {blockLabel}
            </span>
            <span>·</span>
            <span>{timeAgo(invite.createdAt)}</span>
            {invite.viewCount > 0 && (
              <>
                <span>·</span>
                <span>{invite.viewCount} view{invite.viewCount === 1 ? '' : 's'}</span>
              </>
            )}
            {invite.emailSentAt && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                  <Mail className="h-3 w-3" />
                  Emailed
                </span>
              </>
            )}
            {invite.jobTitle && (
              <>
                <span>·</span>
                <span className="truncate">{invite.jobTitle}</span>
              </>
            )}
          </div>
          {expiry && (
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1 text-[10px] font-medium',
                expiry === 'Expired'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {expiry}
            </p>
          )}
        </div>
      </header>

      {/* ── Files (MVR / PSP) ───────────────────────────────────────────────
         The whole point of the redesign — the candidate's screenings live ON
         the candidate, not in a separate panel. */}
      {files.length > 0 ? (
        <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700/70">
          <p
            className={cn(
              'mb-1.5 text-[10px] font-semibold uppercase tracking-wide',
              isDark ? 'text-gray-500' : 'text-gray-500',
            )}
          >
            Files ({files.length})
          </p>
          <ul className="space-y-1.5">
            {files.map((file) => (
              <FilePill key={`${file.kind}-${file.id}`} file={file} isDark={isDark} onView={() => onViewFile(file)} />
            ))}
          </ul>
        </div>
      ) : (
        <div
          className={cn(
            'border-b border-gray-100 px-4 py-2 text-[11px] dark:border-gray-700/70',
            isDark ? 'text-gray-500' : 'text-gray-500',
          )}
        >
          No screenings ordered yet for this candidate.
        </div>
      )}

      {/* ── Inline email-override input ─────────────────────────────────────── */}
      {showEmailInput && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="email"
              autoFocus
              placeholder="Candidate email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailInput.trim()) {
                  onSendEmail(invite, emailInput)
                  setShowEmailInput(false)
                  setEmailInput('')
                }
                if (e.key === 'Escape') {
                  setShowEmailInput(false)
                  setEmailInput('')
                }
              }}
              className={cn(
                'min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-500/40',
                isDark
                  ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500'
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!emailInput.trim()}
                onClick={() => {
                  onSendEmail(invite, emailInput)
                  setShowEmailInput(false)
                  setEmailInput('')
                }}
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowEmailInput(false)
                  setEmailInput('')
                }}
                aria-label="Cancel email override"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions: 3-col grid — Copy, Edit, QR / Email, Cancel, Remove ──────
         "Text" removed — it was redundant with Copy. Edit and Stormi are new.
         Stormi gets its own full-width row below with violet accent so it reads
         as an AI action, visually separated from the standard CRUD buttons. */}
      <div className="grid grid-cols-3 gap-1.5 p-2.5">
        <ActionBtn
          label={isCopiedLink ? 'Copied' : 'Copy'}
          icon={isCopiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          tone={isCopiedLink ? 'success' : 'default'}
          onClick={() => onCopy(invite.url, invite.id)}
          theme={theme}
        />
        {canEdit ? (
          <ActionBtn
            label="Edit"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => onEdit(invite)}
            theme={theme}
          />
        ) : (
          /* Keep the grid balanced when Edit is hidden */
          <div />
        )}
        <ActionBtn
          label="QR"
          icon={<QrCode className="h-3.5 w-3.5" />}
          onClick={() => onShowQr(invite)}
          theme={theme}
        />
        {canAct && (
          <ActionBtn
            label={
              isSending
                ? 'Sending'
                : isEmailSent
                  ? 'Sent'
                  : invite.emailSentAt
                    ? 'Resend'
                    : 'Email'
            }
            icon={
              isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isEmailSent ? (
                <Check className="h-3.5 w-3.5" />
              ) : invite.emailSentAt ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )
            }
            tone={isEmailSent ? 'success' : 'default'}
            disabled={isSending}
            onClick={() => {
              if (invite.candidateEmail) onSendEmail(invite)
              else setShowEmailInput(true)
            }}
            theme={theme}
          />
        )}
        {canAct && (
          <ActionBtn
            label="Cancel"
            icon={<XCircle className="h-3.5 w-3.5" />}
            tone="warn"
            onClick={() => onCancel(invite.id)}
            theme={theme}
          />
        )}
        <ActionBtn
          label={isRemoving ? '…' : 'Remove'}
          icon={isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          tone="danger"
          disabled={isRemoving}
          onClick={() => onRemove(invite.id)}
          theme={theme}
        />
      </div>

      {/* ── Stormi row — violet-accented, visually distinct from CRUD actions ── */}
      <div className="border-t border-gray-100 px-2.5 pb-2.5 pt-2 dark:border-gray-700/70">
        <button
          type="button"
          onClick={() => onAskStormi(invite, files)}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors',
            isDark
              ? 'border-violet-700/50 bg-violet-900/20 text-violet-300 hover:border-violet-600 hover:bg-violet-900/30'
              : 'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-300',
          )}
        >
          <Bot className="h-3.5 w-3.5" />
          Ask Stormi about this candidate
        </button>
      </div>
    </article>
  )
}

// ── File pill: one MVR or PSP row, compact, with a View button when ready ────

function FilePill({
  file,
  isDark,
  onView,
}: {
  file: ScreeningRow
  isDark: boolean
  onView: () => void
}) {
  const Icon = file.kind === 'mvr' ? Car : FileWarning
  const docStatus = hubDocStatusFromScreeningOrder(file.status)
  const ready = docStatus === 'complete'

  const pillCls = ready
    ? isDark
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'bg-emerald-100 text-emerald-800'
    : docStatus === 'processing'
      ? isDark
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-amber-100 text-amber-900'
      : docStatus === 'failed'
        ? isDark
          ? 'bg-red-500/15 text-red-300'
          : 'bg-red-100 text-red-800'
        : isDark
          ? 'bg-slate-700/70 text-slate-200'
          : 'bg-slate-200 text-slate-800'

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
        isDark ? 'border-gray-700/70 bg-gray-900/30' : 'border-gray-200 bg-white dark:border-gray-700/70 dark:bg-gray-900/20',
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-amber-400' : 'text-amber-600')}
        aria-hidden
      />
      <span className={cn('font-medium shrink-0', isDark ? 'text-gray-200' : 'text-gray-800')}>
        {file.kind === 'mvr' ? 'MVR' : 'PSP'}
      </span>
      {file.dlState && (
        <span className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-500')}>{file.dlState}</span>
      )}
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
          pillCls,
        )}
      >
        {hubScreeningStatusLabel(docStatus)}
      </span>
      {ready && file.resultOutcome && (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            outcomeBadgeClasses(file.resultOutcome),
          )}
        >
          {outcomeLabel(file.resultOutcome)}
        </span>
      )}
      <span className="ml-auto shrink-0">
        {ready ? (
          <Button type="button" variant="secondary" size="sm" className="!h-6 !px-2 !text-[10px]" onClick={onView}>
            <Eye className="mr-0.5 h-3 w-3" />
            View
          </Button>
        ) : (
          <span className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {docStatus === 'failed' ? 'Failed' : 'Processing'}
          </span>
        )}
      </span>
    </li>
  )
}

// ── Compact action button used in the 3-col grid ─────────────────────────────

function ActionBtn({
  label,
  icon,
  onClick,
  disabled,
  tone = 'default',
  theme,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'success' | 'warn' | 'danger'
  theme: string
}) {
  const isDark = isDarkTheme(theme)
  const toneCls =
    tone === 'success'
      ? 'border-green-500/40 text-green-700 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-400'
        : tone === 'danger'
          ? isDark
            ? 'border-red-900/40 text-red-400 hover:bg-red-950/40'
            : 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40'
          : ''

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50',
        isDark
          ? 'border-gray-700/70 bg-gray-900/40 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700/70 dark:bg-gray-900/30 dark:text-gray-300',
        toneCls,
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  )
}

