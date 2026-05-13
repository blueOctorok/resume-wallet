'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  X, FileText, Calendar, MapPin, CreditCard, AlertCircle,
  Shield, AlertTriangle, Car, Clock, CheckCircle, XCircle,
  Stethoscope, ChevronDown, Activity, Download, User as UserIcon,
  Hash, UserCheck, Ban,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import {
  outcomeBadgeClasses,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'
import { hasValidMedicalCert } from '@/lib/accio-xml-parser'

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

/** DMV-reported physical/personal description (best-effort, fields can be missing). */
interface PersonalCharacteristics {
  sex?: string
  weight?: string
  height?: string
  eyes?: string
  hair?: string
  donor?: string
  age?: number
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
  /** DMV's own "As of" timestamp from the report — when the state pulled the record. */
  dmvAsOfDate: string | null
  /** Raw DMV physical description block — display only fields that are present. */
  personalCharacteristics: PersonalCharacteristics | null
  /**
   * Medical examiner details from the MEDICAL EXAMINER INFORMATION text section.
   * Only populated for CDL drivers whose state includes examiner info.
   */
  medicalExaminer: {
    name?: string
    licenseNumber?: string
    licenseJurisdiction?: string
    nationalRegistryNumber?: string
    phone?: string
  } | null
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
 * Get status badge styling — semantic color mapping shared across license,
 * medical cert, and CDL status fields.
 */
function getStatusBadge(status: string | undefined | null): { bg: string; text: string; dot: string } {
  if (!status) return { bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' }
  
  const s = status.toLowerCase()
  if (s.includes('valid') || s.includes('active') || s.includes('certified') || s.includes('licensed') || s.includes('completed')) {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' }
  }
  if (s.includes('expired') || s.includes('suspend') || s.includes('revoked') || s.includes('cancelled')) {
    return { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' }
  }
  if (s.includes('pending') || s.includes('unknown') || s.includes('review') || s.includes('discrepancy')) {
    return { bg: 'bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' }
  }
  return { bg: 'bg-slate-500/20', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' }
}

type IconAccent = 'teal' | 'amber' | 'emerald' | 'red' | 'slate'

/**
 * Shared section header — icon tile + title + optional count badge.
 * Amber = screening data (violations, accidents, suspensions, order refs)
 * Teal = identity data (driver info, license)
 * Emerald = positive health data (medical cert)
 */
function SectionHeader({
  icon: Icon,
  title,
  accent = 'teal',
  count,
  isDark,
}: {
  icon: React.ElementType
  title: string
  accent?: IconAccent
  count?: number
  isDark: boolean
}) {
  const tile: Record<IconAccent, string> = {
    teal:    'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-200 ring-1 ring-teal-200 dark:ring-teal-400/30',
    amber:   'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-400/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-400/30',
    red:     'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30',
    slate:   'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600/40',
  }
  const countBg: Record<IconAccent, string> = {
    teal:    'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300',
    amber:   'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    red:     'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
    slate:   'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tile[accent])}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>{title}</h3>
      {count !== undefined && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', countBg[accent])}>
          {count}
        </span>
      )}
    </div>
  )
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
  const [showRefs, setShowRefs] = useState(false)

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
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isDark ? 'bg-teal-700/20' : 'bg-teal-700/10'
              }`}>
                <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Motor Vehicle Report
                </h2>
                {/* Show driver name prominently if available */}
                {mvrResult && formatDriverName(mvrResult.subject) ? (
                  <p className={`text-sm font-medium break-words ${isDark ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'}`}>
                    {formatDriverName(mvrResult.subject)}
                  </p>
                ) : (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Official DMV Record
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {mvrResult && mvrOrder && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPDF}
                  title="Download Report PDF"
                >
                  <Download className="h-4 w-4 mr-1" aria-hidden />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-xl transition-all',
                  isDark
                    ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
                )}
                aria-label="Close"
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
                  className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    isDark
                      ? 'border-gray-700/60 bg-gray-800/40'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
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
                    className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:self-center ${outcomeBadgeClasses(mvrOrder.resultOutcome)}`}
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
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <SectionHeader icon={Shield} title="License Information" accent="teal" isDark={isDark} />
                        {/* DMV "As of" timestamp — when the state actually pulled
                            this record. Distinct from when Storm/Accio processed
                            it. Employers care about this for staleness. */}
                        {mvrResult.dmvAsOfDate && (
                          <span className={cn(
                            'text-xs px-2.5 py-1 rounded-md',
                            isDark
                              ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30'
                              : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200',
                          )}>
                            DMV pulled {mvrResult.dmvAsOfDate}
                          </span>
                        )}
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
                                {/* Stack on narrow widths: long type / "Passenger" text must not
                                    overlap status badges (was flex row + justify-between). */}
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                  <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <div
                                      className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
                                        license.type?.toLowerCase().includes('commercial')
                                          ? 'bg-teal-500/20 dark:bg-teal-500/20'
                                          : isDark ? 'bg-gray-700' : 'bg-gray-200'
                                      }`}
                                    >
                                      {/* Show only first char so long values like "PASSENGER" don't overflow the tile */}
                                      <span
                                        className={`text-xl font-black leading-none ${
                                          license.type?.toLowerCase().includes('commercial')
                                            ? 'text-teal-600 dark:text-teal-300'
                                            : isDark ? 'text-gray-300' : 'text-gray-600'
                                        }`}
                                      >
                                        {(license.class || '?')[0]}
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className={`shrink-0 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                          Class {license.class}
                                        </span>
                                        <span
                                          className={cn(
                                            'max-w-full break-words text-xs px-2 py-0.5 rounded-full',
                                            license.type?.toLowerCase().includes('commercial')
                                              ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300'
                                              : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600',
                                          )}
                                        >
                                          {license.type || 'Standard'}
                                        </span>
                                      </div>
                                      {license.classDescription && (
                                        <p
                                          className={cn(
                                            'mt-1 max-w-full text-sm break-words',
                                            isDark ? 'text-gray-400' : 'text-gray-500',
                                          )}
                                        >
                                          {license.classDescription}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-col sm:items-end sm:justify-start">
                                    <div className={`px-2.5 py-1 rounded-lg ${getStatusBadge(license.status).bg}`}>
                                      <span className={`text-xs font-medium ${getStatusBadge(license.status).text}`}>
                                        {license.status || 'Unknown'}
                                      </span>
                                    </div>
                                    {license.cdlStatus && license.cdlStatus !== license.status && (
                                      <div className={`px-2.5 py-1 rounded-lg ${getStatusBadge(license.cdlStatus).bg}`}>
                                        <span className={`text-xs font-medium ${getStatusBadge(license.cdlStatus).text}`}>
                                          CDL: {license.cdlStatus}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {license.restrictions && (
                                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                    <p
                                      className={cn(
                                        'text-xs max-w-full break-words',
                                        isDark ? 'text-gray-500' : 'text-gray-400',
                                      )}
                                    >
                                      <span className="font-medium">Restrictions:</span> {license.restrictions}
                                    </p>
                                  </div>
                                )}
                                {/* Endorsements — shown as teal pills, one per endorsement code/name */}
                                {license.endorsements && (
                                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                    <p className={cn('mb-1.5 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                      Endorsements
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {license.endorsements.split(/[,;]+/).map((e) => e.trim()).filter(Boolean).map((endorsement, eIdx) => (
                                        <span
                                          key={eIdx}
                                          className="max-w-full min-w-0 break-words rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/30"
                                        >
                                          {endorsement}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Issue / expiration dates */}
                                {(license.issueDate || license.originalIssueDate || license.expirationDate) && (
                                  <div
                                    className={cn(
                                      'mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3',
                                      isDark ? 'border-gray-700/50' : 'border-gray-200',
                                      // 1 col when only one date, else responsive — avoids squeezed columns overlapping
                                      [license.originalIssueDate, license.issueDate, license.expirationDate].filter(Boolean).length === 1
                                        ? 'grid-cols-1'
                                        : 'grid-cols-1 sm:grid-cols-3',
                                    )}
                                  >
                                    {license.originalIssueDate && (
                                      <div className="min-w-0">
                                        <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Orig. Issued</p>
                                        <p className={cn('mt-0.5 break-words text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{formatDate(license.originalIssueDate)}</p>
                                      </div>
                                    )}
                                    {license.issueDate && (
                                      <div className="min-w-0">
                                        <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Issued</p>
                                        <p className={cn('mt-0.5 break-words text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{formatDate(license.issueDate)}</p>
                                      </div>
                                    )}
                                    {license.expirationDate && (
                                      <div className="min-w-0">
                                        <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Expires</p>
                                        <p className={cn('mt-0.5 break-words text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{formatDate(license.expirationDate)}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personal Characteristics — DMV's own physical description
                      (sex/weight/height/eyes/hair/donor/age). Best-effort: only
                      renders when at least one field is present, and within the
                      card each field is conditional so partial DMV fills don't
                      show "—" placeholders. Age is computed from DOB by the
                      parser so it stays current as time passes. */}
                  {mvrResult.personalCharacteristics &&
                    Object.values(mvrResult.personalCharacteristics).some(v => v !== undefined && v !== null && v !== '') && (
                      <div className={`rounded-xl overflow-hidden ${
                        isDark
                          ? 'bg-gray-800/50 border border-gray-700/50'
                          : 'bg-white border border-gray-200 shadow-sm'
                      }`}>
                        <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                          <SectionHeader icon={UserIcon} title="Personal Characteristics" accent="teal" isDark={isDark} />
                        </div>
                        <div className="p-5">
                          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {mvrResult.personalCharacteristics.sex && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Sex</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.sex}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.age !== undefined && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Age</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.age}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.height && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Height</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.height}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.weight && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Weight</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.weight}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.eyes && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Eyes</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.eyes}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.hair && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Hair</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.hair}
                                </dd>
                              </div>
                            )}
                            {mvrResult.personalCharacteristics.donor && (
                              <div>
                                <dt className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Organ Donor</dt>
                                <dd className={`mt-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {mvrResult.personalCharacteristics.donor}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                    )}

                  {/* Medical Certificate — only render when the driver actually
                      has a real DOT med cert on file. `hasValidMedicalCert` drops
                      Class D / non-CDL drivers (status "NOT CERTIFIED" or empty)
                      so we don't display the LICENSE's "Status: VALID" mislabeled
                      as a med card. See accio-xml-parser.ts for the rule. */}
                  {hasValidMedicalCert(mvrResult.medicalCertStatus, mvrResult.medicalCertExpiration) && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <SectionHeader icon={Stethoscope} title="Medical Certificate" accent="emerald" isDark={isDark} />
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

                  {/* Medical Examiner — only shown when the parser extracted examiner data
                      from the MEDICAL EXAMINER INFORMATION text section (CDL drivers, certain states). */}
                  {mvrResult.medicalExaminer && (
                    <div className={cn(
                      'rounded-xl overflow-hidden',
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200 shadow-sm',
                    )}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <SectionHeader icon={UserCheck} title="Medical Examiner" accent="emerald" isDark={isDark} />
                      </div>
                      <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                        {mvrResult.medicalExaminer.name && (
                          <div className="col-span-2 md:col-span-1">
                            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Examiner Name</p>
                            <p className={cn('mt-1 font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {mvrResult.medicalExaminer.name}
                            </p>
                          </div>
                        )}
                        {mvrResult.medicalExaminer.licenseJurisdiction && (
                          <div>
                            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Jurisdiction</p>
                            <p className={cn('mt-1 font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {mvrResult.medicalExaminer.licenseJurisdiction}
                            </p>
                          </div>
                        )}
                        {mvrResult.medicalExaminer.licenseNumber && (
                          <div>
                            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>License No.</p>
                            <p className={cn('mt-1 font-mono text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {mvrResult.medicalExaminer.licenseNumber}
                            </p>
                          </div>
                        )}
                        {mvrResult.medicalExaminer.nationalRegistryNumber && (
                          <div>
                            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>National Registry No.</p>
                            <p className={cn('mt-1 font-mono text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {mvrResult.medicalExaminer.nationalRegistryNumber}
                            </p>
                          </div>
                        )}
                        {mvrResult.medicalExaminer.phone && (
                          <div>
                            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Phone</p>
                            <p className={cn('mt-1 font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {mvrResult.medicalExaminer.phone}
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
                  <div className={`rounded-xl overflow-hidden ${
                    isDark 
                      ? 'bg-gray-800/50 border border-gray-700/50' 
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                      <SectionHeader icon={AlertTriangle} title="Violations" accent="amber" count={mvrResult.violations?.length ?? 0} isDark={isDark} />
                    </div>
                    <div className="p-5">
                      {!mvrResult.violations || mvrResult.violations.length === 0 ? (
                        <p className={cn('text-sm text-center py-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          No violations on record
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {mvrResult.violations.map((violation, idx) => (
                            <div 
                              key={idx}
                              className={`p-4 rounded-xl border-l-4 border-amber-500 ${
                                isDark ? 'bg-amber-500/5' : 'bg-amber-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className={`font-semibold break-words ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
                                    {violation.stateCode && (
                                      <span className={cn('font-mono text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                        {violation.stateCode}
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
                      )}
                    </div>
                  </div>

                  {/* Accidents Detail */}
                  <div className={`rounded-xl overflow-hidden ${
                    isDark 
                      ? 'bg-gray-800/50 border border-gray-700/50' 
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                      <SectionHeader icon={Car} title="Accidents" accent="red" count={mvrResult.accidents?.length ?? 0} isDark={isDark} />
                    </div>
                    <div className="p-5">
                      {!mvrResult.accidents || mvrResult.accidents.length === 0 ? (
                        <p className={cn('text-sm text-center py-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          No accidents on record
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {mvrResult.accidents.map((accident, idx) => (
                            <div 
                              key={idx}
                              className={`p-4 rounded-xl border-l-4 border-red-500 ${
                                isDark ? 'bg-red-500/5' : 'bg-red-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className={`break-words font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {accident.description || 'Accident'}
                                  </p>
                                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {formatDate(accident.date)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
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
                      )}
                    </div>
                  </div>

                  {/* Suspensions Detail */}
                  <div className={`rounded-xl overflow-hidden ${
                    isDark 
                      ? 'bg-gray-800/50 border border-gray-700/50' 
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                      <SectionHeader icon={Ban} title="Suspensions" accent="red" count={mvrResult.suspensions?.length ?? 0} isDark={isDark} />
                    </div>
                    <div className="p-5">
                      {!mvrResult.suspensions || mvrResult.suspensions.length === 0 ? (
                        <p className={cn('text-sm text-center py-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          No suspensions on record
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {mvrResult.suspensions.map((suspension, idx) => (
                            <div 
                              key={idx}
                              className={`p-4 rounded-xl border-l-4 border-red-600 ${
                                isDark ? 'bg-red-500/5' : 'bg-red-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className={`break-words font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {suspension.reason || 'Suspension'}
                                  </p>
                                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    From: {formatDate(suspension.date)}
                                    {suspension.endDate && ` → To: ${formatDate(suspension.endDate)}`}
                                  </p>
                                </div>
                                {suspension.state && (
                                  <span className={`shrink-0 text-sm flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <MapPin className="h-3.5 w-3.5" />
                                    {suspension.state}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order References — collapsed by default, useful for support */}
                  {mvrOrder && (
                    <div className={cn('rounded-xl overflow-hidden', isDark ? 'border border-gray-700/50' : 'border border-gray-200')}>
                      <button
                        type="button"
                        onClick={() => setShowRefs(!showRefs)}
                        className={cn(
                          'w-full flex items-center justify-between px-5 py-3.5 transition-colors',
                          isDark ? 'hover:bg-gray-800/60 bg-gray-800/40' : 'hover:bg-gray-50 bg-white',
                        )}
                      >
                        <SectionHeader icon={Hash} title="Order References" accent="slate" isDark={isDark} />
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isDark ? 'text-gray-400' : 'text-gray-500', showRefs && 'rotate-180')} />
                      </button>
                      {showRefs && (
                        <div className={cn('px-5 pb-5 pt-2 border-t', isDark ? 'border-gray-700/50 bg-gray-800/40' : 'border-gray-200 bg-white')}>
                          <dl className="grid gap-2 font-mono text-[11px] leading-snug">
                            <div>
                              <dt className={cn(isDark ? 'text-gray-500' : 'text-gray-400')}>Storm order ID</dt>
                              <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>{mvrOrder.id}</dd>
                            </div>
                            {mvrOrder.orderNumber && (
                              <div>
                                <dt className={cn(isDark ? 'text-gray-500' : 'text-gray-400')}>Accio order #</dt>
                                <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>{mvrOrder.orderNumber}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}
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
