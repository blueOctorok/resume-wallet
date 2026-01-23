'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ClipboardCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  User,
  Calendar,
  Eye,
  X,
  Send,
  Phone,
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import VerificationStatusBadge from './VerificationStatusBadge'
import { 
  EmployerVerificationSummary, 
  VerificationRequest,
  VerificationAttempt,
} from '@/types/employment-verification'

interface EmployerVerificationSectionProps {
  userAddress: string | null
  onInitiateVerification?: (driverId: string, employmentId: string) => void
}

export default function EmployerVerificationSection({ 
  userAddress,
  onInitiateVerification 
}: EmployerVerificationSectionProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<EmployerVerificationSummary | null>(null)
  const [hasCompany, setHasCompany] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [sendingAttempt, setSendingAttempt] = useState(false)

  const fetchVerificationStatus = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/verification/status?role=employer', {
        headers: { 'x-wallet-address': userAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch verification status')
      }

      const data = await response.json()
      setSummary(data.summary)
      setHasCompany(data.hasCompany)
    } catch (err) {
      console.error('Error fetching verification status:', err)
      setError('Failed to load verification status')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchVerificationStatus()
  }, [fetchVerificationStatus])

  const fetchRequestDetails = async (requestId: string) => {
    if (!userAddress) return

    try {
      setLoadingDetails(true)
      const response = await fetch(`/api/verification/status?role=employer&requestId=${requestId}`, {
        headers: { 'x-wallet-address': userAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch request details')
      }

      const data = await response.json()
      setSelectedRequest(data.verificationRequest)
      setAttempts(data.attempts || [])
    } catch (err) {
      console.error('Error fetching request details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const sendAttempt = async (requestId: string, method: 'email' | 'phone') => {
    if (!userAddress || sendingAttempt) return

    try {
      setSendingAttempt(true)
      const response = await fetch('/api/verification/attempt', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          requestId,
          method,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send attempt')
      }

      // Refresh data
      await fetchVerificationStatus()
      if (selectedRequest?.id === requestId) {
        await fetchRequestDetails(requestId)
      }
    } catch (err) {
      console.error('Error sending attempt:', err)
      alert(err instanceof Error ? err.message : 'Failed to send attempt')
    } finally {
      setSendingAttempt(false)
    }
  }

  const markExhausted = async (requestId: string) => {
    if (!userAddress) return

    try {
      const response = await fetch('/api/verification/attempt', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          requestId,
          markExhausted: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark as exhausted')
      }

      // Refresh data
      await fetchVerificationStatus()
      setSelectedRequest(null)
    } catch (err) {
      console.error('Error marking exhausted:', err)
      alert(err instanceof Error ? err.message : 'Failed to mark as exhausted')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
          : 'bg-white border border-brand-sage/20 shadow-lg'
      }`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className={`w-6 h-6 animate-spin ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-2xl p-6 ${
        theme === 'dark'
          ? 'bg-red-900/20 border border-red-500/30'
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
            {error}
          </span>
        </div>
      </div>
    )
  }

  if (!hasCompany) {
    return (
      <div className={`rounded-2xl p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
          : 'bg-white border border-brand-sage/20 shadow-lg'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <ClipboardCheck className={`w-5 h-5 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`} />
          <h3 className={`font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Employment Verification
          </h3>
        </div>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Set up your company profile to verify driver employment history.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={`rounded-2xl p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
          : 'bg-white border border-brand-sage/20 shadow-lg'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-brand-mint/20' : 'bg-brand-sage/10'
            }`}>
              <ClipboardCheck className={`w-5 h-5 ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`} />
            </div>
            <div>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Employment Verification
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Verify driver employment history with previous employers
              </p>
            </div>
          </div>
          <button
            onClick={fetchVerificationStatus}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`} />
          </button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatBox
              label="Total Requests"
              value={summary.totalRequested}
              color="blue"
              theme={theme}
            />
            <StatBox
              label="Pending Response"
              value={summary.pendingResponse}
              color="yellow"
              theme={theme}
            />
            <StatBox
              label="Verified"
              value={summary.verified}
              color="green"
              theme={theme}
            />
            <StatBox
              label="No Response"
              value={summary.attemptsExhausted}
              color="orange"
              theme={theme}
            />
          </div>
        )}

        {/* Verification Requests */}
        {summary && summary.requests.length > 0 ? (
          <div className="space-y-2">
            <h4 className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Verification Requests
            </h4>
            {summary.requests.slice(0, 10).map((req) => (
              <div
                key={req.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  theme === 'dark'
                    ? 'bg-gray-800/50 hover:bg-gray-800'
                    : 'bg-gray-50 hover:bg-gray-100'
                } cursor-pointer transition-colors`}
                onClick={() => fetchRequestDetails(req.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <User className={`w-5 h-5 flex-shrink-0 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(req as any).driverName || 'Unknown Driver'}
                    </p>
                    <p className={`text-sm truncate ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {req.previousEmployerName} • {req.claimedPosition}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <VerificationStatusBadge
                    status={req.status}
                    attemptCount={req.attemptCount}
                    size="sm"
                    theme={theme}
                  />
                  <ChevronRight className={`w-4 h-4 ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-8 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No verification requests yet</p>
            <p className="text-sm mt-1">
              Start by reviewing a driver's profile and verifying their employment
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <EmployerVerificationDetailModal
          request={selectedRequest}
          attempts={attempts}
          loading={loadingDetails}
          sending={sendingAttempt}
          theme={theme}
          onClose={() => {
            setSelectedRequest(null)
            setAttempts([])
          }}
          onSendAttempt={sendAttempt}
          onMarkExhausted={markExhausted}
        />
      )}
    </>
  )
}

// Stat box component
function StatBox({ 
  label, 
  value, 
  color, 
  theme 
}: { 
  label: string
  value: number
  color: 'blue' | 'yellow' | 'green' | 'orange'
  theme: string
}) {
  const colorClasses = {
    blue: {
      bg: theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50',
      text: theme === 'dark' ? 'text-blue-400' : 'text-blue-700',
      value: theme === 'dark' ? 'text-blue-300' : 'text-blue-800',
    },
    yellow: {
      bg: theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50',
      text: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700',
      value: theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800',
    },
    green: {
      bg: theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50',
      text: theme === 'dark' ? 'text-green-400' : 'text-green-700',
      value: theme === 'dark' ? 'text-green-300' : 'text-green-800',
    },
    orange: {
      bg: theme === 'dark' ? 'bg-orange-900/20' : 'bg-orange-50',
      text: theme === 'dark' ? 'text-orange-400' : 'text-orange-700',
      value: theme === 'dark' ? 'text-orange-300' : 'text-orange-800',
    },
  }

  const classes = colorClasses[color]

  return (
    <div className={`rounded-xl p-3 text-center ${classes.bg}`}>
      <p className={`text-2xl font-bold ${classes.value}`}>{value}</p>
      <p className={`text-xs ${classes.text}`}>{label}</p>
    </div>
  )
}

// Employer detail modal - includes action buttons
function EmployerVerificationDetailModal({
  request,
  attempts,
  loading,
  sending,
  theme,
  onClose,
  onSendAttempt,
  onMarkExhausted,
}: {
  request: VerificationRequest
  attempts: VerificationAttempt[]
  loading: boolean
  sending: boolean
  theme: string
  onClose: () => void
  onSendAttempt: (requestId: string, method: 'email' | 'phone') => Promise<void>
  onMarkExhausted: (requestId: string) => Promise<void>
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const canSendAttempt = ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(request.status) && request.attemptCount < 3
  const canMarkExhausted = request.status === 'VERIFICATION_IN_PROGRESS' && request.attemptCount >= 3
  const isFinalized = ['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'ATTEMPTS_EXHAUSTED', 'VERIFICATION_DECLINED'].includes(request.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl ${
        theme === 'dark'
          ? 'bg-gray-900 border border-gray-700'
          : 'bg-white shadow-xl'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Verification Request
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3">
              <VerificationStatusBadge status={request.status} attemptCount={request.attemptCount} size="lg" theme={theme} />
            </div>

            {/* Driver & Employment Details */}
            <div>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Driver's Claimed Employment
              </h4>
              <div className={`rounded-xl p-4 ${
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              }`}>
                <p className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {request.previousEmployerName}
                </p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Position: {request.claimedPosition}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {formatDate(request.claimedStartDate)} - {formatDate(request.claimedEndDate)}
                  </span>
                </div>
                {request.claimedReasonForLeaving && (
                  <p className={`text-sm mt-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Reason for leaving: {request.claimedReasonForLeaving}
                  </p>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Previous Employer Contact
              </h4>
              <div className="space-y-2">
                {request.previousEmployerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      {request.previousEmployerEmail}
                    </span>
                  </div>
                )}
                {request.previousEmployerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      {request.previousEmployerPhone}
                    </span>
                  </div>
                )}
                {!request.previousEmployerEmail && !request.previousEmployerPhone && (
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    No contact information available
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons - only for in-progress requests */}
            {!isFinalized && (
              <div>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Actions ({request.attemptCount}/3 attempts made)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {canSendAttempt && request.previousEmployerEmail && (
                    <button
                      onClick={() => onSendAttempt(request.id, 'email')}
                      disabled={sending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                        theme === 'dark'
                          ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                          : 'bg-brand-sage text-white hover:bg-brand-sage/90'
                      } disabled:opacity-50`}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Send Email
                    </button>
                  )}
                  {canSendAttempt && request.previousEmployerPhone && (
                    <button
                      onClick={() => onSendAttempt(request.id, 'phone')}
                      disabled={sending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                        theme === 'dark'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      } disabled:opacity-50`}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      Record Phone Call
                    </button>
                  )}
                  {canMarkExhausted && (
                    <button
                      onClick={() => {
                        if (confirm('Mark this verification as exhausted? This cannot be undone.')) {
                          onMarkExhausted(request.id)
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                        theme === 'dark'
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Mark as No Response
                    </button>
                  )}
                </div>
                {canSendAttempt && (
                  <p className={`text-xs mt-2 ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {3 - request.attemptCount} attempt{3 - request.attemptCount !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            )}

            {/* Verification Results (if verified) */}
            {request.answers && (
              <div>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Verification Results
                </h4>
                <div className={`rounded-xl p-4 space-y-3 ${
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                }`}>
                  {request.verifiedByName && (
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Verified by: {request.verifiedByName} {request.verifiedByTitle && `(${request.verifiedByTitle})`}
                    </p>
                  )}
                  <div className="space-y-2">
                    <AnswerRow
                      label="Employment dates correct"
                      value={request.answers.datesCorrect}
                      theme={theme}
                      goodValue="yes"
                    />
                    <AnswerRow
                      label="Was terminated"
                      value={request.answers.wasTerminated}
                      theme={theme}
                      goodValue="no"
                    />
                    <AnswerRow
                      label="Eligible to return"
                      value={request.answers.eligibleToReturn}
                      theme={theme}
                      goodValue="yes"
                    />
                    <AnswerRow
                      label="Had accident"
                      value={request.answers.hadAccident}
                      theme={theme}
                      goodValue="no"
                    />
                    <AnswerRow
                      label="Failed Clearinghouse test"
                      value={request.answers.failedClearinghouseTest}
                      theme={theme}
                      goodValue="no"
                    />
                    <AnswerRow
                      label="Random drug test/refused"
                      value={request.answers.randomDrugTestOrRefused}
                      theme={theme}
                      goodValue="no"
                    />
                  </div>
                  {request.answers.additionalNotes && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Additional Notes:
                      </p>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {request.answers.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attempt History */}
            {attempts.length > 0 && (
              <div>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Contact Attempts ({attempts.length}/3)
                </h4>
                <div className="space-y-2">
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {attempt.method === 'email' ? (
                          <Mail className="w-4 h-4 text-gray-500" />
                        ) : attempt.method === 'phone' ? (
                          <Phone className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Send className="w-4 h-4 text-gray-500" />
                        )}
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          Attempt {attempt.attemptNumber}
                        </span>
                        <span className={`capitalize ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          ({attempt.method})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {formatDate(attempt.sentAt)}
                        </span>
                        {attempt.responseReceived ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className={`text-xs ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <p>Requested: {formatDate(request.createdAt)}</p>
              {request.verifiedAt && <p>Completed: {formatDate(request.verifiedAt)}</p>}
              {request.nextAttemptAt && !isFinalized && (
                <p>Next attempt scheduled: {formatDate(request.nextAttemptAt)}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AnswerRow({ 
  label, 
  value, 
  theme,
  goodValue,
}: { 
  label: string
  value: string | null | undefined
  theme: string
  goodValue: 'yes' | 'no'
}) {
  if (value === null || value === undefined) return null

  let textColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  let icon = null

  if (value === 'na') {
    textColor = theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
  } else if (value === goodValue) {
    textColor = 'text-green-500'
    icon = <CheckCircle className="w-4 h-4" />
  } else if (value === 'discuss' || value === 'partial') {
    textColor = 'text-orange-500'
  } else {
    textColor = 'text-red-500'
    icon = <XCircle className="w-4 h-4" />
  }

  return (
    <div className={`flex items-center justify-between py-1 ${
      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
    }`}>
      <span className="text-sm">{label}</span>
      <div className={`flex items-center gap-1 text-sm font-medium capitalize ${textColor}`}>
        {icon}
        <span>{value === 'na' ? 'N/A' : value}</span>
      </div>
    </div>
  )
}
