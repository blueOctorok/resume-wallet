'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import {
  X,
  Loader2,
  AlertCircle,
  Send,
  UserPlus,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import CareerCard, { type CareerCardData } from '@/components/CareerCard'
import Avatar from '@/components/ui/Avatar'
import MessagingButton from '@/components/messaging/MessagingButton'
import { useUIStore } from '@/stores'

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
            <Avatar
              name={careerCard?.name || '?'}
              avatarUrl={careerCard?.avatarUrl}
              size="md"
              color="teal"
            />
            <div>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {loading ? 'Loading...' : careerCard?.name || 'Career Card'}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Career Card
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
              walletAddress={walletAddress}
              resumeAction={resumeAction}
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

  return (
    <>
      {createPortal(modalContent, document.body)}
      {recruitModalContent && createPortal(recruitModalContent, document.body)}
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
