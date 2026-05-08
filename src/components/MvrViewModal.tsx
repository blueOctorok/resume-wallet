'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { 
  X, FileText, Calendar, MapPin, CreditCard, AlertCircle, 
  Shield, AlertTriangle, Car, Clock, CheckCircle, XCircle,
  Stethoscope, ChevronDown, ExternalLink, Award, Activity,
  Download, Printer
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  outcomeBadgeClasses,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'

interface MvrViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  /** Load this order directly (My Files → View). Omit to use legacy latest-order check-status flow. */
  orderId?: string | null
  /**
   * Talent modal: candidate’s user id. Loads via GET /api/mvr/status/...?employerCandidateUserId=...
   * (company must have paid for that order).
   */
  employerCandidateUserId?: string | null
}

interface Violation {
  date?: string
  convictionDate?: string
  type?: string
  description?: string
  points?: number
  state?: string
  acdCode?: string
  stateCode?: string
}

interface Accident {
  date?: string
  severity?: string
  fault?: string
  description?: string
}

interface Suspension {
  date?: string
  reason?: string
  endDate?: string
  state?: string
}

interface License {
  issueDate?: string
  originalIssueDate?: string
  expirationDate?: string
  class?: string
  classDescription?: string
  type?: string
  status?: string
  cdlStatus?: string
  endorsements?: string
  restrictions?: string
}

/** Driver name from DMV record (parsed from Accio subject block) */
interface MvrSubject {
  firstName?: string
  middleName?: string
  lastName?: string
  nameSuffix?: string
}

interface MvrResult {
  id: string
  subject?: MvrSubject | null
  licenseNumber: string | null
  licenseState: string | null
  licenseClass: string | null
  licenseStatus: string | null
  licenseExpirationDate: string | null
  licenses: License[]
  totalPoints: number | null
  violationCount: number | null
  violations: Violation[]
  accidentCount: number | null
  accidents: Accident[]
  suspensionCount: number | null
  suspensions: Suspension[]
  medicalCertExpiration: string | null
  medicalCertIssueDate: string | null
  medicalCertStatus: string | null
  medicalCertSelfCertification: string | null
  cdlEndorsements: string[]
  cdlRestrictions: string[]
  resultStatus: string
  receivedAt: string
  parsedAt: string | null
}

interface MvrOrder {
  id: string
  orderNumber: string
  status: string
  /** Accio-derived outcome (clear/hits/no_hits/...). Only set when status === 'completed'. */
  resultOutcome: ScreeningOutcome
  orderedAt: string
  paymentId: string | null
}

interface Payment {
  id: string
  txHash: string
  amount: string
  status: string
  createdAt: string
}

/**
 * Format driver name from subject data.
 * The API now extracts clean name data directly from raw XML,
 * so this is straightforward concatenation.
 */
function formatDriverName(subject: MvrSubject | undefined | null): string {
  if (!subject) return ''
  
  const parts = [
    subject.firstName?.trim(),
    subject.middleName?.trim(),
    subject.lastName?.trim()
  ].filter(Boolean)
  
  return parts.join(' ')
}

