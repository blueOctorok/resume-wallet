'use client'

import { useEffect, useState } from 'react'
import {
  Car,
  FileWarning,
  Eye,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  XCircle,
  Trash2,
  Loader2,
  X,
  Package,
  Users,
  Bot,
  StickyNote,
  ChevronRight,
  Sparkles,
  Send,
  FileCheck,
  FolderOpen,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDriverBoardStore } from '@/stores/driver-board-store'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { getBlockDefinition, type BlockDefinition } from '@/lib/block-registry'
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
import SendBlocksPanel, { type SendSelection } from './SendBlocksPanel'
import ContactFields, { type ContactPatch } from './ContactFields'
import OutreachProgress from './OutreachProgress'

const STATUS_CONFIG: Record<InviteStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  viewed: {
    label: 'Viewed',
    icon: <Eye className="h-3 w-3" />,
    classes: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  in_progress: {
    label: 'In progress',
    icon: <Loader2 className="h-3 w-3" />,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle className="h-3 w-3" />,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  expired: {
    label: 'Expired',
    icon: <Clock className="h-3 w-3" />,
    classes: 'bg-stone-100 text-stone-600 border-stone-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="h-3 w-3" />,
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString()
}

/** "Processing · 4m" — shown on in-flight screening pills instead of just "Processing" */
function elapsedLabel(orderedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(orderedAt).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

/** "Expires in 5d" — only when it is close enough to matter. */
function expiryHint(expiresAt: string | null, status: InviteStatus): string | null {
  if (!expiresAt || ['completed', 'cancelled', 'expired'].includes(status)) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / 86400000)
  if (days >= 7) return null
  if (days >= 1) return `Expires in ${days}d`
  return `Expires in ${Math.max(1, Math.floor(ms / 3600000))}h`
}

interface OutreachCandidateCardProps {
  invite: Invite
  /** Files (MVR/PSP) the company has paid for, scoped to this candidate. May be empty. */
  files: ScreeningRow[]
  /** Signed FCRA + FMCSA + CDLIS package — same source as the Files vault */
  consentBundle?: ConsentBundleSummary | null
  onClose: () => void

  // ── Send + edit (the primary job of this modal) ─────────────────────────
  sendableBlocks: BlockDefinition[]
  /** Block type → createdAt of a live invite already out for this candidate. */
  alreadySent: ReadonlyMap<string, string>
  sending: boolean
  onSendBlocks: (invite: Invite, selection: SendSelection) => Promise<void>
  onSaveContact: (inviteId: string, patch: ContactPatch) => Promise<void>

  // ── Existing-link tools (owned by parent so optimistic updates land in one store)
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  sendingSmsId: string | null
  smsSentId: string | null
  removingId: string | null
  onCopy: (url: string, id: string) => void
  onShowQr: (invite: Invite) => void
  onSendEmail: (invite: Invite) => void
  onSendSms: (invite: Invite) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onViewFile: (file: ScreeningRow) => void
  onViewConsent?: (bundle: ConsentBundleSummary) => void
  onAskStormi: (invite: Invite) => void
  notesSaving?: boolean
  onRecruiterNotesSave?: (inviteId: string, notes: string) => void | Promise<void>
  /** Mint a fresh consent invite for a stalled candidate (typo'd DL, failed order). */
  onResendConsent?: (invite: Invite) => void | Promise<void>
  resending?: boolean
  onRefreshScreenings?: () => void
  /** Pace ops escape hatch — force `invite.status` when the board is stuck vs reality. */
  onPipelineStatusOverride?: (inviteId: string, status: InviteStatus) => Promise<void>
  statusOverrideSaving?: boolean
}

/**
 * Candidate detail — the body of the kanban detail modal.
 *
 * Reads top to bottom in the order a recruiter thinks:
 *   where are they (progress) → anything wrong (attention) → fix contact →
 *   send what's missing → what's on file → notes / Stormi → link tools.
 */
export default function OutreachCandidateCard({
  invite,
  files,
  consentBundle,
  onClose,
  sendableBlocks,
  alreadySent,
  sending,
  onSendBlocks,
  onSaveContact,
  copiedId,
  sendingEmailId,
  emailSentId,
  sendingSmsId,
  smsSentId,
  removingId,
  onCopy,
  onShowQr,
  onSendEmail,
  onSendSms,
  onCancel,
  onRemove,
  onViewFile,
  onViewConsent,
  onAskStormi,
  notesSaving = false,
  onRecruiterNotesSave,
  onResendConsent,
  resending = false,
  onRefreshScreenings,
  onPipelineStatusOverride,
  statusOverrideSaving = false,
}: OutreachCandidateCardProps) {
  const statusCfg = STATUS_CONFIG[invite.status] ?? STATUS_CONFIG.pending
  const blockDef = invite.targetBlockType ? getBlockDefinition(invite.targetBlockType) : null
  const blockLabel = blockDef?.label ?? invite.targetBlockType ?? 'General invite'
  const displayName = invite.candidateName || invite.candidateEmail || 'Anonymous invite'
  const firstName = invite.candidateName?.trim().split(/\s+/)[0] ?? null
  // Driver file lives in the board's store so this card never has to be told about it.
  const openDriver = useDriverBoardStore((s) => s.openDriver)

  // Cancelled / expired are terminal — the link is dead. Completed stays live:
  // Pace's relationship with a driver is long-lived (annual re-pulls, new offers).
  const isTerminal = ['cancelled', 'expired'].includes(invite.status)
  const expiry = expiryHint(invite.expiresAt, invite.status)
  const attention = detectOutreachAttention(invite, files)

  const isCopied = copiedId === invite.id
  const isSendingEmail = sendingEmailId === invite.id
  const isEmailSent = emailSentId === invite.id
  const isSendingSms = sendingSmsId === invite.id
  const isSmsSent = smsSentId === invite.id
  const isRemoving = removingId === invite.id

  const [pipelineDraft, setPipelineDraft] = useState<InviteStatus>(invite.status)
  useEffect(() => setPipelineDraft(invite.status), [invite.id, invite.status])

  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(invite.recruiterNotes ?? '')
  useEffect(() => {
    if (!notesOpen) setNotesDraft(invite.recruiterNotes ?? '')
  }, [invite.recruiterNotes, notesOpen])
  const notesPreview = (invite.recruiterNotes ?? '').trim()

  const consentComplete = consentBundle?.status === 'complete'
  const hasMvr = files.some((f) => f.kind === 'mvr')
  const hasPsp = files.some((f) => f.kind === 'psp')
  const awaitingOrders =
    consentComplete && invite.targetBlockType === 'driver-screening-consent' && (!hasMvr || !hasPsp)
  const awaitingLabel =
    !hasMvr && !hasPsp ? 'MVR + PSP not submitted yet' : !hasMvr ? 'MVR not submitted yet' : 'PSP not submitted yet'
  const anyProcessing = files.some((f) => hubDocStatusFromScreeningOrder(f.status) === 'processing')
  const fileCount = files.length + (consentBundle ? 1 : 0) + (awaitingOrders ? 1 : 0)

  const sectionTitle = 'text-[10px] font-semibold uppercase tracking-wide text-ironside'

  return (
    <div className="flex flex-col">
      {/* ── Header — matches ModalHeader variant="block" tokens ─────────────── */}
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
        <Avatar name={displayName} avatarUrl={null} size="lg" color="amber" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight text-[#173150]">{displayName}</h3>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                statusCfg.classes,
              )}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </span>
            {expiry && (
              <span
                className={cn('text-[10px] font-semibold', expiry === 'Expired' ? 'text-red-600' : 'text-amber-700')}
              >
                {expiry}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ironside">
            <span className="inline-flex items-center gap-1">
              {invite.targetBlockType ? <Package className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              {blockLabel}
            </span>
            <span>·</span>
            <span>Invited {timeAgo(invite.createdAt)}</span>
            {invite.jobTitle && (
              <>
                <span>·</span>
                <span className="truncate">{invite.jobTitle}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-ironside transition-colors hover:bg-stone-100 hover:text-[#173150]"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-5 px-5 py-5">
        {/* ── Progress ──────────────────────────────────────────────────────── */}
        <OutreachProgress invite={invite} files={files} consentBundle={consentBundle} />

        {/* ── Stormi attention — only when something needs eyes ─────────────── */}
        {attention && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700"
              aria-hidden
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                Assistant: {attention.label}
              </p>
              <p className="mt-1 text-xs leading-snug text-gray-700">{attention.reason}</p>
              {attention.cta === 'resend_consent' && onResendConsent && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="mt-2"
                  disabled={resending}
                  onClick={() => onResendConsent(invite)}
                >
                  {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {resending ? 'Resending…' : 'Resend consent'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Contact — quiet inputs, blur to save ───────────────────────────── */}
        <section>
          <p className={cn(sectionTitle, 'mb-1.5')}>Contact</p>
          <ContactFields
            name={invite.candidateName}
            email={invite.candidateEmail}
            phone={invite.candidatePhone}
            disabled={isTerminal}
            onSave={(patch) => onSaveContact(invite.id, patch)}
          />
        </section>

        {/* ── Send — the one primary action ──────────────────────────────────── */}
        {!isTerminal && (
          <SendBlocksPanel
            blocks={sendableBlocks}
            alreadySent={alreadySent}
            email={invite.candidateEmail}
            phone={invite.candidatePhone}
            showNote
            sending={sending}
            recipientFirstName={firstName}
            onSend={(selection) => onSendBlocks(invite, selection)}
          />
        )}

        {/* ── Files ──────────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <p className={sectionTitle}>Files {fileCount > 0 && `(${fileCount})`}</p>
            {onRefreshScreenings && anyProcessing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!h-6 !px-1.5 !text-[10px]"
                onClick={onRefreshScreenings}
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            )}
          </div>
          {fileCount === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-200 px-3 py-2.5 text-xs text-ironside">
              Nothing on file yet. The signed consent package and MVR / PSP reports land here automatically.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {consentBundle && (
                <ConsentRow
                  bundle={consentBundle}
                  onView={consentComplete && onViewConsent ? () => onViewConsent(consentBundle) : undefined}
                />
              )}
              {awaitingOrders && (
                <li className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-900">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                  <span className="font-semibold">Awaiting candidate orders</span>
                  <span className="ml-auto text-[10px] text-amber-800/80">{awaitingLabel}</span>
                </li>
              )}
              {files.map((file) => (
                <FilePill key={`${file.kind}-${file.id}`} file={file} onView={() => onViewFile(file)} />
              ))}
            </ul>
          )}
        </section>

        {/* ── Notes + Stormi ─────────────────────────────────────────────────── */}
        <section className="space-y-2">
          {onRecruiterNotesSave && (
            <div className="rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => {
                  if (!notesOpen) setNotesDraft(invite.recruiterNotes ?? '')
                  setNotesOpen((o) => !o)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#173150] transition-colors hover:bg-stone-50"
              >
                <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                <span className="shrink-0">Team notes</span>
                {!notesOpen && notesPreview && (
                  <span className="min-w-0 truncate font-normal text-ironside">— {notesPreview}</span>
                )}
                <ChevronRight
                  className={cn('ml-auto h-3.5 w-3.5 shrink-0 transition-transform', notesOpen && 'rotate-90')}
                  aria-hidden
                />
              </button>
              {notesOpen && (
                <div className="relative border-t border-stone-200 p-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={() => {
                      const next = notesDraft.trim()
                      if (next !== notesPreview) void onRecruiterNotesSave(invite.id, next)
                    }}
                    disabled={notesSaving}
                    rows={4}
                    autoFocus
                    placeholder="Internal notes for your team — saves when you click away."
                    className="w-full resize-y rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-[#173150] placeholder-ironside outline-none focus:ring-2 focus:ring-[#173150]/20"
                  />
                  {notesSaving && (
                    <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-md bg-white/60">
                      <Loader2 className="h-4 w-4 animate-spin text-[#173150]" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Once the invite is claimed there is a person behind it — the driver file is the full picture. */}
            {invite.usedByUserId && (
              <button
                type="button"
                onClick={() => openDriver(invite.usedByUserId as string)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#173150]/20 bg-white px-3 py-2 text-xs font-semibold text-[#173150] transition-colors hover:border-[#173150]/40 hover:bg-stone-50"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open driver file
              </button>
            )}
            <button
              type="button"
              onClick={() => onAskStormi(invite)}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100',
                !invite.usedByUserId && 'sm:col-span-2',
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              Ask AI about {firstName ?? 'this candidate'}
            </button>
          </div>
        </section>
      </div>

      {/* ── Footer toolbar — link tools left, admin right ─────────────────────── */}
      {/* Two inner groups so a narrow modal wraps the whole admin cluster, never a lone button. */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stone-200 bg-stone-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <Tool
            icon={isCopied ? Check : Copy}
            label={isCopied ? 'Copied' : 'Copy link'}
            success={isCopied}
            onClick={() => onCopy(invite.url, invite.id)}
          />
          <Tool icon={QrCode} label="QR" onClick={() => onShowQr(invite)} />
          {!isTerminal && (
            <>
              <Tool
                icon={isSendingEmail ? Loader2 : isEmailSent ? Check : Mail}
                spin={isSendingEmail}
                success={isEmailSent}
                label={isEmailSent ? 'Sent' : invite.emailSentAt ? 'Resend email' : 'Email link'}
                disabled={isSendingEmail || !invite.candidateEmail}
                title={invite.candidateEmail ? undefined : 'Add an email in Contact first'}
                onClick={() => onSendEmail(invite)}
              />
              <Tool
                icon={isSendingSms ? Loader2 : isSmsSent ? Check : MessageSquare}
                spin={isSendingSms}
                success={isSmsSent}
                label={isSmsSent ? 'Sent' : invite.smsSentAt ? 'Resend text' : 'Text link'}
                disabled={isSendingSms || !invite.candidatePhone}
                title={invite.candidatePhone ? undefined : 'Add a phone in Contact first'}
                onClick={() => onSendSms(invite)}
              />
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {onPipelineStatusOverride && (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ironside transition-colors hover:bg-stone-200/60 hover:text-[#173150] [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Move on board
              </summary>
              <div className="absolute bottom-full right-0 z-20 mb-1 w-64 rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
                <p className="text-[11px] leading-snug text-ironside">
                  Forces this card's column when the board is out of sync. The candidate's app may not match until they
                  act again.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={pipelineDraft}
                    onChange={(e) => setPipelineDraft(e.target.value as InviteStatus)}
                    disabled={statusOverrideSaving}
                    aria-label="Override invite pipeline status"
                    className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-[#173150] outline-none focus:ring-2 focus:ring-[#173150]/20"
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
                    disabled={statusOverrideSaving || pipelineDraft === invite.status}
                    onClick={() =>
                      onPipelineStatusOverride(invite.id, pipelineDraft).catch(() => setPipelineDraft(invite.status))
                    }
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </details>
          )}
          {!isTerminal && <Tool icon={XCircle} label="Cancel invite" tone="warn" onClick={() => onCancel(invite.id)} />}
          <Tool
            icon={isRemoving ? Loader2 : Trash2}
            spin={isRemoving}
            label="Remove"
            tone="danger"
            disabled={isRemoving}
            onClick={() => onRemove(invite.id)}
          />
        </div>
      </footer>
    </div>
  )
}

// ── Footer tool button ───────────────────────────────────────────────────────

function Tool({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  tone = 'default',
  success = false,
  spin = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  tone?: 'default' | 'warn' | 'danger'
  success?: boolean
  spin?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        success
          ? 'text-emerald-700'
          : tone === 'danger'
            ? 'text-red-700 hover:bg-red-50'
            : tone === 'warn'
              ? 'text-amber-800 hover:bg-amber-50'
              : 'text-ironside hover:bg-stone-200/60 hover:text-[#173150]',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', spin && 'animate-spin')} />
      {label}
    </button>
  )
}

// ── Consent package row ──────────────────────────────────────────────────────

function ConsentRow({ bundle, onView }: { bundle: ConsentBundleSummary; onView?: () => void }) {
  const complete = bundle.status === 'complete'
  const inner = (
    <>
      <FileCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
      <span className="font-semibold">Signed consent package</span>
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
          complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900',
        )}
      >
        {complete ? 'Complete' : 'Pending'}
      </span>
      <span className="ml-auto text-[10px] text-teal-800/80">FCRA + FMCSA + CDLIS{onView ? ' · View' : ''}</span>
    </>
  )
  const cls =
    'flex w-full flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1.5 text-left text-xs text-teal-900'
  return (
    <li>
      {onView ? (
        <button
          type="button"
          onClick={onView}
          className={cn(cls, 'transition-colors hover:border-teal-300 hover:bg-teal-50')}
        >
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}

// ── File pill: one MVR or PSP row, compact, with a View button when ready ────

function FilePill({ file, onView }: { file: ScreeningRow; onView: () => void }) {
  const Icon = file.kind === 'mvr' ? Car : FileWarning
  const docStatus = hubDocStatusFromScreeningOrder(file.status)
  const ready = employerScreeningReportReady(file.status)
  const raw = String(file.status ?? '').toLowerCase()
  const needsReview = raw === 'needs_review'
  // `expired`/`cancelled` map to docStatus `failed`, but they're lapsed orders —
  // not a screening that came back failed. Render them neutral, not red.
  const lapsed = raw === 'expired' || raw === 'cancelled'

  const pillCls = ready
    ? needsReview
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-800'
    : docStatus === 'processing'
      ? 'bg-amber-100 text-amber-900'
      : docStatus === 'failed' && !lapsed
        ? 'bg-red-100 text-red-800'
        : 'bg-slate-200 text-slate-800'

  return (
    <li className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
      <span className="shrink-0 font-semibold text-[#173150]">
        {file.kind === 'mvr' ? 'MVR' : 'PSP'}
        {file.driverOwned ? ' · candidate-owned' : ''}
      </span>
      {file.dlState && <span className="text-[10px] text-ironside">{file.dlState}</span>}
      <span
        className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', pillCls)}
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
        ) : (
          <span className="text-[10px] text-ironside">
            {docStatus === 'processing' && file.orderedAt
              ? `Processing · ${elapsedLabel(file.orderedAt)}`
              : lapsed
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
