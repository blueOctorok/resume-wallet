'use client'

import { useState, useEffect } from 'react'
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
import CareerCard, { type CareerCardData } from '@/components/CareerCard'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import MessagingButton from '@/components/messaging/MessagingButton'
import MvrPaymentButton from '@/components/MvrPaymentButton'
import { useUIStore } from '@/stores'
import { getRequestableBlocks, getBlockDefinition } from '@/lib/block-registry'

// Re-export for consumers that imported from here previously
export type { CareerCardData }

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
  const [careerCard, setCareerCard] = useState<CareerCardData | null>(null)
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

  const [showMvrOrderModal, setShowMvrOrderModal] = useState(false)
  const [mvrOrderLoading, setMvrOrderLoading] = useState(false)
  const [mvrOrderError, setMvrOrderError] = useState<string | null>(null)
  const [mvrOrderSuccess, setMvrOrderSuccess] = useState(false)

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

      const response = await fetch(`/api/employer/talent/${candidateUserId}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load career card')
      }

      const data = await response.json()
      setCareerCard(data.careerCard)
      setEmployerCompany(data.employerCompany ?? null)
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

  const requestBlockById = async (blockType: string) => {
    try {
      setRequestLoading(blockType)
      const response = await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          requestType: 'block_request',
          targetBlockType: blockType,
          message: 'Requested via StormChain Talent Search',
        }),
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
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ requestId: pending.id }),
      })
      await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          requestType: 'block_request',
          targetBlockType: blockType,
          message: 'Requested via StormChain Talent Search',
        }),
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
    careerCard?.pendingRequests?.find(r =>
      // New style: block_request with target_block_type stored in data
      (r.target_block_type === blockType) ||
      // Legacy compat: old request types
      (blockType === 'driver-resume' && r.request_type === 'document_upload' && r.document_type === 'resume') ||
      (blockType === 'driver-mvr' && r.request_type === 'mvr_order') ||
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
      const response = await fetch('/api/employer/jobs', {
        headers: { 'x-wallet-address': walletAddress },
      })
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
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ jobPostingId: selectedJobId, message: recruitMessage || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create application')
      alert(`Application created! ${careerCard?.name || 'The candidate'} has been notified.`)
      setShowRecruitModal(false)
      await fetchCareerCard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to recruit candidate')
    } finally {
      setRecruitLoading(false)
    }
  }

  // ── MVR order (payment → API call) ─────────────────────────────────────────

  const handleMvrOrder = async (txHash: string, fields: MvrOrderFields) => {
    setMvrOrderLoading(true)
    setMvrOrderError(null)

    try {
      const response = await fetch('/api/employer/mvr/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          candidateUserId,
          paymentTxHash: txHash,
          ...fields,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to place MVR order')
      }

      setMvrOrderSuccess(true)
      await fetchCareerCard()
    } catch (err) {
      setMvrOrderError(err instanceof Error ? err.message : 'Failed to place MVR order')
    } finally {
      setMvrOrderLoading(false)
    }
  }

  // ── Registry-driven action slots ────────────────────────────────────────
  // Every block with employerRequestable: true gets a "Request {label}" button
  // automatically. No manual wiring needed when a new block is added.

  const requestableBlocks = getRequestableBlocks()

  /** Build an action node for a requestable block — returns null if not applicable */
  const buildBlockAction = (blockId: string): React.ReactNode => {
    const def = getBlockDefinition(blockId)
    if (!def?.employerRequestable) return null

    // Only show if candidate has the block installed
    const installed = careerCard?.installedBlockTypes?.includes(blockId)
    if (!installed) return null

    // Hide if the block's deliverable is already complete
    if (def.completionField) {
      const complete = (careerCard as Record<string, unknown>)?.[def.completionField]
      if (complete) return null
    }

    // MVR has extra "Order MVR" button alongside the standard request
    if (blockId === 'driver-mvr' && careerCard?.companyMvr) return null

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

    // MVR special case: add the paid "Order MVR" button
    if (blockId === 'driver-mvr') {
      const consentReady = careerCard?.hasBgcheckConsent === true
      return (
        <div className="flex items-center gap-2">
          {actionButton}
          <button
            onClick={() => setShowMvrOrderModal(true)}
            disabled={!consentReady || mvrOrderSuccess}
            title={consentReady ? 'Order MVR' : 'Waiting for candidate to sign disclosure'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mvrOrderSuccess
                ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
                : consentReady
                  ? theme === 'dark'
                    ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 cursor-pointer'
                    : 'bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer'
                  : theme === 'dark'
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {mvrOrderSuccess ? (
              <><CheckCircle className="w-3 h-3" /> Ordered</>
            ) : (
              <><CreditCard className="w-3 h-3" /> Order MVR</>
            )}
          </button>
        </div>
      )
    }

    return actionButton
  }

  // Map block IDs → CareerCard's named action props.
  // CareerCard uses named slots; this bridge keeps both sides clean.
  const BLOCK_TO_SLOT: Record<string, 'resumeAction' | 'mvrAction' | 'dotAppAction'> = {
    'driver-resume': 'resumeAction',
    'developer-resume': 'resumeAction',
    'general-resume': 'resumeAction',
    'driver-mvr': 'mvrAction',
    'driver-dot-application': 'dotAppAction',
  }

  const actionSlots: Record<string, React.ReactNode> = {}
  for (const block of requestableBlocks) {
    const slotName = BLOCK_TO_SLOT[block.id]
    if (slotName) {
      actionSlots[slotName] = actionSlots[slotName] ?? buildBlockAction(block.id)
    }
  }

  const resumeAction = actionSlots.resumeAction ?? null
  const mvrAction = actionSlots.mvrAction ?? null
  const dotAppAction = actionSlots.dotAppAction ?? null

  // Messaging is available once there's an existing application or pending request
  const messagingContext = careerCard?.existingApplication?.id
    ? { applicationId: careerCard.existingApplication.id }
    : careerCard?.pendingRequests?.[0]?.id
      ? { candidateRequestId: careerCard.pendingRequests[0].id }
      : null

  const footerActions = (
    <>
      {careerCard?.existingApplication ? (
        <span className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
          theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700'
        }`}>
          <CheckCircle className="w-4 h-4" />
          Already Applied ({careerCard.existingApplication.status})
        </span>
      ) : (
        <button
          onClick={openRecruitModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Recruit Candidate
        </button>
      )}

      {/* Message button — only visible once a relationship exists */}
      {messagingContext && careerCard && (
        <MessagingButton
          otherUserId={candidateUserId}
          {...messagingContext}
          subject={`Re: ${careerCard.name}`}
          walletAddress={walletAddress}
          onThreadOpen={(threadId) => {
            onClose()
            navigateToMessages(threadId)
          }}
        />
      )}

      {careerCard?.pendingRequests && careerCard.pendingRequests.length > 0 && (
        <span className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
          theme === 'dark' ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
        }`}>
          <Clock className="w-4 h-4" />
          {careerCard.pendingRequests.length} pending request{careerCard.pendingRequests.length !== 1 ? 's' : ''}
        </span>
      )}
    </>
  )

  // ── Modal shell ───────────────────────────────────────────────────────────

  const modalContent = (
    <Modal onClose={onClose} maxWidth="max-w-4xl" zIndex={9999}>
      {/* Custom header with avatar + refresh (not using ModalHeader because of Avatar) */}
      <div
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5 border-b',
          'backdrop-blur-md border-gray-200/90 dark:border-gray-700/80',
          theme === 'dark'
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
              theme === 'dark' ? 'ring-teal-400/40 ring-offset-gray-950' : 'ring-teal-500/30 ring-offset-white',
            )}
          >
            <Avatar
              name={careerCard?.name || '?'}
              avatarUrl={careerCard?.avatarUrl}
              size="md"
              color="teal"
            />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.18em] mb-0.5',
                theme === 'dark' ? 'text-teal-400/80' : 'text-teal-700/80',
              )}
            >
              Talent · Career card
            </p>
            <h3
              className={cn(
                'font-bold text-lg tracking-tight truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900',
              )}
            >
              {loading ? 'Loading…' : careerCard?.name || 'Career card'}
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
          theme === 'dark' ? 'bg-gray-950/40' : 'bg-slate-50/40',
        )}
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-10 h-10 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
        )}
        {error && (
          <div className={`p-6 rounded-xl text-center ${theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertCircle className="w-10 h-10 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && careerCard && (
          <CareerCard
            data={careerCard}
            walletAddress={walletAddress}
            resumeAction={resumeAction}
            mvrAction={mvrAction}
            dotAppAction={dotAppAction}
            footerActions={footerActions}
          />
        )}
      </div>
    </Modal>
  )

  // ── Recruit sub-modal ─────────────────────────────────────────────────────

  const recruitModalContent = showRecruitModal ? (
    <Modal onClose={() => setShowRecruitModal(false)} maxWidth="max-w-md" zIndex={10001}>
      <ModalHeader
        title="Recruit Candidate"
        subtitle={`Select a job for ${careerCard?.name || 'this candidate'}`}
        onClose={() => setShowRecruitModal(false)}
      />
      <div className="p-6 space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Select Job Posting *
          </label>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            </div>
          ) : jobPostings.length === 0 ? (
            <p className={`text-sm py-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
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
                      ? theme === 'dark' ? 'border-teal-500 bg-teal-500/10' : 'border-teal-500 bg-teal-50'
                      : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedJobId === job.id ? 'border-teal-500 bg-teal-500' : theme === 'dark' ? 'border-gray-500' : 'border-gray-400'
                    }`}>
                      {selectedJobId === job.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{job.title}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Message to Candidate (optional)
          </label>
          <textarea
            value={recruitMessage}
            onChange={e => setRecruitMessage(e.target.value)}
            placeholder="Why you think they'd be a great fit..."
            rows={3}
            className={`w-full px-3 py-2 rounded-lg border resize-none ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
        <div className={`p-3 rounded-lg text-sm ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
          This will create an application for the candidate and notify them via email.
        </div>
      </div>
      <div className={`p-6 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRecruitModal(false)}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

  const mvrOrderModalContent = showMvrOrderModal ? (
    <MvrOrderModal
      candidateUserId={candidateUserId}
      walletAddress={walletAddress}
      careerCard={careerCard}
      loading={mvrOrderLoading}
      error={mvrOrderError}
      success={mvrOrderSuccess}
      onOrder={handleMvrOrder}
      onClose={() => { setShowMvrOrderModal(false); setMvrOrderError(null) }}
      theme={theme}
    />
  ) : null

  return (
    <>
      {modalContent}
      {recruitModalContent}
      {mvrOrderModalContent}
    </>
  )
}

// ── Types for MVR order form ─────────────────────────────────────────────────

interface MvrOrderFields {
  firstName: string
  lastName: string
  dob: string
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
  walletAddress,
  careerCard,
  loading,
  error,
  success,
  onOrder,
  onClose,
  theme,
}: {
  candidateUserId: string
  walletAddress: string
  careerCard: CareerCardData | null
  loading: boolean
  error: string | null
  success: boolean
  onOrder: (txHash: string, fields: MvrOrderFields) => void
  onClose: () => void
  theme: string
}) {
  const fd = careerCard?.bgcheckConsentFormData

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

  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null)
  const isPaymentComplete = !!paymentTxHash

  const isFormValid = Boolean(
    firstName.trim() && lastName.trim() && email.trim() && dob.trim() &&
    ssn.trim() && dlNumber.trim() && dlState.trim() &&
    address.trim() && city.trim() && state.trim() && zip.trim()
  )

  const handlePaymentSuccess = (txHash: string) => {
    setPaymentTxHash(txHash)
    onOrder(txHash, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob.trim(),
      ssn: ssn.trim(),
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
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  }`

  const labelClass = `block text-xs font-medium mb-1 ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10001}>
      <ModalHeader
        title="Order MVR"
        subtitle={careerCard?.name || 'Candidate'}
        onClose={onClose}
      />

      {/* Success */}
      {success ? (
          <div className="p-8 text-center">
            <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} />
            <h4 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              MVR Order Submitted
            </h4>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Results will appear on the candidate&apos;s career card once processed.
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
            {/* Pre-fill notice */}
            {fd && (
              <p className={`text-xs ${theme === 'dark' ? 'text-teal-400/70' : 'text-teal-600'}`}>
                Pre-filled from signed disclosure — edit if needed
              </p>
            )}

            {/* Personal Information */}
            <div className={`rounded-xl border p-4 space-y-3 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
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
              <div className="w-32">
                <label className={labelClass}>SSN (last 4) *</label>
                <input
                  type="text" inputMode="numeric" maxLength={4}
                  value={ssn} onChange={e => setSsn(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000" disabled={success}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Driver License */}
            <div className={`rounded-xl border p-4 space-y-3 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
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
            <div className={`rounded-xl border p-4 space-y-3 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
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

            {/* Status messages */}
            {error && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {loading && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${theme === 'dark' ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting MVR order...
              </div>
            )}

            {/* Payment */}
            <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                Payment
              </p>
              {isPaymentComplete ? (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                  <CheckCircle className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>Payment confirmed</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {!isFormValid && (
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      Fill out all required fields to enable payment
                    </p>
                  )}
                  <MvrPaymentButton
                    userAddress={walletAddress}
                    payFromCompanyWallet={Boolean(employerCompany?.walletAddress)}
                    companyWalletAddress={employerCompany?.walletAddress ?? undefined}
                    companyId={employerCompany?.id}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={(msg) => console.error('[MVR PAYMENT]', msg)}
                    disabled={!isFormValid || loading}
                    userType="employer"
                  />
                </div>
              )}
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
        theme === 'dark' ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400'
      }`}>
        <CheckCircle className="w-3 h-3" />
        {label}
      </div>
    )
  }

  if (isPending) {
    return (
      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
        theme === 'dark' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
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
        theme === 'dark' ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
      }`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      {label}
    </button>
  )
}
