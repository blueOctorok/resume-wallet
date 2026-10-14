'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, IdCard, Loader2, Mail, Phone, RefreshCw, Send, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import StepStrip from '@/components/employer/StepStrip'
import SendBlocksPanel, { type SendSelection } from '@/components/employer/outreach/SendBlocksPanel'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import EmployerConsentPackageModal from '@/components/employer/EmployerConsentPackageModal'
import CareerCardModal from '@/components/employer/CareerCardModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import { DriverEmploymentViewModal, DriverLicenseViewModal } from '@/components/employer/drivers/DriverArtifactModals'
import { cn } from '@/lib/utils'
import { getBlockDefinition } from '@/lib/block-registry'
import { getSendableOutreachBlocks } from '@/lib/outreach-sendable-blocks'
import { createAndDeliverInvites, sendInviteEmail, sendInviteSms } from '@/lib/outreach-send-client'
import { DRIVER_JOURNEY_ORDER, deriveDriverJourney, deriveDriverJourneySteps } from '@/lib/driver-journey'
import { useDriverBoardStore } from '@/stores/driver-board-store'
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'
import { useUIStore } from '@/stores/ui-store'
import { BallPill, DQ_ITEM_SHORT, DqStatusBadge, ballTone } from './DriverBlockBadges'
import DriverFileItemRow, { fmtDate } from './DriverFileItems'

type Viewer =
  | { kind: 'mvr' | 'psp'; id: string }
  | { kind: 'consent'; id: string }
  | { kind: 'dot'; id: string }
  | { kind: 'license' }
  | { kind: 'ev' }
  | { kind: 'card' }

const LIVE_INVITE = new Set(['pending', 'viewed', 'in_progress'])

