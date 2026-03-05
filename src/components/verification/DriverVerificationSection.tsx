'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ClipboardCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  Eye,
  X,
} from 'lucide-react'
import VerificationStatusBadge from './VerificationStatusBadge'
import { 
  DriverVerificationSummary, 
  VerificationRequest,
  VerificationAttempt,
} from '@/types/employment-verification'

interface DriverVerificationSectionProps {
  userAddress: string | null
}

export default function DriverVerificationSection({ userAddress }: DriverVerificationSectionProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DriverVerificationSummary | null>(null)
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchVerificationStatus = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/verification/status?role=driver', {
        headers: { 'x-wallet-address': userAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch verification status')
      }

      const data = await response.json()
      setSummary(data.summary)
      setRequests(data.requests || [])
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
      const response = await fetch(`/api/verification/status?role=driver&requestId=${requestId}`, {
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
          ? 'bg-gray-800/50 border border-gray-700'
          : 'bg-white border border-gray-200 shadow-lg'
      }`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className={`w-6 h-6 animate-spin ${
            theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
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

  // Don't show section if no employment history
  if (!summary || summary.totalEmployments === 0) {
    return null
  }

  return (
    <>
      <div className={`rounded-2xl p-6 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border border-gray-700'
          : 'bg-white border border-gray-200 shadow-lg'
      }`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
          }`}>
            <ClipboardCheck className={`w-5 h-5 ${
              theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
            }`} />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Employment Verification Status
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Status of employer verifications on your history
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox
            label="Self-Reported"
            value={summary.selfReported}
            color="gray"
            theme={theme}
          />
          <StatBox
            label="Pending"
            value={summary.pendingVerification}
            color="yellow"
            theme={theme}
          />
          <StatBox
            label="Verified"
            value={summary.verified + summary.partiallyVerified}
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

        {/* Active Verifications */}
        {summary.activeVerifications.length > 0 && (
          <div className="mb-4">
            <h4 className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Active Verifications
            </h4>
            <div className="space-y-2">
              {summary.activeVerifications.map((v, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    theme === 'dark'
                      ? 'bg-gray-800/50 hover:bg-gray-800'
                      : 'bg-gray-50 hover:bg-gray-100'
                  } cursor-pointer transition-colors`}
                  onClick={() => {
                    const req = requests.find(r => r.employmentId === v.employmentId)
                    if (req) fetchRequestDetails(req.id)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <div>
                      <p className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {v.employerName}
                      </p>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Being verified by {v.requestingCompanyName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerificationStatusBadge
                      status={v.status}
                      attemptCount={v.attemptCount}
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
          </div>
        )}

        {/* Recent Verification Results */}
        {requests.filter(r => ['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'ATTEMPTS_EXHAUSTED'].includes(r.status)).length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Recent Results
            </h4>
            <div className="space-y-2">
              {requests
                .filter(r => ['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'ATTEMPTS_EXHAUSTED'].includes(r.status))
                .slice(0, 5)
                .map((req) => (
                  <div
                    key={req.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 hover:bg-gray-800'
                        : 'bg-gray-50 hover:bg-gray-100'
                    } cursor-pointer transition-colors`}
                    onClick={() => fetchRequestDetails(req.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <div>
                        <p className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {req.previousEmployerName}
                        </p>
                        <p className={`text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Verified by {req.requestingCompanyName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <VerificationStatusBadge
                        status={req.status}
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
          </div>
        )}

        {/* Help text */}
        <p className={`mt-4 text-xs ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          When companies are interested in hiring you, they may verify your employment history with previous employers.
        </p>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <VerificationDetailModal
          request={selectedRequest}
          attempts={attempts}
          loading={loadingDetails}
          theme={theme}
          onClose={() => {
            setSelectedRequest(null)
            setAttempts([])
          }}
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
  color: 'gray' | 'yellow' | 'green' | 'orange'
  theme: string
}) {
  const colorClasses = {
    gray: {
      bg: theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50',
      text: theme === 'dark' ? 'text-gray-400' : 'text-gray-600',
      value: theme === 'dark' ? 'text-gray-200' : 'text-gray-800',
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

// Detail modal component
function VerificationDetailModal({
  request,
  attempts,
  loading,
  theme,
  onClose,
}: {
  request: VerificationRequest
  attempts: VerificationAttempt[]
  loading: boolean
  theme: string
  onClose: () => void
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

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
            Verification Details
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
              <VerificationStatusBadge status={request.status} size="lg" theme={theme} />
            </div>

            {/* Employment Details */}
            <div>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Employment Being Verified
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
                  {request.claimedPosition}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {formatDate(request.claimedStartDate)} - {formatDate(request.claimedEndDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Requesting Company */}
            <div>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Verification Requested By
              </h4>
              <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                {request.requestingCompanyName || 'Unknown Company'}
              </p>
            </div>

            {/* Verification Answers (if verified) */}
            {request.answers && (
              <div>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Verification Results
                </h4>
                <div className="space-y-2">
                  <AnswerRow
                    label="Employment dates correct"
                    value={request.answers.datesCorrect}
                    theme={theme}
                  />
                  <AnswerRow
                    label="Was terminated"
                    value={request.answers.wasTerminated}
                    theme={theme}
                  />
                  <AnswerRow
                    label="Eligible to return"
                    value={request.answers.eligibleToReturn}
                    theme={theme}
                  />
                  <AnswerRow
                    label="Had accident"
                    value={request.answers.hadAccident}
                    theme={theme}
                  />
                  <AnswerRow
                    label="Failed Clearinghouse test"
                    value={request.answers.failedClearinghouseTest}
                    theme={theme}
                  />
                  <AnswerRow
                    label="Random drug test/refused"
                    value={request.answers.randomDrugTestOrRefused}
                    theme={theme}
                  />
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
                      <div>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          Attempt {attempt.attemptNumber}
                        </span>
                        <span className={`ml-2 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          via {attempt.method}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {formatDate(attempt.sentAt)}
                        </span>
                        {attempt.responseReceived && (
                          <span className="text-green-500 text-xs">Responded</span>
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
              {request.verifiedAt && <p>Verified: {formatDate(request.verifiedAt)}</p>}
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
  theme 
}: { 
  label: string
  value: string | null | undefined
  theme: string 
}) {
  if (value === null || value === undefined) return null

  const isPositive = value === 'yes' || value === 'partial'
  const isNegative = value === 'no'
  const isNA = value === 'na' || value === 'discuss'

  let textColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  if (label.toLowerCase().includes('terminated') || label.toLowerCase().includes('failed') || label.toLowerCase().includes('refused')) {
    // For these, "no" is good, "yes" is bad
    if (value === 'no') textColor = 'text-green-500'
    else if (value === 'yes') textColor = 'text-red-500'
  } else {
    // For dates correct, eligible to return: "yes" is good
    if (value === 'yes') textColor = 'text-green-500'
    else if (value === 'no') textColor = 'text-red-500'
    else if (value === 'partial') textColor = 'text-orange-500'
  }

  return (
    <div className={`flex items-center justify-between py-1 ${
      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
    }`}>
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-medium capitalize ${textColor}`}>
        {value === 'na' ? 'N/A' : value}
      </span>
    </div>
  )
}
