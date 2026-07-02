'use client'

import { useEffect, useState } from 'react'
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
  AlertTriangle,
  Package,
  Users,
  Pencil,
  Bot,
  StickyNote,
  ChevronRight,
  Sparkles,
  Send as SendIcon,
  FileCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { getBlockDefinition } from '@/lib/block-registry'
import {
  employerOutreachFileStatusLabel,
  employerScreeningReportReady,
  hubDocStatusFromScreeningOrder,
} from '@/lib/hub-document-types'
import { outcomeBadgeClasses, outcomeLabel } from '@/lib/accio-result-status'
import { detectOutreachAttention } from '@/lib/outreach-attention'
import type { Invite, InviteStatus, ScreeningRow } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'
import { ALL_INVITE_STATUSES } from './types'

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

/** "Processing · 4m" — shown on in-flight screening pills instead of just "Processing" */
function elapsedLabel(orderedAt: string): string {
  const ms = Date.now() - new Date(orderedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Processing · just now'
  if (mins < 60) return `Processing · ${mins}m`
  const hrs = Math.floor(mins / 60)
  return `Processing · ${hrs}h`
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
  /** Signed FCRA + FMCSA + CDLIS package stored for ordering — same source as Files vault */
  consentBundle?: ConsentBundleSummary | null
  theme: string

  // Action handlers — owned by parent so optimistic updates land in one store.
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  removingId: string | null
  /** When saving recruiter notes to the API for this invite. */
  notesSaving?: boolean
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite, emailOverride?: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  /** Open read-only signed consent package (FCRA + PSP + CDLIS). */
  onViewConsent?: (bundle: ConsentBundleSummary) => void
  onEdit: (invite: Invite) => void
  onAskStormi: (invite: Invite) => void
  /** Persist internal team notes (blur-to-save). */
  onRecruiterNotesSave?: (inviteId: string, notes: string) => void | Promise<void>
  /**
   * Fired when the employer wants to re-send a consent invite to a stalled
   * candidate (typo'd DL, failed order, etc.). Parent creates a new invite
   * tied to the same target block and sends an email.
   */
  onResendConsent?: (invite: Invite) => void | Promise<void>
  /** True while a resend is in flight for this invite. */
  resending?: boolean
  /** Refresh screenings data — shown when any file is still processing */
  onRefreshScreenings?: () => void
  /**
   * Kanban detail modal only: let Pace force `invite.status` when the board is
   * stuck vs reality (same DB field the columns use).
   */
  showPipelineStatusOverride?: boolean
  onPipelineStatusOverride?: (inviteId: string, status: InviteStatus) => Promise<void>
  statusOverrideSaving?: boolean
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
  consentBundle,
  theme,
  copiedId,
  sendingEmailId,
  emailSentId,
  removingId,
  notesSaving = false,
  onCopy,
  onShowQr,
  onSendEmail,
  onCancel,
  onRemove,
  onViewFile,
  onViewConsent,
  onEdit,
  onAskStormi,
  onRecruiterNotesSave,
  onResendConsent,
  resending = false,
  onRefreshScreenings,
  showPipelineStatusOverride = false,
  onPipelineStatusOverride,
  statusOverrideSaving = false,
}: OutreachCandidateCardProps) {
  const isDark = isDarkTheme(theme)
  const statusCfg = STATUS_CONFIG[invite.status] ?? STATUS_CONFIG.pending
  const blockDef = invite.targetBlockType ? getBlockDefinition(invite.targetBlockType) : null
  const blockLabel = blockDef?.label ?? (invite.targetBlockType ? invite.targetBlockType : 'General')

  const isCopiedLink = copiedId === invite.id
  const isSending = sendingEmailId === invite.id
  const isEmailSent = emailSentId === invite.id
  const isRemoving = removingId === invite.id
  // Cancelled / expired invites are terminal — the link is dead. Everything
  // else (including completed) stays actionable: Pace's relationship with the
  // candidate is long-lived and they may want to re-run MVR or PSP later
  // (annual review, post-incident audit, new offer) without collecting
  // consent again. The signed consent bundle is good for the lifetime of
  // the relationship.
  const isTerminal = ['cancelled', 'expired'].includes(invite.status)
  const canAct = !isTerminal
  const canEditDetails = !isTerminal
  const editDisabledTitle = (() => {
    if (canEditDetails) return undefined
    if (invite.status === 'cancelled') return 'Cancelled invites cannot be edited.'
    if (invite.status === 'expired') return 'Expired invites cannot be edited.'
    return 'Contact details cannot be edited for this invite.'
  })()

  // Inline email override input (when no email is on file yet).
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const [pipelineStatusDraft, setPipelineStatusDraft] = useState<InviteStatus>(invite.status)

  useEffect(() => {
    setPipelineStatusDraft(invite.status)
  }, [invite.id, invite.status])

  const showNotesSection = Boolean(onRecruiterNotesSave)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(invite.recruiterNotes ?? '')

  useEffect(() => {
    if (!notesOpen) setNotesDraft(invite.recruiterNotes ?? '')
  }, [invite.recruiterNotes, notesOpen])

  const hasNotesPreview = Boolean((invite.recruiterNotes ?? '').trim())

  const hasMvrFile = files.some((f) => f.kind === 'mvr')
  const hasPspFile = files.some((f) => f.kind === 'psp')
  const consentComplete = consentBundle?.status === 'complete'
  const awaitingDriverOrders =
    consentComplete &&
    invite.targetBlockType === 'driver-screening-consent' &&
    (!hasMvrFile || !hasPspFile)
  const awaitingOrdersLabel =
    !hasMvrFile && !hasPspFile
      ? 'MVR + PSP not submitted yet'
      : !hasMvrFile
        ? 'MVR not submitted yet'
        : 'PSP not submitted yet'

  const handleNotesBlur = () => {
    if (!onRecruiterNotesSave) return
    const next = notesDraft.trim()
    const prev = (invite.recruiterNotes ?? '').trim()
    if (next !== prev) void onRecruiterNotesSave(invite.id, next)
  }

  const expiry = expiryHint(invite.expiresAt, invite.status)

  // Pure-function attention check (same logic as the kanban card).
  // Re-derived per render so a fresh screening fetch instantly clears the
  // banner without any local state to invalidate.
  const attention = detectOutreachAttention(invite, files)

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

      {showPipelineStatusOverride && onPipelineStatusOverride && (
        <div
          className={cn(
            'border-b px-4 py-2.5 dark:border-gray-700/70',
            isDark ? 'border-amber-500/25 bg-amber-950/20' : 'border-amber-200 bg-amber-50/90 dark:border-amber-500/25',
          )}
        >
          <p
            className={cn(
              'mb-1.5 text-[10px] font-semibold uppercase tracking-wide',
              isDark ? 'text-amber-200/90' : 'text-amber-900 dark:text-amber-200/90',
            )}
          >
            Pipeline status (override)
          </p>
          <p className={cn('mb-2 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-amber-950/80 dark:text-gray-400')}>
            Moves this card on the kanban. Use when progress is stuck or out of sync — the candidate app may not match until they take action again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pipelineStatusDraft}
              onChange={(e) => setPipelineStatusDraft(e.target.value as InviteStatus)}
              disabled={statusOverrideSaving}
              className={cn(
                'min-w-[10rem] rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/40',
                isDark
                  ? 'border-amber-700/50 bg-gray-900 text-gray-100'
                  : 'border-amber-300 bg-white text-gray-900 dark:border-amber-700/50 dark:bg-gray-900 dark:text-gray-100',
              )}
              aria-label="Override invite pipeline status"
            >
              {ALL_INVITE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={statusOverrideSaving}
              disabled={statusOverrideSaving || pipelineStatusDraft === invite.status}
              onClick={async () => {
                if (pipelineStatusDraft === invite.status || !onPipelineStatusOverride) return
                try {
                  await onPipelineStatusOverride(invite.id, pipelineStatusDraft)
                } catch {
                  setPipelineStatusDraft(invite.status)
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* ── Stormi attention panel ──────────────────────────────────────────
         Renders ONLY when something needs the recruiter's eyes. Stormi-violet
         framing tells the recruiter "this is the AI flagging an issue", and
         the Resend Consent button gives them a one-click rescue path. */}
      {attention && (
        <div
          className={cn(
            'flex items-start gap-2.5 border-b px-4 py-3',
            isDark
              ? 'border-red-500/30 bg-red-950/25'
              : 'border-red-200 bg-red-50',
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
              isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-100 text-violet-700',
            )}
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                isDark ? 'text-red-300' : 'text-red-700',
              )}
            >
              Assistant: {attention.label}
            </p>
            <p
              className={cn(
                'mt-1 text-xs leading-snug',
                isDark ? 'text-gray-300' : 'text-gray-700',
              )}
            >
              {attention.reason}
            </p>
            {attention.cta === 'resend_consent' && onResendConsent && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-2"
                disabled={resending}
                onClick={() => onResendConsent(invite)}
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SendIcon className="h-3.5 w-3.5" />
                )}
                {resending ? 'Resending…' : 'Resend consent'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Files: consent package + MVR / PSP ───────────────────────────── */}
      {files.length > 0 || consentBundle ? (
        <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700/70">
          <div className="mb-1.5 flex items-center justify-between">
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                isDark ? 'text-gray-500' : 'text-gray-500',
              )}
            >
              Files ({files.length + (consentBundle ? 1 : 0) + (awaitingDriverOrders ? 1 : 0)})
            </p>
            {/* Show refresh when any screening is still processing */}
            {onRefreshScreenings && files.some((f) => hubDocStatusFromScreeningOrder(f.status) === 'processing') && (
              <button
                type="button"
                onClick={onRefreshScreenings}
                title="Refresh screening status"
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  isDark
                    ? 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                )}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Refresh
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {consentBundle && (
              consentBundle.status === 'complete' && onViewConsent ? (
                <li>
                  <button
                    type="button"
                    onClick={() => onViewConsent(consentBundle)}
                    aria-label={`View signed consent package for ${invite.candidateName || invite.candidateEmail || 'candidate'}`}
                    className={cn(
                      'flex w-full flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                      isDark
                        ? 'border-teal-500/30 bg-teal-950/25 text-teal-100 hover:border-teal-400/50 hover:bg-teal-950/40'
                        : 'border-teal-200 bg-teal-50/90 text-teal-900 hover:border-teal-300 hover:bg-teal-50',
                    )}
                  >
                    <FileCheck className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                    <span className="font-semibold">Signed consent package</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                        isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800',
                      )}
                    >
                      Complete
                    </span>
                    <span className={cn('ml-auto text-[10px]', isDark ? 'text-teal-300/80' : 'text-teal-800/80')}>
                      FCRA + FMCSA + CDLIS · View
                    </span>
                  </button>
                </li>
              ) : (
                <li
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                    isDark ? 'border-teal-500/30 bg-teal-950/25 text-teal-100' : 'border-teal-200 bg-teal-50/90 text-teal-900',
                  )}
                >
                  <FileCheck className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                  <span className="font-semibold">Signed consent package</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                      consentBundle.status === 'complete'
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-100 text-emerald-800'
                        : isDark
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-amber-100 text-amber-900',
                    )}
                  >
                    {consentBundle.status === 'complete' ? 'Complete' : 'Pending'}
                  </span>
                  <span className={cn('ml-auto text-[10px]', isDark ? 'text-teal-300/80' : 'text-teal-800/80')}>
                    FCRA + FMCSA + CDLIS · Files vault
                  </span>
                </li>
              )
            )}
            {awaitingDriverOrders && (
              <li
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                  isDark
                    ? 'border-amber-500/30 bg-amber-950/20 text-amber-100'
                    : 'border-amber-200 bg-amber-50/90 text-amber-900',
                )}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <span className="font-semibold">Awaiting candidate orders</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    isDark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-900',
                  )}
                >
                  Pending
                </span>
                <span className={cn('ml-auto text-[10px]', isDark ? 'text-amber-300/80' : 'text-amber-800/80')}>
                  {awaitingOrdersLabel}
                </span>
              </li>
            )}
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
          No consent package or screenings on file yet. Vault updates when the candidate signs or you order MVR/PSP.
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
        <ActionBtn
          label="Edit"
          icon={<Pencil className="h-3.5 w-3.5" />}
          disabled={!canEditDetails}
          title={editDisabledTitle}
          onClick={() => onEdit(invite)}
          theme={theme}
        />
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

      {/* ── Employer notes (same invite row; kanban columns follow candidate status) ─ */}
      {showNotesSection && (
        <div className="border-t border-gray-100 px-2.5 py-2 dark:border-gray-700/70">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (notesOpen) {
                  setNotesOpen(false)
                } else {
                  setNotesDraft(invite.recruiterNotes ?? '')
                  setNotesOpen(true)
                }
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold transition-colors',
                isDark
                  ? 'border-gray-700/70 text-gray-300 hover:bg-gray-800/60'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700/70 dark:text-gray-300 dark:hover:bg-gray-800/40',
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
                <span className="shrink-0">Notes</span>
                {!notesOpen && hasNotesPreview && (
                  <span className="min-w-0 truncate font-normal text-gray-500 dark:text-gray-500">
                    — {invite.recruiterNotes}
                  </span>
                )}
              </span>
              <ChevronRight
                className={cn('h-3.5 w-3.5 shrink-0 transition-transform', notesOpen && 'rotate-90')}
                aria-hidden
              />
            </button>

            {notesOpen && (
              <div className="relative">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={handleNotesBlur}
                  disabled={notesSaving}
                  rows={4}
                  placeholder="Internal notes for your team…"
                  className={cn(
                    'w-full resize-y rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-500/40',
                    isDark
                      ? 'border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-500'
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
                  )}
                />
                {notesSaving && (
                  <div
                    className={cn(
                      'pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/10 dark:bg-black/25',
                    )}
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-400" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stormi row — violet-accented, visually distinct from CRUD actions ── */}
      <div className="border-t border-gray-100 px-2.5 pb-2.5 pt-2 dark:border-gray-700/70">
        <button
          type="button"
          onClick={() => onAskStormi(invite)}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors',
            isDark
              ? 'border-violet-700/50 bg-violet-900/20 text-violet-300 hover:border-violet-600 hover:bg-violet-900/30'
              : 'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-300',
          )}
        >
          <Bot className="h-3.5 w-3.5" />
          Ask AI about this candidate
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
  const ready = employerScreeningReportReady(file.status)
  const needsReview = String(file.status ?? '').toLowerCase() === 'needs_review'
  // `expired`/`cancelled` map to docStatus `failed`, but they're lapsed/pulled
  // orders — not a screening that came back failed. Render them neutral (slate)
  // so they don't read as a red error on completed cards.
  const lapsed = ['expired', 'cancelled'].includes(String(file.status ?? '').toLowerCase())

  const pillCls = ready
    ? needsReview
      ? isDark
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-amber-100 text-amber-900'
      : isDark
        ? 'bg-emerald-500/15 text-emerald-300'
        : 'bg-emerald-100 text-emerald-800'
    : docStatus === 'processing'
      ? isDark
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-amber-100 text-amber-900'
      : docStatus === 'failed' && !lapsed
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
        {file.driverOwned ? ' · candidate-owned' : ''}
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
        {employerOutreachFileStatusLabel(file.status)}
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
        ) : docStatus === 'processing' && file.orderedAt ? (
          <span className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {elapsedLabel(file.orderedAt)}
          </span>
        ) : (
          <span className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {lapsed
              ? employerOutreachFileStatusLabel(file.status)
              : docStatus === 'failed'
                ? 'Failed'
                : 'Processing'}
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
  title,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'success' | 'warn' | 'danger'
  theme: string
  /** Native tooltip — used when Edit is disabled so recruiters know why. */
  title?: string
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
      title={title}
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

