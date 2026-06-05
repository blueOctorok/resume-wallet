'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, type ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Loader2,
  AlertCircle,
  Send,
  UserPlus,
  CheckCircle,
  Clock,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import type { ProjectedCareerCard as ProjectedCardData } from '@/types/career-card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import MessagingButton from '@/components/messaging/MessagingButton'
import { useUIStore } from '@/stores'
import { getRequestableBlocks, getBlockDefinition, employerCanRequest } from '@/lib/block-registry'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'

interface PendingCandidateRequest {
  id: string
  request_type: string
  document_type: string | null
  target_block_type: string | null
  status: string
  created_at: string
}

interface EmployerTalentExtras {
  installedBlockTypes: string[]
  /** Company-scoped composable hub — gates MVR/PSP employer actions */
  installedEmployerBlocks: string[]
  pendingRequests: PendingCandidateRequest[]
  existingApplication: { id: string; job_posting_id: string; status: string; created_at: string } | null
  completionFlags: Record<string, boolean>
  /** Latest complete screening_consent_bundles row for this company + candidate (MVR/PSP order path) */
  screeningConsentBundleId: string | null
  hasBgcheckConsent: boolean
  bgcheckConsentSignedAt: string | null
  bgcheckConsentFormData: Record<string, unknown> | null
  /** FMCSA PSP Disclosure & Authorization (separate from MVR bgcheck consent) */
  hasPspFmcsaConsent: boolean
  pspFmcsaConsentSignedAt: string | null
  pspFmcsaConsentFormData: Record<string, unknown> | null
}

interface CareerCardModalProps {
  candidateUserId: string
  walletAddress: string
  onClose: () => void
}

interface JobPosting {
  id: string
  title: string
  isActive: boolean
}

