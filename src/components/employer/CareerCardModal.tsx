'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import {
  X,
  Loader2,
  AlertCircle,
  Car,
  Code,
  Send,
  UserPlus,
  CheckCircle,
  Clock,
  RefreshCw,
  FileText,
} from 'lucide-react'
import CareerCard, { type CareerCardData } from '@/components/CareerCard'
import Modal, { ModalHeader } from '@/components/ui/Modal'

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

  const [showMvrConfirm, setShowMvrConfirm] = useState(false)
  const [showMvrOrderForm, setShowMvrOrderForm] = useState(false)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [recruitMessage, setRecruitMessage] = useState('')
  const [recruitLoading, setRecruitLoading] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career card')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // ── Employer request helpers ──────────────────────────────────────────────

  const getPendingRequest = (type: string, documentType?: string) =>
    careerCard?.pendingRequests?.find(r =>
      r.request_type === type &&
      (documentType === undefined || r.document_type === documentType)
    ) || null

  const createRequest = async (requestType: string, documentType?: string) => {
    try {
      setRequestLoading(requestType)
      const response = await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ requestType, documentType, message: 'Requested via StormChain Talent Search' }),
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

  const resendRequest = async (requestType: string, documentType?: string) => {
    const pending = getPendingRequest(requestType, documentType)
    if (!pending) return
    try {
      setResendLoading(requestType)
      await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ requestId: pending.id }),
      })
      await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ requestType, documentType, message: 'Requested via StormChain Talent Search' }),
      })
      await fetchCareerCard()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend request')
    } finally {
      setResendLoading(null)
    }
  }

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

  if (!mounted) return null

  const isDriver = careerCard?.role === 'driver'

  // ── Action slots passed into CareerCard ───────────────────────────────────

  const resumeAction = !careerCard?.hasResume ? (
    <ActionButton
      label="Request Resume"
      loading={requestLoading === 'document_upload'}
      resendLoading={resendLoading === 'document_upload'}
      isPending={!!getPendingRequest('document_upload', 'resume')}
      onClick={() => createRequest('document_upload', 'resume')}
      onResend={() => resendRequest('document_upload', 'resume')}
      theme={theme}
    />
  ) : null

  const dotAppAction = !careerCard?.hasDriverApp ? (
    <ActionButton
      label="Request DOT App"
      loading={requestLoading === 'profile_completion'}
      resendLoading={resendLoading === 'profile_completion'}
      isPending={!!getPendingRequest('profile_completion', 'dot_application')}
      onClick={() => createRequest('profile_completion', 'dot_application')}
      onResend={() => resendRequest('profile_completion', 'dot_application')}
      theme={theme}
    />
  ) : null

  const mvrAction = !careerCard?.hasMvr ? (
    careerCard?.hasBgcheckConsent
      // Disclosure signed → employer can now order the MVR directly
      ? (
        <button
          onClick={() => setShowMvrOrderForm(true)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <Car className="w-3 h-3" />
          Order MVR
        </button>
      )
      // No disclosure yet → send request to driver to sign
      : (
        <ActionButton
          label="Request MVR"
          loading={requestLoading === 'mvr_order'}
          resendLoading={resendLoading === 'mvr_order'}
          isPending={!!getPendingRequest('mvr_order')}
          onClick={() => setShowMvrConfirm(true)}
          onResend={() => resendRequest('mvr_order')}
          theme={theme}
        />
      )
  ) : null

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-[10000] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white shadow-2xl'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDriver
                ? theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
                : theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
            }`}>
              {isDriver
                ? <Car className={theme === 'dark' ? 'text-teal-400' : 'text-teal-600'} />
                : <Code className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
              }
            </div>
            <div>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {loading ? 'Loading...' : careerCard?.name || 'Career Card'}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {loading ? 'Career Card' : isDriver ? 'Driver Career Card' : 'Developer Career Card'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh — lets employer manually sync if candidate updated their profile */}
            <button
              onClick={() => fetchCareerCard(true)}
              disabled={isRefreshing}
              title="Refresh"
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
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
              resumeAction={resumeAction}
              dotAppAction={dotAppAction}
              mvrAction={mvrAction}
              footerActions={footerActions}
            />
          )}
        </div>
      </div>
    </div>
  )

  // ── Recruit sub-modal ─────────────────────────────────────────────────────

  const recruitModalContent = showRecruitModal ? (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) setShowRecruitModal(false) }}
    >
      <div className="absolute inset-0 bg-black/70 pointer-events-none" />
      <div
        className={`relative z-[10002] w-full max-w-md rounded-2xl shadow-2xl ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                <UserPlus className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Recruit Candidate
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Select a job for {careerCard?.name || 'this candidate'}
                </p>
              </div>
            </div>
            <button onClick={() => setShowRecruitModal(false)} className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
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
                    onClick={e => { e.stopPropagation(); setSelectedJobId(job.id) }}
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
      </div>
    </div>
  ) : null

  // ── MVR order form modal ──────────────────────────────────────────────────
  // Shown when the driver has signed the disclosure and the employer is ready
  // to actually purchase the MVR. Pre-fills from careerCard profile data.
  // Employer can review and edit before submitting to Accio.

  // Modal.tsx handles its own portal — no need to wrap in createPortal
  const MvrOrderFormModal = showMvrOrderForm && careerCard
    ? <EmployerMvrOrderForm
        candidateUserId={candidateUserId}
        walletAddress={walletAddress}
        careerCard={careerCard}
        theme={theme}
        onClose={() => setShowMvrOrderForm(false)}
        onSuccess={() => { setShowMvrOrderForm(false); fetchCareerCard() }}
      />
    : null

  // ── MVR confirmation modal ────────────────────────────────────────────────
  // Shows driver details so the employer can verify they're sending to the right
  // person before the request (and background check disclosure) is dispatched.

  const mvrConfirmContent = showMvrConfirm && careerCard ? (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) setShowMvrConfirm(false) }}
    >
      <div className="absolute inset-0 bg-black/70 pointer-events-none" />
      <div
        className={`relative z-[10004] w-full max-w-sm rounded-2xl shadow-2xl ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Car className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Confirm MVR Request
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Review before sending
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>Driver</p>
            <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {careerCard.name}
            </p>
            {careerCard.profile?.cdl_class && (
              <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                CDL-{careerCard.profile.cdl_class}
                {careerCard.profile.cdl_state ? ` · ${careerCard.profile.cdl_state}` : ''}
              </p>
            )}
            {careerCard.location && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                {careerCard.location}
              </p>
            )}
            {careerCard.email && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                {careerCard.email}
              </p>
            )}
          </div>

          <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${
            theme === 'dark'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The driver will receive a background check disclosure form to sign.
              The MVR order is initiated after they authorize it.
            </span>
          </div>
        </div>

        <div className={`p-6 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex gap-3">
            <button
              onClick={() => setShowMvrConfirm(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowMvrConfirm(false); createRequest('mvr_order') }}
              disabled={requestLoading === 'mvr_order'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {requestLoading === 'mvr_order'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
              Send Request
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {createPortal(modalContent, document.body)}
      {recruitModalContent && createPortal(recruitModalContent, document.body)}
      {mvrConfirmContent && createPortal(mvrConfirmContent, document.body)}
      {MvrOrderFormModal}
    </>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────
// Employer-specific — not needed in self-view, so it stays here.

function ActionButton({
  label,
  loading,
  resendLoading,
  isPending,
  onClick,
  onResend,
  theme,
}: {
  label: string
  loading: boolean
  resendLoading: boolean
  isPending: boolean
  onClick: () => void
  onResend: () => void
  theme: string
}) {
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

// ── EmployerMvrOrderForm ──────────────────────────────────────────────────────
// Pre-fills driver data from the career card so the employer just needs to
// confirm (or correct) before submitting to Accio. No crypto payment — billed
// to the company account.

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

function EmployerMvrOrderForm({
  candidateUserId,
  walletAddress,
  careerCard,
  theme,
  onClose,
  onSuccess,
}: {
  candidateUserId: string
  walletAddress: string
  careerCard: CareerCardData
  theme: string
  onClose: () => void
  onSuccess: () => void
}) {
  const isDark = theme === 'dark'
  const profile = careerCard.profile

  // Pre-fill from career card — employer can edit any field before submitting
  const [form, setForm] = useState({
    firstName:  profile.fullName.split(' ')[0] ?? '',
    middleName: '',
    lastName:   profile.fullName.split(' ').slice(-1)[0] ?? '',
    email:      careerCard.email ?? '',
    phone:      careerCard.phone ?? '',
    dob:        '',
    ssn:        '',
    address:    '',
    city:       profile.city ?? '',
    state:      profile.state ?? '',
    zip:        '',
    dlNumber:   profile.cdl_number ?? '',
    dlState:    profile.cdl_state ?? profile.state ?? '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const isValid = Boolean(
    form.firstName && form.lastName && form.dob && form.ssn &&
    form.address && form.city && form.state && form.zip &&
    form.dlNumber && form.dlState
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/mvr/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ candidateUserId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to place order')
      setSuccess(true)
      setTimeout(onSuccess, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${
    isDark
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`

  const labelCls = `block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`

  if (success) {
    return (
      <Modal onClose={onSuccess} maxWidth="max-w-sm" zIndex={10005} disableBackdropClose>
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>MVR Order Submitted</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Results will appear in the driver's career card when ready.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10005}>
      <ModalHeader title="Order MVR" subtitle={careerCard.name} onClose={onClose} />

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Consent confirmed banner */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Background check disclosure signed — ready to order.
          </div>

          {/* Personal */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Personal Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input value={form.firstName} onChange={set('firstName')} placeholder="First" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input value={form.lastName} onChange={set('lastName')} placeholder="Last" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Middle Name</label>
                <input value={form.middleName} onChange={set('middleName')} placeholder="Optional" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date of Birth * (YYYY-MM-DD)</label>
                <input type="date" value={form.dob} onChange={set('dob')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>SSN Last 4 *</label>
                <input value={form.ssn} onChange={set('ssn')} maxLength={4} placeholder="####" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Address</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Street Address *</label>
                <input value={form.address} onChange={set('address')} placeholder="123 Main St" className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelCls}>City *</label>
                  <input value={form.city} onChange={set('city')} placeholder="City" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>State *</label>
                  <select value={form.state} onChange={set('state')} className={inputCls}>
                    <option value="">State</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ZIP *</label>
                  <input value={form.zip} onChange={set('zip')} placeholder="12345" maxLength={10} className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* License — highlight as critical: wrong DL = wrong report */}
          <div className={`rounded-xl border-2 p-4 ${isDark ? 'border-amber-500/40 bg-amber-500/5' : 'border-amber-300 bg-amber-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                Verify Driver's License — Critical
              </p>
            </div>
            <p className={`text-xs mb-3 ${isDark ? 'text-amber-300/70' : 'text-amber-700/80'}`}>
              An incorrect license number will return results for the wrong person. Confirm this matches the driver's physical license before ordering.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>DL Number *</label>
                <input
                  value={form.dlNumber}
                  onChange={set('dlNumber')}
                  placeholder="DL123456789"
                  className={`${inputCls} font-mono tracking-wide`}
                />
              </div>
              <div>
                <label className={labelCls}>DL Issuing State *</label>
                <select value={form.dlState} onChange={set('dlState')} className={inputCls}>
                  <option value="">State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
              {submitting ? 'Ordering…' : 'Place MVR Order'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