/**
 * Format YYYYMMDD date to readable string
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A'
  
  // Handle YYYYMMDD format
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  // Handle ISO format
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: string | undefined | null): { bg: string; text: string; dot: string } {
  if (!status) return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
  
  const statusLower = status.toLowerCase()
  if (statusLower.includes('valid') || statusLower.includes('active') || statusLower.includes('certified') || statusLower.includes('completed')) {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' }
  }
  if (statusLower.includes('expired') || statusLower.includes('suspend') || statusLower.includes('revoked')) {
    return { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' }
  }
  if (statusLower.includes('pending') || statusLower.includes('unknown') || statusLower.includes('review')) {
    return { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' }
  }
  return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
}

export default function MvrViewModal({
  isOpen,
  onClose,
  walletAddress,
  orderId: orderIdProp,
  employerCandidateUserId,
}: MvrViewModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mvrOrder, setMvrOrder] = useState<MvrOrder | null>(null)
  const [mvrResult, setMvrResult] = useState<MvrResult | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [showPayments, setShowPayments] = useState(false)

  // Download a Storm-branded server-rendered PDF for this report.
  // The /api/mvr/[orderId]/pdf route handles auth, parses the raw XML, and
  // streams a real PDF — replaces the previous popup+window.print() workaround
  // which produced an unsaveable browser print sheet, not a real artifact.
  const handleDownloadPDF = () => {
    if (!mvrOrder) return
    const params = new URLSearchParams({ walletAddress })
    if (employerCandidateUserId) params.set('employerCandidateUserId', employerCandidateUserId)
    window.location.href = `/api/mvr/${mvrOrder.id}/pdf?${params.toString()}`
  }

  useEffect(() => {
    if (!isOpen || !walletAddress) {
      return
    }

    const fetchMvrData = async () => {
      try {
        setLoading(true)
        setError(null)
        setMvrOrder(null)
        setMvrResult(null)
        setPayments([])

        // Explicit order: My Files "View" on a completed MVR (avoids sending users to the order form)
        if (orderIdProp) {
          const q = new URLSearchParams({ walletAddress })
          if (employerCandidateUserId) {
            q.set('employerCandidateUserId', employerCandidateUserId)
          }
          const statusResponse = await fetch(`/api/mvr/status/${orderIdProp}?${q.toString()}`)
          if (!statusResponse.ok) {
            const errBody = await statusResponse.json().catch(() => ({}))
            throw new Error(errBody.error || 'Failed to load MVR')
          }
          const statusData = await statusResponse.json()
          const o = statusData.order
          if (o) {
            setMvrOrder({
              id: o.id,
              orderNumber: o.orderNumber ?? '',
              status: o.status ?? '',
              resultOutcome: (o.resultOutcome as ScreeningOutcome) ?? null,
              orderedAt: o.orderedAt ?? '',
              paymentId: null,
            })
          }
          if (statusData.result) {
            setMvrResult(statusData.result as MvrResult)
          }
          return
        }

        const response = await fetch(`/api/mvr/check-status?walletAddress=${encodeURIComponent(walletAddress)}`)

        if (!response.ok) {
          throw new Error('Failed to fetch MVR data')
        }

        const data = await response.json()

        if (data.payments && data.payments.length > 0) {
          setPayments(data.payments)
        }

        if (data.hasMvr && data.order) {
          setMvrOrder(data.order)

          if (data.result?.id) {
            const oid = data.order.id
            const statusResponse = await fetch(`/api/mvr/status/${oid}?walletAddress=${encodeURIComponent(walletAddress)}`)

            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              if (statusData.result) {
                setMvrResult(statusData.result)
              }
            }
          }
        } else {
          setError('No MVR found')
        }
      } catch (err: unknown) {
        console.error('Error fetching MVR data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load MVR data')
      } finally {
        setLoading(false)
      }
    }

    fetchMvrData()
  }, [isOpen, walletAddress, orderIdProp, employerCandidateUserId])

  if (!isOpen) return null

  // Determine if we're in dark mode
  const isDark = isDarkTheme(theme)

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl" zIndex={10100}>
      <div className={`overflow-hidden ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : ''
      }`}>
        
        {/* Header with gradient accent */}
        <div className={`relative px-6 py-5 border-b ${
          isDark ? 'border-gray-700/50' : 'border-gray-200'
        }`}>
          {/* Accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-700 via-teal-500 to-teal-200" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isDark ? 'bg-teal-700/20' : 'bg-teal-700/10'
              }`}>
                <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Motor Vehicle Report
                </h2>
                {/* Show driver name prominently if available */}
                {mvrResult && formatDriverName(mvrResult.subject) ? (
                  <p className={`text-sm font-medium ${isDark ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'}`}>
                    {formatDriverName(mvrResult.subject)}
                  </p>
                ) : (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Official DMV Record
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Download/Print Button - only show when results are available */}
              {mvrResult && mvrOrder && (
                <button
                  onClick={handleDownloadPDF}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-medium text-sm ${
                    isDark 
                      ? 'bg-teal-700/20 hover:bg-teal-700/30 text-teal-600 dark:text-teal-400' 
                      : 'bg-teal-700/10 hover:bg-teal-700/20 text-teal-800 dark:text-teal-300'
                  }`}
                  title="Download or Print Report"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-all ${
                  isDark 
                    ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin" />
              </div>
              <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Loading MVR data...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`p-4 rounded-full ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <p className={`mt-4 font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {error}
              </p>
            </div>
          ) : (
            <>
              {/* Outcome banner — Clear / Hits / etc. Surfaces what employers care about
                  (Accio's filledCode mapped via accio-result-status.ts) at a glance. */}
              {mvrOrder && mvrOrder.status === 'completed' && mvrOrder.resultOutcome && (
                <div
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    isDark
                      ? 'border-gray-700/60 bg-gray-800/40'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className={`h-5 w-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Report Outcome
                      </p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {outcomeLabel(mvrOrder.resultOutcome)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${outcomeBadgeClasses(mvrOrder.resultOutcome)}`}
                  >
                    {outcomeLabel(mvrOrder.resultOutcome)}
                  </span>
                </div>
              )}

              {/* Payment History Accordion */}
              {payments.length > 0 && (
                <div className={`rounded-xl overflow-hidden ${
                  isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <button
                    onClick={() => setShowPayments(!showPayments)}
                    className={`w-full px-4 py-3 flex items-center justify-between ${
                      isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className={`h-4 w-4 ${isDark ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'}`} />
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Payment History
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-teal-700/20 text-teal-600 dark:text-teal-400' : 'bg-teal-700/10 text-teal-800 dark:text-teal-300'
                      }`}>
                        {payments.length}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                      showPayments ? 'rotate-180' : ''
                    } ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  </button>
                  
                  {showPayments && (
                    <div className={`px-4 pb-4 space-y-2 border-t ${
                      isDark ? 'border-gray-700/50' : 'border-gray-200'
                    }`}>
                      <div className="pt-3">
                        {payments.map((payment, idx) => (
                          <div
                            key={payment.id}
                            className={`p-3 rounded-lg ${
                              isDark ? 'bg-gray-900/50' : 'bg-white border border-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                ${payment.amount} USDC
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                payment.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  payment.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'
                                }`} />
                                {payment.status}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Status Card */}
              {mvrOrder && (
                <div className={`rounded-xl p-5 ${
                  isDark 
                    ? 'bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700/50' 
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Order Number
                      </p>
                      <p className={`mt-1 font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {mvrOrder.orderNumber}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Status
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusBadge(mvrOrder.status).dot}`} />
                        <span className={`text-sm font-medium ${getStatusBadge(mvrOrder.status).text}`}>
                          {mvrOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Ordered
                      </p>
                      <p className={`mt-1 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatDate(mvrOrder.orderedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MVR Results */}
              {mvrResult ? (
                <>
                  {/* License Card - Hero Section */}
                  <div className={`rounded-xl overflow-hidden ${
                    isDark 
                      ? 'bg-gradient-to-br from-teal-700/20 via-gray-800 to-gray-800/50 border border-teal-700/30' 
                      : 'bg-gradient-to-br from-brand-cream to-white border border-teal-700/20'
                  }`}>
                    <div className={`px-5 py-4 border-b ${
                      isDark ? 'border-teal-700/20' : 'border-teal-700/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          License Information
                        </h3>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      {/* Driver name from DMV record (when available) */}
                      {formatDriverName(mvrResult.subject) && (
                        <div className="mb-5">
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Name on record
                          </p>
                          <p className={`mt-1 text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDriverName(mvrResult.subject)}
                          </p>
                        </div>
                      )}
                      {/* Main License Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            License Number
                          </p>
                          <p className={`mt-1 text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {mvrResult.licenseNumber || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            State
                          </p>
                          <p className={`mt-1 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {mvrResult.licenseState || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Status
                          </p>
                          <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                            getStatusBadge(mvrResult.licenseStatus).bg
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(mvrResult.licenseStatus).dot}`} />
                            <span className={`text-sm font-semibold ${getStatusBadge(mvrResult.licenseStatus).text}`}>
                              {mvrResult.licenseStatus || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Expiration
                          </p>
                          <p className={`mt-1 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDate(mvrResult.licenseExpirationDate)}
                          </p>
                        </div>
                      </div>

                      {/* License Classes */}
                      {mvrResult.licenses && mvrResult.licenses.length > 0 && (
                        <div className={`mt-6 pt-5 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                          <p className={`text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            License Classes
                          </p>
                          <div className="grid gap-3">
                            {mvrResult.licenses.map((license, idx) => (
                              <div 
                                key={idx}
                                className={`p-4 rounded-xl ${
                                  isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                      license.type?.toLowerCase().includes('commercial')
                                        ? 'bg-blue-500/20'
                                        : isDark ? 'bg-gray-700' : 'bg-gray-200'
                                    }`}>
                                      <span className={`text-xl font-black ${
                                        license.type?.toLowerCase().includes('commercial')
                                          ? 'text-blue-400'
                                          : isDark ? 'text-gray-300' : 'text-gray-600'
                                      }`}>
                                        {license.class || '?'}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                          Class {license.class}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          license.type?.toLowerCase().includes('commercial')
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                          {license.type || 'Standard'}
                                        </span>
                                      </div>
                                      {license.classDescription && (
                                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {license.classDescription}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`px-2.5 py-1 rounded-lg ${getStatusBadge(license.status).bg}`}>
                                    <span className={`text-xs font-medium ${getStatusBadge(license.status).text}`}>
                                      {license.status || 'Unknown'}
                                    </span>
                                  </div>
                                </div>
                                {license.restrictions && (
                                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      <span className="font-medium">Restrictions:</span> {license.restrictions}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medical Certificate */}
                  {(mvrResult.medicalCertExpiration || mvrResult.medicalCertStatus) && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-5 w-5 text-emerald-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Medical Certificate
                          </h3>
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Status</p>
                          <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                            getStatusBadge(mvrResult.medicalCertStatus).bg
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(mvrResult.medicalCertStatus).dot}`} />
                            <span className={`text-sm font-semibold ${getStatusBadge(mvrResult.medicalCertStatus).text}`}>
                              {mvrResult.medicalCertStatus || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        {mvrResult.medicalCertIssueDate && (
                          <div>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Issued</p>
                            <p className={`mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {formatDate(mvrResult.medicalCertIssueDate)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Expiration</p>
                          <p className={`mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDate(mvrResult.medicalCertExpiration)}
                          </p>
                        </div>
                        {mvrResult.medicalCertSelfCertification && (
                          <div>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Self Certification</p>
                            <p className={`mt-1 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {mvrResult.medicalCertSelfCertification}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {/* Points */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.totalPoints || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.totalPoints || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Points
                      </p>
                    </div>
                    
                    {/* Violations */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.violationCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.violationCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Violations
                      </p>
                    </div>
                    
                    {/* Accidents */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.accidentCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.accidentCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Accidents
                      </p>
                    </div>
                    
                    {/* Suspensions */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.suspensionCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.suspensionCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Suspensions
                      </p>
                    </div>
                  </div>

                  {/* Violations Detail */}
                  {mvrResult.violations && mvrResult.violations.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Violations
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400`}>
                            {mvrResult.violations.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.violations.map((violation, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-amber-500 ${
                              isDark ? 'bg-amber-500/5' : 'bg-amber-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {violation.description || violation.type || 'Violation'}
                                </p>
                                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm ${
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {violation.date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      Issue: {formatDate(violation.date)}
                                    </span>
                                  )}
                                  {violation.convictionDate && (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Conviction: {formatDate(violation.convictionDate)}
                                    </span>
                                  )}
                                  {violation.state && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {violation.state}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {violation.points !== undefined && violation.points > 0 && (
                                  <span className="text-lg font-bold text-red-400">
                                    {violation.points} pts
                                  </span>
                                )}
                                {violation.acdCode && (
                                  <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    ACD: {violation.acdCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accidents Detail */}
                  {mvrResult.accidents && mvrResult.accidents.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-red-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Accidents
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400`}>
                            {mvrResult.accidents.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.accidents.map((accident, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-red-500 ${
                              isDark ? 'bg-red-500/5' : 'bg-red-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {accident.description || 'Accident'}
                                </p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {formatDate(accident.date)}
                                </p>
                              </div>
                              <div className="text-right">
                                {accident.severity && (
                                  <span className={`text-sm font-medium ${
                                    accident.severity.toLowerCase().includes('fatal') 
                                      ? 'text-red-400' 
                                      : 'text-amber-400'
                                  }`}>
                                    {accident.severity}
                                  </span>
                                )}
                                {accident.fault && (
                                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Fault: {accident.fault}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suspensions Detail */}
                  {mvrResult.suspensions && mvrResult.suspensions.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Suspensions
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400`}>
                            {mvrResult.suspensions.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.suspensions.map((suspension, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-red-600 ${
                              isDark ? 'bg-red-500/5' : 'bg-red-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {suspension.reason || 'Suspension'}
                                </p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  From: {formatDate(suspension.date)}
                                  {suspension.endDate && ` → To: ${formatDate(suspension.endDate)}`}
                                </p>
                              </div>
                              {suspension.state && (
                                <span className={`text-sm flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  <MapPin className="h-3.5 w-3.5" />
                                  {suspension.state}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className={`text-center text-xs py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Report received {new Date(mvrResult.receivedAt).toLocaleString()}
                    {mvrResult.parsedAt && ` • Processed ${new Date(mvrResult.parsedAt).toLocaleString()}`}
                  </div>
                </>
              ) : (
                /* Processing State */
                <div className={`rounded-xl p-8 ${
                  isDark 
                    ? 'bg-amber-500/10 border border-amber-500/30' 
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                      <Clock className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        MVR Results Processing
                      </p>
                      <p className={`text-sm mt-1 ${isDark ? 'text-amber-500/80' : 'text-amber-600'}`}>
                        This typically takes a few minutes. The report will update automatically when ready.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