export default function CareerCardModal({
  candidateUserId,
  walletAddress,
  onClose,
}: CareerCardModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<ProjectedCardData | null>(null)
  const [employerExtras, setEmployerExtras] = useState<EmployerTalentExtras | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [requestLoading, setRequestLoading] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState<string | null>(null)

  const { navigateToMessages } = useUIStore()

  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [recruitMessage, setRecruitMessage] = useState('')
  const [recruitLoading, setRecruitLoading] = useState(false)

  /** Employer-paid Accio order (MVR or PSP) — one modal; product picks API + payment rail */
  const [showAccioOrderModal, setShowAccioOrderModal] = useState(false)
  const [accioOrderProduct, setAccioOrderProduct] = useState<'mvr' | 'psp'>('mvr')
  const [accioOrderLoading, setAccioOrderLoading] = useState(false)
  const [accioOrderError, setAccioOrderError] = useState<string | null>(null)
  const [mvrEmployerOrderDone, setMvrEmployerOrderDone] = useState(false)
  const [pspEmployerOrderDone, setPspEmployerOrderDone] = useState(false)

  const [employerMvrViewOrderId, setEmployerMvrViewOrderId] = useState<string | null>(null)
  const [employerPspViewOrderId, setEmployerPspViewOrderId] = useState<string | null>(null)

  const [employerCompany, setEmployerCompany] = useState<{
    id: string
    walletAddress: string | null
  } | null>(null)


  // Fetch on mount
  useEffect(() => {
    fetchCareerCard()
  }, [candidateUserId])

  // Refresh when window regains focus so stale data is never shown
  useEffect(() => {
    const handleFocus = () => fetchCareerCard(true)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [candidateUserId])

  const fetchCareerCard = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      const response = await fetch(`/api/employer/talent/${candidateUserId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load career card')
      }

      const data = await response.json()
      setCard(data.card ?? null)
      setEmployerCompany(data.employerCompany ?? null)
      setEmployerExtras({
        installedBlockTypes: data.installedBlockTypes ?? [],
        installedEmployerBlocks: data.installedEmployerBlocks ?? [],
        pendingRequests: data.pendingRequests ?? [],
        existingApplication: data.existingApplication ?? null,
        completionFlags: data.completionFlags ?? {},
        screeningConsentBundleId: data.screeningConsentBundleId ?? null,
        hasBgcheckConsent: Boolean(data.hasBgcheckConsent),
        bgcheckConsentSignedAt: data.bgcheckConsentSignedAt ?? null,
        bgcheckConsentFormData: (data.bgcheckConsentFormData ?? null) as Record<string, unknown> | null,
        hasPspFmcsaConsent: Boolean(data.hasPspFmcsaConsent),
        pspFmcsaConsentSignedAt: data.pspFmcsaConsentSignedAt ?? null,
        pspFmcsaConsentFormData: (data.pspFmcsaConsentFormData ?? null) as Record<string, unknown> | null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career card')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // ── Registry-driven block request helpers ──────────────────────────────
  // The block registry is the source of truth. Any block with
  // employerRequestable: true automatically gets a request button.
  //
  // MVR uses request_type `mvr_order` (not `block_request`) so candidate inbox,
  // bgcheck consent API, and FCRA disclosure stay on the same pipeline.

  const buildEmployerRequestBody = (blockType: string) => {
    const message = 'Requested via Storm Talent Search'
    if (blockType === 'driver-mvr') {
      return {
        requestType: 'mvr_order' as const,
        targetBlockType: 'driver-mvr',
        message,
      }
    }
    if (blockType === 'driver-psp') {
      return {
        requestType: 'psp_order' as const,
        targetBlockType: 'driver-psp',
        message,
      }
    }
    return {
      requestType: 'block_request' as const,
      targetBlockType: blockType,
      message,
    }
  }

  const requestBlockById = async (blockType: string) => {
    try {
      setRequestLoading(blockType)
      const response = await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(buildEmployerRequestBody(blockType)),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create request')
      }
      await fetchCareerCard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setRequestLoading(null)
    }
  }

  const resendBlockRequest = async (blockType: string) => {
    const pending = getPendingRequestForBlock(blockType)
    if (!pending) return
    try {
      setResendLoading(blockType)
      await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ requestId: pending.id }),
      })
      await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(buildEmployerRequestBody(blockType)),
      })
      await fetchCareerCard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend request')
    } finally {
      setResendLoading(null)
    }
  }

  /** Find a pending request that targets a specific block (new style) or matches legacy request types */
  const getPendingRequestForBlock = (blockType: string) =>
    employerExtras?.pendingRequests?.find(r =>
      (r.target_block_type === blockType) ||
      (blockType === 'storm-resume' &&
        (r.target_block_type === 'storm-resume' ||
          (r.request_type === 'document_upload' && r.document_type === 'resume'))) ||
      (blockType === 'driver-resume' && r.request_type === 'document_upload' && r.document_type === 'resume') ||
      (blockType === 'driver-mvr' &&
        (r.request_type === 'mvr_order' ||
          (r.request_type === 'block_request' && r.target_block_type === 'driver-mvr'))) ||
      (blockType === 'driver-psp' &&
        (r.request_type === 'psp_order' ||
          (r.request_type === 'block_request' && r.target_block_type === 'driver-psp'))) ||
      (blockType === 'driver-screening-consent' &&
        r.request_type === 'block_request' &&
        r.target_block_type === 'driver-screening-consent') ||
      (blockType === 'driver-dot-application' && r.request_type === 'profile_completion')
    ) || null

  // ── Recruit helpers ───────────────────────────────────────────────────────

  const openRecruitModal = () => {
    setShowRecruitModal(true)
    setSelectedJobId(null)
    setRecruitMessage('')
    fetchJobPostings()
  }

  const fetchJobPostings = async () => {
    try {
      setJobsLoading(true)
      const response = await fetch('/api/employer/jobs')
      const data = await response.json()
      setJobPostings((data.jobs || []).filter((j: JobPosting) => j.isActive))
    } catch { /* non-critical */ }
    finally { setJobsLoading(false) }
  }

  const recruitCandidate = async () => {
    if (!selectedJobId) { alert('Please select a job posting'); return }
    try {
      setRecruitLoading(true)
      const response = await fetch(`/api/employer/talent/${candidateUserId}/recruit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ jobPostingId: selectedJobId, message: recruitMessage || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create application')
      alert(`Application created! ${card?.name || 'The candidate'} has been notified.`)
      setShowRecruitModal(false)
      await fetchCareerCard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to recruit candidate')
    } finally {
      setRecruitLoading(false)
    }
  }

  // ── Employer Accio orders (MVR / PSP): payment → API call ─────────────────

  const handleAccioEmployerOrder = async (fields?: MvrOrderFields) => {
    setAccioOrderLoading(true)
    setAccioOrderError(null)

    const bundleId = employerExtras?.screeningConsentBundleId ?? null
    const useScreeningsOrderEndpoint =
      Boolean(bundleId) &&
      employerExtras?.installedEmployerBlocks?.includes('employer-screening-consent') === true

    const productLabel = accioOrderProduct === 'mvr' ? 'MVR' : 'PSP'

    try {
      if (useScreeningsOrderEndpoint) {
        const response = await fetch('/api/employer/screenings/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
            candidateUserId,
            type: accioOrderProduct,
            consentBundleId: bundleId,
          }),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to place ${productLabel} order`)
        }
        if (accioOrderProduct === 'mvr') setMvrEmployerOrderDone(true)
        else setPspEmployerOrderDone(true)
        await fetchCareerCard()
        return
      }

      const endpoint =
        accioOrderProduct === 'mvr' ? '/api/employer/mvr/order' : '/api/employer/psp/order'

      if (!fields) {
        throw new Error('Order form data is required')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          candidateUserId,
          ...fields,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to place ${productLabel} order`)
      }

      if (accioOrderProduct === 'mvr') setMvrEmployerOrderDone(true)
      else setPspEmployerOrderDone(true)
      await fetchCareerCard()
    } catch (err) {
      setAccioOrderError(err instanceof Error ? err.message : `Failed to place ${productLabel} order`)
    } finally {
      setAccioOrderLoading(false)
    }
  }

  // ── Registry-driven action slots ────────────────────────────────────────
  // Every block with employerRequestable: true gets a "Request {label}" button
  // automatically. No manual wiring needed when a new block is added.

  const requestableBlocks = getRequestableBlocks()

  /** Build an action node for a requestable block — returns null if not applicable */
  const buildBlockAction = (blockId: string): ReactNode => {
    const def = getBlockDefinition(blockId)
    if (!def?.employerRequestable) return null

    const employerBlocks = employerExtras?.installedEmployerBlocks ?? []
    if (!employerCanRequest(def, employerBlocks)) return null

    // Only show if candidate has the block installed (hub is source of truth)
    const installed = employerExtras?.installedBlockTypes?.includes(blockId)
    if (!installed) return null

    // Hide if the block's deliverable is already complete (career_cards aggregates)
    if (def.completionField && employerExtras?.completionFlags[def.completionField]) return null

    // No duplicate "order" flow when this company already has a private MVR / PSP on file
    if (blockId === 'driver-mvr' && card?.employerCompanyMvr) return null
    if (blockId === 'driver-psp' && card?.employerCompanyPsp) return null

    const pending = getPendingRequestForBlock(blockId)

    const actionButton = (
      <ActionButton
        label={`Request ${def.requestLabel}`}
        loading={requestLoading === blockId}
        resendLoading={resendLoading === blockId}
        isPending={!!pending}
        onClick={() => requestBlockById(blockId)}
        onResend={() => resendBlockRequest(blockId)}
        theme={theme}
      />
    )

    // MVR / PSP: consent gate — full bundle when company uses `employer-screening-consent`,
    // otherwise legacy per-instrument consent flags.
    if (blockId === 'driver-mvr') {
      const screeningBundleFlow =
        employerExtras?.installedEmployerBlocks?.includes('employer-screening-consent') === true
      const bundleComplete = employerExtras?.completionFlags?.hasScreeningConsentBundle === true
      const consentReady = screeningBundleFlow
        ? bundleComplete
        : employerExtras?.hasBgcheckConsent === true
      const waitTitle = screeningBundleFlow
        ? 'Waiting for candidate to complete the screening consent package (FCRA + FMCSA + CDLIS)'
        : 'Waiting for candidate to sign disclosure'
      return (
        <div className="flex items-center gap-2">
          {actionButton}
          <button
            onClick={() => { setAccioOrderProduct('mvr'); setShowAccioOrderModal(true) }}
            disabled={!consentReady || mvrEmployerOrderDone}
            title={consentReady ? 'Order MVR' : waitTitle}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mvrEmployerOrderDone
                ? isDarkTheme(theme) ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
                : consentReady
                  ? isDarkTheme(theme)
                    ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 cursor-pointer'
                    : 'bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer'
                  : isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {mvrEmployerOrderDone ? (
              <><CheckCircle className="w-3 h-3" /> Ordered</>
            ) : (
              <><CreditCard className="w-3 h-3" /> Order MVR</>
            )}
          </button>
        </div>
      )
    }

    if (blockId === 'driver-psp') {
      const screeningBundleFlow =
        employerExtras?.installedEmployerBlocks?.includes('employer-screening-consent') === true
      const bundleComplete = employerExtras?.completionFlags?.hasScreeningConsentBundle === true
      const consentReady = screeningBundleFlow
        ? bundleComplete
        : employerExtras?.hasPspFmcsaConsent === true
      const waitTitle = screeningBundleFlow
        ? 'Waiting for candidate to complete the screening consent package (FCRA + FMCSA + CDLIS)'
        : 'Waiting for candidate to sign FMCSA PSP disclosure'
      return (
        <div className="flex items-center gap-2">
          {actionButton}
          <button
            onClick={() => { setAccioOrderProduct('psp'); setShowAccioOrderModal(true) }}
            disabled={!consentReady || pspEmployerOrderDone}
            title={consentReady ? 'Order PSP' : waitTitle}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pspEmployerOrderDone
                ? isDarkTheme(theme) ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
                : consentReady
                  ? isDarkTheme(theme)
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 cursor-pointer'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 cursor-pointer'
                  : isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {pspEmployerOrderDone ? (
              <><CheckCircle className="w-3 h-3" /> Ordered</>
            ) : (
              <><CreditCard className="w-3 h-3" /> Order PSP</>
            )}
          </button>
        </div>
      )
    }

    return actionButton
  }

  const messagingContext = employerExtras?.existingApplication?.id
    ? { applicationId: employerExtras.existingApplication.id }
    : employerExtras?.pendingRequests?.[0]?.id
      ? { candidateRequestId: employerExtras.pendingRequests[0].id }
      : null

  const footerActions = (
    <>
      {employerExtras?.existingApplication ? (
        <span className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
          isDarkTheme(theme) ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700'
        }`}>
          <CheckCircle className="w-4 h-4" />
          Already Applied ({employerExtras.existingApplication.status})
        </span>
      ) : (
        <button
          type="button"
          onClick={openRecruitModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Recruit Candidate
        </button>
      )}

      {messagingContext && card && (
        <MessagingButton
          otherUserId={candidateUserId}
          {...messagingContext}
          subject={`Re: ${card.name}`}
          walletAddress={walletAddress}
          onThreadOpen={(threadId) => {
            onClose()
            navigateToMessages(threadId)
          }}
        />
      )}

      {employerExtras && employerExtras.pendingRequests.length > 0 && (
        <span className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
          isDarkTheme(theme) ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
        }`}>
          <Clock className="w-4 h-4" />
          {employerExtras.pendingRequests.length} pending request{employerExtras.pendingRequests.length !== 1 ? 's' : ''}
        </span>
      )}
    </>
  )

  const requestActionNodes =
    card && employerExtras
      ? requestableBlocks
          .map((block) => {
            const node = buildBlockAction(block.id)
            return node ? <span key={block.id}>{node}</span> : null
          })
          .filter(Boolean)
      : []

  // ── Modal shell ───────────────────────────────────────────────────────────

  const modalContent = (
    <Modal onClose={onClose} maxWidth="max-w-4xl" zIndex={9999}>
      {/* Custom header with avatar + refresh (not using ModalHeader because of Avatar) */}
      <div
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5 border-b',
          'backdrop-blur-md border-gray-200/90 dark:border-gray-700/80',
          isDarkTheme(theme)
            ? 'bg-gray-950/85'
            : 'bg-white/90',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/35 to-transparent dark:via-teal-400/25"
        />
        <div className="flex items-center gap-3 min-w-0 relative">
          <div
            className={cn(
              'rounded-full ring-2 ring-offset-2 shrink-0',
              isDarkTheme(theme) ? 'ring-teal-400/40 ring-offset-gray-950' : 'ring-teal-500/30 ring-offset-white',
            )}
          >
            <Avatar
              name={card?.name || '?'}
              avatarUrl={card?.avatarUrl}
              size="md"
              color="teal"
            />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.18em] mb-0.5',
                isDarkTheme(theme) ? 'text-teal-400/80' : 'text-teal-700/80',
              )}
            >
              Talent · Career card
            </p>
            <h3
              className={cn(
                'font-bold text-lg tracking-tight truncate',
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900',
              )}
            >
              {loading ? 'Loading…' : card?.name || 'Career card'}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchCareerCard(true)}
            disabled={isRefreshing}
            title="Refresh"
            aria-label="Refresh career card"
            className="!p-2"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div
        className={cn(
          'p-4 sm:p-6',
          isDarkTheme(theme) ? 'bg-gray-950/40' : 'bg-slate-50/40',
        )}
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-10 h-10 animate-spin ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
        )}
        {error && (
          <div className={`p-6 rounded-xl text-center ${isDarkTheme(theme) ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertCircle className="w-10 h-10 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && card && employerExtras && (
          <>
            {requestActionNodes.length > 0 && (
              <div
                className={cn(
                  'mb-4 rounded-xl border px-3 py-2.5',
                  isDarkTheme(theme) ? 'border-gray-700/80 bg-gray-900/40' : 'border-gray-200 bg-white/80',
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider mb-2',
                    isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500',
                  )}
                >
                  Requests
                </p>
                <div className="flex flex-wrap items-center gap-2">{requestActionNodes}</div>
              </div>
            )}
            <ProjectedCareerCard
              data={card}
              mode="employer"
              walletAddress={walletAddress}
              footerSlot={footerActions}
              onEmployerViewCompanyMvr={
                card.employerCompanyMvr?.orderId &&
                ['completed', 'needs_review'].includes(card.employerCompanyMvr.orderStatus)
                  ? () => setEmployerMvrViewOrderId(card.employerCompanyMvr!.orderId)
                  : undefined
              }
              onEmployerViewCompanyPsp={
                card.employerCompanyPsp?.orderId &&
                ['completed', 'needs_review'].includes(card.employerCompanyPsp.orderStatus)
                  ? () => setEmployerPspViewOrderId(card.employerCompanyPsp!.orderId)
                  : undefined
              }
            />
          </>
        )}
      </div>
    </Modal>
  )

  // ── Recruit sub-modal ─────────────────────────────────────────────────────

  const recruitModalContent = showRecruitModal ? (
    <Modal onClose={() => setShowRecruitModal(false)} maxWidth="max-w-md" zIndex={10001}>
      <ModalHeader
        title="Recruit Candidate"
        subtitle={`Select a job for ${card?.name || 'this candidate'}`}
        onClose={() => setShowRecruitModal(false)}
      />
      <div className="p-6 space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
            Select Job Posting *
          </label>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            </div>
          ) : jobPostings.length === 0 ? (
            <p className={`text-sm py-3 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
              No active job postings. Create one first.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {jobPostings.map(job => (
                <button
                  type="button"
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedJobId === job.id
                      ? isDarkTheme(theme) ? 'border-teal-500 bg-teal-500/10' : 'border-teal-500 bg-teal-50'
                      : isDarkTheme(theme) ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedJobId === job.id ? 'border-teal-500 bg-teal-500' : isDarkTheme(theme) ? 'border-gray-500' : 'border-gray-400'
                    }`}>
                      {selectedJobId === job.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className={isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}>{job.title}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
            Message to Candidate (optional)
          </label>
          <textarea
            value={recruitMessage}
            onChange={e => setRecruitMessage(e.target.value)}
            placeholder="Why you think they'd be a great fit..."
            rows={3}
            className={`w-full px-3 py-2 rounded-lg border resize-none ${
              isDarkTheme(theme) ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
        <div className={`p-3 rounded-lg text-sm ${isDarkTheme(theme) ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
          This will create an application for the candidate and notify them via email.
        </div>
      </div>
      <div className={`p-6 border-t ${isDarkTheme(theme) ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRecruitModal(false)}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={recruitCandidate}
            disabled={!selectedJobId || recruitLoading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              !selectedJobId ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {recruitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Invitation
          </button>
        </div>
      </div>
    </Modal>
  ) : null

  // ── MVR order sub-modal ──────────────────────────────────────────────────

  const accioOrderModalContent = showAccioOrderModal ? (
    <MvrOrderModal
      key={accioOrderProduct}
      orderProduct={accioOrderProduct}
      walletAddress={walletAddress}
      employerCompany={employerCompany}
      candidateName={card?.name}
      bgcheckConsentFormData={employerExtras?.bgcheckConsentFormData ?? null}
      pspFmcsaConsentFormData={employerExtras?.pspFmcsaConsentFormData ?? null}
      useStoredConsentOnly={Boolean(
        employerExtras?.installedEmployerBlocks?.includes('employer-screening-consent') &&
          employerExtras?.screeningConsentBundleId &&
          employerExtras?.completionFlags?.hasScreeningConsentBundle,
      )}
      loading={accioOrderLoading}
      error={accioOrderError}
      success={accioOrderProduct === 'mvr' ? mvrEmployerOrderDone : pspEmployerOrderDone}
      onOrder={handleAccioEmployerOrder}
      onClose={() => { setShowAccioOrderModal(false); setAccioOrderError(null) }}
      theme={theme}
    />
  ) : null

  return (
    <>
      {modalContent}
      {recruitModalContent}
      {accioOrderModalContent}
      {employerMvrViewOrderId && (
        <MvrViewModal
          isOpen
          onClose={() => setEmployerMvrViewOrderId(null)}
          walletAddress={walletAddress}
          orderId={employerMvrViewOrderId}
          employerCandidateUserId={candidateUserId}
        />
      )}
      {employerPspViewOrderId && (
        <PspViewModal
          isOpen
          onClose={() => setEmployerPspViewOrderId(null)}
          walletAddress={walletAddress}
          orderId={employerPspViewOrderId}
          employerCandidateUserId={candidateUserId}
        />
      )}
    </>
  )
}

// ── Types for MVR order form ─────────────────────────────────────────────────

interface MvrOrderFields {
  firstName: string
  lastName: string
  dob: string
  /** Full 9-digit SSN (digits only). Sent to Accio for direct identity match; never persisted in our DB. */
  ssn: string
  email: string
  dlNumber: string
  dlState: string
  address: string
  city: string
  state: string
  zip: string
}

// ── MvrOrderModal ────────────────────────────────────────────────────────────
// Full editable form pre-filled from the signed disclosure. Matches the
// candidate's MvrOrderForm layout so employers see the same fields.

function MvrOrderModal({
  orderProduct = 'mvr',
  walletAddress,
  employerCompany,
  candidateName,
  bgcheckConsentFormData,
  pspFmcsaConsentFormData,
  useStoredConsentOnly = false,
  loading,
  error,
  success,
  onOrder,
  onClose,
  theme,
}: {
  orderProduct?: 'mvr' | 'psp'
  walletAddress: string
  employerCompany: { id: string; walletAddress: string | null } | null
  candidateName?: string
  bgcheckConsentFormData: Record<string, unknown> | null
  pspFmcsaConsentFormData: Record<string, unknown> | null
  /** Identity + SSN already live in `screening_consent_bundles` — employer only pays here */
  useStoredConsentOnly?: boolean
  loading: boolean
  error: string | null
  success: boolean
  onOrder: (fields?: MvrOrderFields) => void
  onClose: () => void
  theme: string
}) {
  const consentSnapshot =
    orderProduct === 'psp' ? pspFmcsaConsentFormData : bgcheckConsentFormData
  const fd = consentSnapshot as {
    firstName?: string
    lastName?: string
    email?: string
    dateOfBirth?: string
    dlNumber?: string
    dlState?: string
    address?: string
    city?: string
    state?: string
    zip?: string
  } | null

  const [firstName, setFirstName] = useState(fd?.firstName || '')
  const [lastName, setLastName] = useState(fd?.lastName || '')
  const [email, setEmail] = useState(fd?.email || '')
  const [dob, setDob] = useState(fd?.dateOfBirth || '')
  const [ssn, setSsn] = useState('')
  const [dlNumber, setDlNumber] = useState(fd?.dlNumber || '')
  const [dlState, setDlState] = useState(fd?.dlState || '')
  const [address, setAddress] = useState(fd?.address || '')
  const [city, setCity] = useState(fd?.city || '')
  const [state, setState] = useState(fd?.state || '')
  const [zip, setZip] = useState(fd?.zip || '')

  const isFormValid = useStoredConsentOnly
    ? true
    : Boolean(
        firstName.trim() && lastName.trim() && email.trim() && dob.trim() &&
        isValidSsn(ssn) && dlNumber.trim() && dlState.trim() &&
        address.trim() && city.trim() && state.trim() && zip.trim()
      )

  const handleSubmitOrder = () => {
    if (useStoredConsentOnly) {
      onOrder()
      return
    }
    onOrder({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob.trim(),
      ssn: normalizeSsnDigits(ssn),
      email: email.trim(),
      dlNumber: dlNumber.trim(),
      dlState: dlState.trim().toUpperCase(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim(),
    })
  }

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
    isDarkTheme(theme)
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  }`

  const labelClass = `block text-xs font-medium mb-1 ${
    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  }`

  const productTitle = orderProduct === 'mvr' ? 'MVR' : 'PSP'

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10001}>
      <ModalHeader
        title={orderProduct === 'mvr' ? 'Order MVR' : 'Order PSP'}
        subtitle={candidateName || 'Candidate'}
        onClose={onClose}
      />

      {/* Success */}
      {success ? (
          <div className="p-8 text-center">
            <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${isDarkTheme(theme) ? 'text-green-400' : 'text-green-500'}`} />
            <h4 className={`text-lg font-semibold mb-1 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              {productTitle} order submitted
            </h4>
            <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
              {orderProduct === 'mvr'
                ? "Results will appear on the candidate's career card once processed."
                : 'This order is private to your company (FCRA). The candidate’s public card is not updated.'}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {useStoredConsentOnly ? (
              <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}`}>
                This candidate&apos;s FCRA disclosure, FMCSA PSP authorization, CDLIS written consent, and full identity
                are already on file from their screening consent package. Submit the order below — Storm will send
                it to the vendor using the stored package (no re-entry).
              </p>
            ) : (
              <>
            {/* Pre-fill notice */}
            {fd && (
              <p className={`text-xs ${isDarkTheme(theme) ? 'text-teal-400/70' : 'text-teal-600'}`}>
                {orderProduct === 'psp'
                  ? 'Pre-filled from signed FMCSA PSP disclosure — edit if needed'
                  : 'Pre-filled from signed disclosure — edit if needed'}
              </p>
            )}

            {/* Personal Information */}
            <div className={`rounded-xl border p-4 space-y-3 ${isDarkTheme(theme) ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'}`}>
                Personal Information
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" disabled={success} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" disabled={success} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" disabled={success} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={success} className={inputClass} />
                </div>
              </div>
              <div className="w-44">
                <label className={labelClass}>SSN *</label>
                <input
                  type="text" inputMode="numeric" autoComplete="off" maxLength={11}
                  value={formatSsnDisplay(ssn)} onChange={e => setSsn(normalizeSsnDigits(e.target.value))}
                  placeholder="123-45-6789" disabled={success}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Driver License */}
            <div className={`rounded-xl border p-4 space-y-3 ${isDarkTheme(theme) ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'}`}>
                Driver License
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>License Number *</label>
                  <input value={dlNumber} onChange={e => setDlNumber(e.target.value)} placeholder="12345678" disabled={success} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <input value={dlState} onChange={e => setDlState(e.target.value.toUpperCase())} placeholder="TX" maxLength={2} disabled={success} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className={`rounded-xl border p-4 space-y-3 ${isDarkTheme(theme) ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'}`}>
                Address
              </p>
              <div>
                <label className={labelClass}>Street *</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" disabled={success} className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>City *</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Houston" disabled={success} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <input value={state} onChange={e => setState(e.target.value.toUpperCase())} placeholder="TX" maxLength={2} disabled={success} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ZIP *</label>
                  <input value={zip} onChange={e => setZip(e.target.value)} placeholder="77001" maxLength={10} disabled={success} className={inputClass} />
                </div>
              </div>
            </div>
              </>
            )}

            {/* Status messages */}
            {error && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isDarkTheme(theme) ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {loading && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isDarkTheme(theme) ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting {productTitle} order...
              </div>
            )}

            <div className={`rounded-xl border p-4 ${isDarkTheme(theme) ? 'border-gray-800' : 'border-gray-200'}`}>
              <Button
                variant='primary'
                className='w-full'
                onClick={handleSubmitOrder}
                disabled={!isFormValid || loading}
                isLoading={loading}
              >
                Submit {productTitle} order
              </Button>
            </div>
          </div>
        )}
    </Modal>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────
// Employer-specific — not needed in self-view, so it stays here.

function ActionButton({
  label,
  loading,
  resendLoading,
  isPending,
  disabled,
  onClick,
  onResend,
  theme,
}: {
  label: string
  loading: boolean
  resendLoading: boolean
  isPending: boolean
  disabled?: boolean
  onClick: () => void
  onResend: () => void
  theme: string
}) {
  // When this step is done (disabled=true), show a muted "Sent ✓" pill
  if (disabled && !isPending) {
    return (
      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
        isDarkTheme(theme) ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400'
      }`}>
        <CheckCircle className="w-3 h-3" />
        {label}
      </div>
    )
  }

  if (isPending) {
    return (
      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
        isDarkTheme(theme) ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
      }`}>
        {resendLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
        <span>Pending</span>
        <span className="opacity-40 mx-0.5">·</span>
        <button
          onClick={onResend}
          disabled={resendLoading}
          className="underline underline-offset-2 hover:opacity-70 disabled:opacity-40 cursor-pointer"
        >
          {resendLoading ? 'Sending...' : 'Resend'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isDarkTheme(theme) ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
      }`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      {label}
    </button>
  )
}
