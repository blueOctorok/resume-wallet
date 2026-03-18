'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import {
  ClipboardCheck,
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  Trash2,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import VerificationStatusBadge from './VerificationStatusBadge'
import {
  VerificationRequest,
  VerificationStatus,
} from '@/types/employment-verification'

/** Employment entry from block_driver_employment (DOT forms / resume prefill only) */
interface EmploymentEntry {
  id: string
  companyName: string
  position: string
  startDate: string
  endDate?: string | null
  location?: string
  supervisorName?: string
  supervisorEmail?: string
  supervisorPhone?: string
  reasonForLeaving?: string
}

interface DriverEmploymentVerificationSectionProps {
  userAddress: string | null
}

/**
 * Driver-only employment verification section.
 * Data: block_driver_employment (DOT forms / resume prefill). No developer data.
 * Verify: /api/driver/verification/initiate-self and /api/driver/verification/status only.
 */
export default function DriverEmploymentVerificationSection({
  userAddress,
}: DriverEmploymentVerificationSectionProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employments, setEmployments] = useState<EmploymentEntry[]>([])
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([])
  const [initiatingId, setInitiatingId] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState<EmploymentEntry | null>(null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<EmploymentEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshingFromResume, setRefreshingFromResume] = useState(false)

  const fetchData = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const [profileRes, verificationRes] = await Promise.all([
        fetch('/api/driver/profile', { headers: { 'x-wallet-address': userAddress } }),
        fetch('/api/driver/verification/status?initiatedBy=applicant', {
          headers: { 'x-wallet-address': userAddress },
        }),
      ])
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setEmployments(profileData.profile?.employmentHistory ?? [])
      }
      if (verificationRes.ok) {
        const verificationData = await verificationRes.json()
        setVerificationRequests(verificationData.requests ?? [])
      }
    } catch (err) {
      console.error('Error fetching driver verification data:', err)
      setError('Failed to load employment history')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getVerificationForEmployment = (employmentId: string) =>
    verificationRequests.find(
      (r) => r.employmentId === employmentId && r.initiatedBy === 'applicant'
    )

  const initiateVerification = async (
    employment: EmploymentEntry,
    overrideEmail?: string,
    overridePhone?: string
  ) => {
    if (!userAddress) return
    setInitiatingId(employment.id)
    try {
      const response = await fetch('/api/driver/verification/initiate-self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          employmentId: employment.id,
          previousEmployerEmail: overrideEmail ?? employment.supervisorEmail,
          previousEmployerPhone: overridePhone ?? employment.supervisorPhone,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        fetchData()
        setShowContactModal(null)
        setContactEmail('')
        setContactPhone('')
      } else if (data.needsContactInfo) {
        setShowContactModal(employment)
      } else {
        alert(data.error ?? 'Failed to request verification')
      }
    } catch (err) {
      console.error('Error initiating verification:', err)
      alert('Failed to request verification')
    } finally {
      setInitiatingId(null)
    }
  }

  const handleContactSubmit = () => {
    if (showContactModal && (contactEmail || contactPhone)) {
      initiateVerification(showContactModal, contactEmail, contactPhone)
    }
  }

  const removeEmployment = async (employment: EmploymentEntry) => {
    if (!userAddress) return
    setDeletingId(employment.id)
    try {
      const res = await fetch('/api/driver/profile/employment', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({ employmentId: employment.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setDeleteConfirm(null)
        fetchData()
      } else {
        alert(data.error ?? 'Failed to remove employment')
      }
    } catch (err) {
      console.error('Error removing employment:', err)
      alert('Failed to remove employment')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Present'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2
            className={`w-6 h-6 animate-spin ${
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-red-900/20 border border-red-500/30'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      </div>
    )
  }

  if (employments.length === 0) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'
            }`}
          >
            <ClipboardCheck
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
              }`}
            />
          </div>
          <h3
            className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Employment Verification
          </h3>
        </div>
        <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Employment here is pulled from your resume or DOT application. Upload a resume and
          we&apos;ll extract your jobs, or complete your DOT application—then you can request
          verification from past employers to strengthen your career card.
        </p>
        <button
          type="button"
          onClick={() => {
            setRefreshingFromResume(true)
            fetchData().finally(() => setRefreshingFromResume(false))
          }}
          disabled={refreshingFromResume}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {refreshingFromResume ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ClipboardCheck className="w-4 h-4" />
          )}
          <span>{refreshingFromResume ? 'Checking…' : 'Check resume for employers'}</span>
        </button>
      </div>
    )
  }

  const verifiedCount = verificationRequests.filter(
    (r) => r.status === 'VERIFIED' || r.status === 'PARTIALLY_VERIFIED'
  ).length
  const pendingCount = verificationRequests.filter(
    (r) =>
      r.status === 'VERIFICATION_REQUESTED' || r.status === 'VERIFICATION_IN_PROGRESS'
  ).length
  const notRequestedCount = employments.filter(
    (e) => !getVerificationForEmployment(e.id)
  ).length

  return (
    <>
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'
              }`}
            >
              <ClipboardCheck
                className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                }`}
              />
            </div>
            <div>
              <h3
                className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Employment Verification
              </h3>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Verify your employment to strengthen your career card
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Refresh verification status"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div
            className={`rounded-xl p-3 text-center ${
              theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                theme === 'dark' ? 'text-green-300' : 'text-green-700'
              }`}
            >
              {verifiedCount}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
              Verified
            </p>
          </div>
          <div
            className={`rounded-xl p-3 text-center ${
              theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
              }`}
            >
              {pendingCount}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Pending
            </p>
          </div>
          <div
            className={`rounded-xl p-3 text-center ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {notRequestedCount}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Not Requested
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {employments.map((employment) => {
            const verification = getVerificationForEmployment(employment.id)
            const status: VerificationStatus | 'NOT_REQUESTED' =
              verification?.status ?? 'NOT_REQUESTED'
            const isVerified =
              status === 'VERIFIED' || status === 'PARTIALLY_VERIFIED'
            const isPending =
              status === 'VERIFICATION_REQUESTED' ||
              status === 'VERIFICATION_IN_PROGRESS'
            const canRequest =
              status === 'NOT_REQUESTED' ||
              status === 'ATTEMPTS_EXHAUSTED' ||
              status === 'VERIFICATION_DENIED' ||
              status === 'VERIFICATION_DECLINED'
            const isInitiating = initiatingId === employment.id

            return (
              <div
                key={employment.id}
                className={`rounded-xl p-4 ${
                  theme === 'dark'
                    ? 'bg-gray-800/50 border border-gray-700/50'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2
                        className={`w-4 h-4 flex-shrink-0 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      />
                      <p
                        className={`font-medium truncate ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {employment.companyName}
                      </p>
                    </div>
                    <p
                      className={`text-sm mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {employment.position}
                    </p>
                    <div className="flex items-center gap-1">
                      <Calendar
                        className={`w-3 h-3 ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {formatDate(employment.startDate)} -{' '}
                        {formatDate(employment.endDate)}
                      </span>
                    </div>
                    {verification?.verifiedAt && (
                      <p
                        className={`text-xs mt-1 ${
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        }`}
                      >
                        Verified {formatDate(verification.verifiedAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isVerified && (
                      <div className="flex items-center gap-1 text-green-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    )}
                    {isPending && (
                      <VerificationStatusBadge
                        status={status as VerificationStatus}
                        size="sm"
                        theme={theme}
                      />
                    )}
                    {canRequest && (
                      <button
                        onClick={() => initiateVerification(employment)}
                        disabled={isInitiating}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          theme === 'dark'
                            ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isInitiating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Verify</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(employment)}
                      disabled={deletingId === employment.id}
                      className={`p-1.5 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                          : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                      } disabled:opacity-50`}
                      title="Remove from list"
                    >
                      {deletingId === employment.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p
          className={`mt-4 text-xs ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          Click &quot;Verify&quot; to send a verification request to your previous employer.
          Verified employment shows as a trust badge on your career card.
        </p>
      </div>

      {showContactModal && (
        <Modal onClose={() => {
          setShowContactModal(null)
          setContactEmail('')
          setContactPhone('')
        }} maxWidth="max-w-md">
          <ModalHeader
            title="Contact Information Needed"
            onClose={() => {
              setShowContactModal(null)
              setContactEmail('')
              setContactPhone('')
            }}
          />
          <div className="p-4 sm:p-6">
            <p
              className={`text-sm mb-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              To verify your employment at <strong>{showContactModal.companyName}</strong>, we
              need contact information for someone who can confirm your work history (e.g.,
              supervisor, HR).
            </p>
            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <Mail className="w-4 h-4 inline mr-1" />
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="supervisor@company.com"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <Phone className="w-4 h-4 inline mr-1" />
                  Contact Phone (optional)
                </label>
                <PhoneInput
                  value={contactPhone}
                  onChange={setContactPhone}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowContactModal(null)
                  setContactEmail('')
                  setContactPhone('')
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleContactSubmit}
                disabled={!contactEmail && !contactPhone}
                className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Send Verification
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)} maxWidth="max-w-md">
          <ModalHeader title="Remove employment?" onClose={() => setDeleteConfirm(null)} />
          <div className="p-4 sm:p-6">
            <p
              className={`text-sm mb-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Remove <strong>{deleteConfirm.companyName}</strong> from your employment list?
              This only removes it from verification; it does not change your DOT application or
              resume.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeEmployment(deleteConfirm)}
                disabled={deletingId !== null}
                className="flex-1 py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