function inviteStatusLabel(s: string): string {
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * The whole driver in one place: whose move it is, where they are in the
 * journey, every DQ item with the sentence that matters, outreach history,
 * and the actions that work from here (send / resend consent, open reports,
 * open the consent package, open the career card).
 */
export default function DriverFileModal({ userId, sessionUserId }: { userId: string; sessionUserId: string }) {
  const file = useDriverBoardStore((s) => s.fileByUserId[userId])
  const fileLoading = useDriverBoardStore((s) => s.fileLoading)
  const fileError = useDriverBoardStore((s) => s.fileError)
  const closeDriver = useDriverBoardStore((s) => s.closeDriver)
  const refreshFile = useDriverBoardStore((s) => s.refreshFile)
  const installed = useEmployerBlocksStore((s) => s.installedBlocks)
  const requestHubRefresh = useUIStore((s) => s.requestHubRefresh)

  const sendable = useMemo(() => getSendableOutreachBlocks(installed.map((b) => b.blockType)), [installed])

  // Local UI only — which nested viewer is open and in-flight action flags.
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState<'email' | 'sms' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const lite = useMemo(
    () => (file ? file.dqFile.items.filter((i) => i.blocksOverallCompletion).map(({ id, status }) => ({ id, status })) : []),
    [file],
  )
  const journey = deriveDriverJourney(lite)
  const steps = deriveDriverJourneySteps(lite)

  const liveItems = useMemo(() => {
    if (!file) return []
    const order = (id: string) => DRIVER_JOURNEY_ORDER.indexOf(id as (typeof DRIVER_JOURNEY_ORDER)[number])
    return file.dqFile.items.filter((i) => i.blocksOverallCompletion).sort((a, b) => order(a.id) - order(b.id))
  }, [file])
  const placeholders = file?.dqFile.items.filter((i) => !i.blocksOverallCompletion) ?? []

  const afterChange = async () => {
    await refreshFile(userId)
    requestHubRefresh()
  }

  const handleSendConsent = async (selection: SendSelection) => {
    if (!file) return
    setSending(true)
    setActionError(null)
    try {
      await createAndDeliverInvites(
        {
          candidateName: file.candidate.name,
          candidateEmail: file.candidate.email,
          candidatePhone: file.candidate.phone,
          candidateUserId: userId,
        },
        selection,
      )
      await afterChange()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleResendConsent = async (channel: 'email' | 'sms') => {
    if (!file) return
    const invite = file.detail.invites.find((i) => i.blockType === 'driver-screening-consent' && LIVE_INVITE.has(i.status))
    if (!invite) return
    setResending(channel)
    setActionError(null)
    try {
      if (channel === 'email' && file.candidate.email) await sendInviteEmail(invite.id, file.candidate.email)
      if (channel === 'sms' && file.candidate.phone) await sendInviteSms(invite.id, file.candidate.phone)
      await afterChange()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Resend failed')
    } finally {
      setResending(null)
    }
  }

  const cdlLine = file
    ? [
        file.detail.cdl?.cdlClass && `Class ${file.detail.cdl.cdlClass}`,
        file.detail.cdl?.state,
        file.detail.cdl?.expiration && `exp ${file.detail.cdl.expiration}`,
        file.detail.cdl?.endorsements.length ? `endorsements ${file.detail.cdl.endorsements.join('/')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const showSendPanel = journey.next?.id === 'cdlis_consent' && journey.next.status === 'missing' && sendable.length > 0

  return (
    <>
      <Modal onClose={closeDriver} maxWidth="max-w-3xl" panelShape="block" panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10">
        {!file && fileLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-ironside">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading driver file…</span>
          </div>
        )}
        {!file && fileError && (
          <div className="p-6">
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{fileError}</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void refreshFile(userId)}>Try again</Button>
              <Button type="button" variant="ghost" size="sm" onClick={closeDriver}>Close</Button>
            </div>
          </div>
        )}

        {file && (
          <div className="flex max-h-[88vh] flex-col">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="flex items-start gap-3 border-b border-stone-200 px-5 py-4">
              <Avatar name={file.candidate.name} avatarUrl={file.candidate.avatarUrl} size="lg" color="amber" round />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-[#173150]">{file.candidate.name}</h3>
                  <BallPill ball={journey.ball} />
                  <span className="text-xs text-ironside">{file.dqFile.completedCount} of {file.dqFile.totalLiveCount} on file</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ironside">
                  {cdlLine && (
                    <span className="inline-flex items-center gap-1"><IdCard className="h-3 w-3" />{cdlLine}</span>
                  )}
                  {!cdlLine && file.candidate.headline && <span>{file.candidate.headline}</span>}
                  {file.candidate.email && (
                    <a href={`mailto:${file.candidate.email}`} className="inline-flex items-center gap-1 hover:text-[#173150]"><Mail className="h-3 w-3" />{file.candidate.email}</a>
                  )}
                  {file.candidate.phone && (
                    <a href={`tel:${file.candidate.phone}`} className="inline-flex items-center gap-1 hover:text-[#173150]"><Phone className="h-3 w-3" />{file.candidate.phone}</a>
                  )}
                </p>
              </div>
              <button type="button" onClick={closeDriver} aria-label="Close" className="rounded-lg p-1.5 text-ironside transition-colors hover:bg-stone-100 hover:text-[#173150]">
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <StepStrip steps={steps} ariaLabel="Driver journey" />

              {journey.next && (
                <section className={cn('rounded-xl border p-4', journey.ball === 'you' || journey.ball === 'attention' ? 'border-[#f15a2b]/30 bg-[#f15a2b]/[0.04]' : 'border-stone-200 bg-stone-50/60')}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ironside">Next step</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#173150]">
                    <span className={cn('inline-block h-2 w-2 rounded-full ring-2 ring-inset', ballTone(journey.ball))} aria-hidden />
                    {journey.next.text}
                  </p>
                  {showSendPanel && (
                    <div className="mt-3">
                      <SendBlocksPanel
                        blocks={sendable}
                        email={file.candidate.email}
                        phone={file.candidate.phone}
                        showNote
                        sending={sending}
                        recipientFirstName={file.candidate.name.split(' ')[0]}
                        onSend={handleSendConsent}
                      />
                    </div>
                  )}
                </section>
              )}

              {actionError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</p>}

              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ironside">DQ file</p>
                <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
                  {liveItems.map((item) => (
                    <DriverFileItemRow
                      key={item.id}
                      item={item}
                      detail={file.detail}
                      actions={{
                        onViewReport: (kind, id) => setViewer({ kind, id }),
                        onViewConsent: (id) => setViewer({ kind: 'consent', id }),
                        onViewDot: (id) => setViewer({ kind: 'dot', id }),
                        onViewLicense: () => setViewer({ kind: 'license' }),
                        onViewEmployment: () => setViewer({ kind: 'ev' }),
                        onResendConsent: handleResendConsent,
                        resending,
                        hasEmail: Boolean(file.candidate.email),
                        hasPhone: Boolean(file.candidate.phone),
                      }}
                    />
                  ))}
                </ul>
              </section>

              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ironside">
                  <Send className="h-3 w-3" /> Outreach from your company
                </p>
                {file.detail.invites.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-200 px-3 py-3 text-xs text-ironside">No invites sent yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-xs">
                    {file.detail.invites.map((inv) => {
                      const delivered = [inv.emailSentAt && 'Email', inv.smsSentAt && 'Text'].filter(Boolean).join(' · ')
                      return (
                        <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <span className="font-medium text-[#173150]">{inv.blockType ? getBlockDefinition(inv.blockType)?.label ?? inv.blockType : 'Application'}</span>
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-[#173150]">{inviteStatusLabel(inv.status)}</span>
                          <span className={cn(delivered ? 'text-ironside' : 'font-medium text-[#f15a2b]')}>{delivered || 'Link created, not delivered'}</span>
                          {inv.viewCount > 0 && <span className="text-ironside">{inv.viewCount} view{inv.viewCount === 1 ? '' : 's'}</span>}
                          <span className="ml-auto text-ironside">{fmtDate(inv.createdAt)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {placeholders.length > 0 && (
                <details className="group rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ironside [&::-webkit-details-marker]:hidden">
                    Coming online ({placeholders.length})
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {placeholders.map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-1.5 text-[11px] text-ironside" title={p.description}>
                        {DQ_ITEM_SHORT[p.id]} <DqStatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-stone-50/70 px-4 py-2.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => setViewer({ kind: 'card' })}>
                Open career card
              </Button>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => void refreshFile(userId)} disabled={fileLoading} aria-label="Refresh file">
                  <RefreshCw className={cn('h-4 w-4', fileLoading && 'animate-spin')} />
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={closeDriver}>Close</Button>
              </div>
            </footer>
          </div>
        )}
      </Modal>

      {viewer?.kind === 'mvr' && (
        <MvrViewModal isOpen onClose={() => { setViewer(null); void refreshFile(userId) }} sessionUserId={sessionUserId} orderId={viewer.id} employerCandidateUserId={userId} />
      )}
      {viewer?.kind === 'psp' && (
        <PspViewModal isOpen onClose={() => { setViewer(null); void refreshFile(userId) }} sessionUserId={sessionUserId} orderId={viewer.id} employerCandidateUserId={userId} />
      )}
      {viewer?.kind === 'consent' && file && (
        <EmployerConsentPackageModal bundleId={viewer.id} candidateName={file.candidate.name} onClose={() => setViewer(null)} />
      )}
      {viewer?.kind === 'dot' && (
        <DotAppPreviewModal
          isOpen
          onClose={() => setViewer(null)}
          userId={userId}
          sessionUserId={sessionUserId}
          isDark={false}
          applicationId={viewer.id}
        />
      )}
      {viewer?.kind === 'license' && <DriverLicenseViewModal userId={userId} onClose={() => setViewer(null)} />}
      {viewer?.kind === 'ev' && file && (
        <DriverEmploymentViewModal rows={file.detail.employmentVerifications} onClose={() => setViewer(null)} />
      )}
      {viewer?.kind === 'card' && (
        <CareerCardModal candidateUserId={userId} sessionUserId={sessionUserId} onClose={() => setViewer(null)} />
      )}
    </>
  )
}
