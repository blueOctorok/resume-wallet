'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  User,
  Calendar,
  Send,
  Phone,
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import VerificationStatusBadge from './VerificationStatusBadge'
import { 
  EmployerVerificationSummary, 
  VerificationRequest,
  VerificationAttempt,
} from '@/types/employment-verification'

interface EmployerVerificationSectionProps {
  userAddress: string | null
  onInitiateVerification?: (candidateId: string, employmentId: string) => void
  isCollapsed?: boolean
  onToggle?: () => void
}

export default function EmployerVerificationSection({ 
  userAddress,
  onInitiateVerification,
  isCollapsed = false,
  onToggle,
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
      const response = await fetch('/api/verification/status?role=employer')

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
      const response = await fetch(`/api/verification/status?role=employer&requestId=${requestId}`)

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
        headers: { 'Content-Type': 'application/json',
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
        headers: { 'Content-Type': 'application/json',
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
      <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-200 ${
        isDarkTheme(theme)
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className={`w-6 h-6 animate-spin ${
            isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
          }`} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-2xl p-6 ${
        isDarkTheme(theme)
          ? 'bg-red-900/20 border border-red-500/30'
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDarkTheme(theme) ? 'text-red-400' : 'text-red-600'}>
            {error}
          </span>
        </div>
      </div>
    )
  }

  if (!hasCompany) {
    return (
      <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-200 ${
        isDarkTheme(theme)
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between ${isCollapsed ? '' : 'mb-4'}`}>
          <button onClick={onToggle} className="flex items-center gap-3 text-left group">
            <ClipboardCheck className={`w-5 h-5 ${
              isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
            }`} />
            <h3 className={`font-semibold ${
              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
            }`}>
              Employment Verification
            </h3>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
            } ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
        {!isCollapsed && (
          <p className={`text-sm ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Set up your company profile to verify candidate employment history.
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-200 ${
        isDarkTheme(theme)
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${isCollapsed ? '' : 'mb-6'}`}>
          <button onClick={onToggle} className="flex items-center gap-3 text-left group">
            <div className={`p-2 rounded-lg ${
              isDarkTheme(theme) ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}>
              <ClipboardCheck className={`w-5 h-5 ${
                isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
              }`} />
            </div>
            <div>
              <h3 className={`font-semibold ${
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
              }`}>
                Employment Verification
              </h3>
              {!isCollapsed && (
                <p className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Verify candidate employment history with previous employers
                </p>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
            } ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
          {!isCollapsed && (
            <button
              onClick={fetchVerificationStatus}
              className={`p-2 rounded-lg ${
                isDarkTheme(theme) ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`} />
            </button>
          )}
        </div>

        {/* Body — hidden when collapsed */}
        {!isCollapsed && summary && (
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

        {/* Verification Requests — hidden when collapsed */}
        {!isCollapsed && summary && summary.requests.length > 0 ? (
          <div className="space-y-2">
            <h4 className={`text-sm font-medium mb-3 ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Verification Requests
            </h4>
            {summary.requests.slice(0, 10).map((req) => (
              <div
                key={req.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  isDarkTheme(theme)
                    ? 'bg-gray-800/50 hover:bg-gray-800'
                    : 'bg-gray-50 hover:bg-gray-100'
                } cursor-pointer transition-colors`}
                onClick={() => fetchRequestDetails(req.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <User className={`w-5 h-5 flex-shrink-0 ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${
                      isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(req as any).candidateName || (req as any).driverName || 'Unknown Candidate'}
                    </p>
                    <p className={`text-sm truncate ${
                      isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
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
                    isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        ) : !isCollapsed ? (
          <div className={`text-center py-8 ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No verification requests yet</p>
            <p className="text-sm mt-1">
              Start by reviewing a candidate's profile and verifying their employment
            </p>
          </div>
        ) : null}
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
      bg: isDarkTheme(theme) ? 'bg-blue-900/20' : 'bg-blue-50',
      text: isDarkTheme(theme) ? 'text-blue-400' : 'text-blue-700',
      value: isDarkTheme(theme) ? 'text-blue-300' : 'text-blue-800',
    },
    yellow: {
      bg: isDarkTheme(theme) ? 'bg-yellow-900/20' : 'bg-yellow-50',
      text: isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-700',
      value: isDarkTheme(theme) ? 'text-yellow-300' : 'text-yellow-800',
    },
    green: {
      bg: isDarkTheme(theme) ? 'bg-green-900/20' : 'bg-green-50',
      text: isDarkTheme(theme) ? 'text-green-400' : 'text-green-700',
      value: isDarkTheme(theme) ? 'text-green-300' : 'text-green-800',
    },
    orange: {
      bg: isDarkTheme(theme) ? 'bg-orange-900/20' : 'bg-orange-50',
      text: isDarkTheme(theme) ? 'text-orange-400' : 'text-orange-700',
      value: isDarkTheme(theme) ? 'text-orange-300' : 'text-orange-800',
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
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader title="Verification Request" onClose={onClose} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className={`w-6 h-6 animate-spin ${
            isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
          }`} />
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
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Candidate's Claimed Employment
            </h4>
            <div className={`rounded-xl p-4 ${
              isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
            }`}>
              <p className={`font-medium ${
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
              }`}>
                {request.previousEmployerName}
              </p>
              <p className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Position: {request.claimedPosition}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {formatDate(request.claimedStartDate)} - {formatDate(request.claimedEndDate)}
                </span>
              </div>
              {request.claimedReasonForLeaving && (
                <p className={`text-sm mt-2 ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Reason for leaving: {request.claimedReasonForLeaving}
                </p>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className={`text-sm font-medium mb-2 ${
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Previous Employer Contact
            </h4>
            <div className="space-y-2">
              {request.previousEmployerEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                    {request.previousEmployerEmail}
                  </span>
                </div>
              )}
              {request.previousEmployerPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                    {request.previousEmployerPhone}
                  </span>
                </div>
              )}
              {!request.previousEmployerEmail && !request.previousEmployerPhone && (
                <p className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
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
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Actions ({request.attemptCount}/3 attempts made)
              </h4>
              <div className="flex flex-wrap gap-2">
                {canSendAttempt && request.previousEmployerEmail && (
                  <button
                    onClick={() => onSendAttempt(request.id, 'email')}
                    disabled={sending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                      isDarkTheme(theme)
                        ? 'bg-teal-600 text-white hover:bg-teal-500'
                        : 'bg-teal-600 text-white hover:bg-teal-500'
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
                      isDarkTheme(theme)
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
                      isDarkTheme(theme)
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
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
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
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Verification Results
              </h4>
              <div className={`rounded-xl p-4 space-y-3 ${
                isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
              }`}>
                {request.verifiedByName && (
                  <p className={`text-sm ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
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
                  {request.answers.hadAccident !== undefined && (
                    <AnswerRow
                      label="Had accident"
                      value={request.answers.hadAccident}
                      theme={theme}
                      goodValue="no"
                    />
                  )}
                  {request.answers.failedClearinghouseTest !== undefined && (
                    <AnswerRow
                      label="Failed Clearinghouse test"
                      value={request.answers.failedClearinghouseTest}
                      theme={theme}
                      goodValue="no"
                    />
                  )}
                  {request.answers.randomDrugTestOrRefused !== undefined && (
                    <AnswerRow
                      label="Random drug test/refused"
                      value={request.answers.randomDrugTestOrRefused}
                      theme={theme}
                      goodValue="no"
                    />
                  )}
                </div>
                {request.answers.additionalNotes && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className={`text-sm font-medium ${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Additional Notes:
                    </p>
                    <p className={`text-sm mt-1 ${
                      isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
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
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Contact Attempts ({attempts.length}/3)
              </h4>
              <div className="space-y-2">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
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
                      <span className={isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}>
                        Attempt {attempt.attemptNumber}
                      </span>
                      <span className={`capitalize ${
                        isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        ({attempt.method})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${
                        isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
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
            isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <p>Requested: {formatDate(request.createdAt)}</p>
            {request.verifiedAt && <p>Completed: {formatDate(request.verifiedAt)}</p>}
            {request.nextAttemptAt && !isFinalized && (
              <p>Next attempt scheduled: {formatDate(request.nextAttemptAt)}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
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

  let textColor = isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
  let icon = null

  if (value === 'na') {
    textColor = isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
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
      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
    }`}>
      <span className="text-sm">{label}</span>
      <div className={`flex items-center gap-1 text-sm font-medium capitalize ${textColor}`}>
        {icon}
        <span>{value === 'na' ? 'N/A' : value}</span>
      </div>
    </div>
  )
}
