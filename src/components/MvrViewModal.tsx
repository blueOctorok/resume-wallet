'use client'

import { useState, useEffect } from 'react'
import { 
  X, FileText, Calendar, MapPin, CreditCard, AlertCircle, 
  Shield, AlertTriangle, Car, Clock, CheckCircle, XCircle,
  BadgeCheck, Stethoscope
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
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

interface MvrResult {
  id: string
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
 * Get status color classes
 */
function getStatusColor(status: string | undefined | null, theme: string): string {
  if (!status) return theme === 'light' ? 'text-gray-500' : 'text-gray-400'
  
  const statusLower = status.toLowerCase()
  if (statusLower.includes('valid') || statusLower.includes('active') || statusLower.includes('certified')) {
    return 'text-green-600'
  }
  if (statusLower.includes('expired') || statusLower.includes('suspend') || statusLower.includes('revoked')) {
    return 'text-red-600'
  }
  if (statusLower.includes('pending') || statusLower.includes('unknown')) {
    return 'text-yellow-600'
  }
  return theme === 'light' ? 'text-gray-700' : 'text-gray-300'
}

export default function MvrViewModal({ isOpen, onClose, walletAddress }: MvrViewModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mvrOrder, setMvrOrder] = useState<MvrOrder | null>(null)
  const [mvrResult, setMvrResult] = useState<MvrResult | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (!isOpen || !walletAddress) {
      return
    }

    const fetchMvrData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/mvr/check-status?walletAddress=${encodeURIComponent(walletAddress)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch MVR data')
        }

        const data = await response.json()

        // Set payments regardless of order status
        if (data.payments && data.payments.length > 0) {
          setPayments(data.payments)
        }

        if (data.hasMvr && data.order) {
          setMvrOrder(data.order)

          // If we have a result, fetch full details
          if (data.result?.id) {
            const orderId = data.order.id
            const statusResponse = await fetch(`/api/mvr/status/${orderId}?walletAddress=${encodeURIComponent(walletAddress)}`)
            
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
      } catch (err: any) {
        console.error('Error fetching MVR data:', err)
        setError(err.message || 'Failed to load MVR data')
      } finally {
        setLoading(false)
      }
    }

    fetchMvrData()
  }, [isOpen, walletAddress])

  if (!isOpen) return null

  // Theme-based styling helpers
  const cardClass = theme === 'light'
    ? 'bg-white border-gray-200'
    : 'bg-brand-sage-light/30 border-brand-mint/30'
  
  const labelClass = theme === 'light' ? 'text-gray-500' : 'text-gray-400'
  const valueClass = theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'
  const headingClass = theme === 'light' ? 'text-gray-900' : 'text-brand-cream'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border ${
          theme === 'light'
            ? 'bg-gray-50 border-gray-200'
            : 'bg-brand-sage-light/95 backdrop-blur-xl border-brand-mint/50'
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${
            theme === 'light'
              ? 'bg-white border-gray-200'
              : 'bg-brand-sage-light/95 border-brand-mint/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className={`h-6 w-6 ${theme === 'light' ? 'text-brand-sage' : 'text-brand-mint'}`} />
            <h2 className={`text-2xl font-bold ${headingClass}`}>
              Motor Vehicle Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'light'
                ? 'hover:bg-gray-100 text-gray-500'
                : 'hover:bg-brand-sage-light/50 text-gray-400'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 border-brand-sage"></div>
              <p className={labelClass}>Loading MVR data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <p className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>{error}</p>
            </div>
          ) : (
            <>
              {/* Payment History - Collapsible */}
              {payments.length > 0 && (
                <details className={`p-4 rounded-xl border ${cardClass}`}>
                  <summary className={`cursor-pointer flex items-center gap-2 ${headingClass}`}>
                    <CreditCard className="h-5 w-5" />
                    <span className="font-semibold">Payment History ({payments.length})</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {payments.map((payment, idx) => (
                      <div
                        key={payment.id}
                        className={`p-3 rounded-lg text-sm ${
                          theme === 'light'
                            ? 'bg-gray-50 border border-gray-100'
                            : 'bg-brand-sage-light/20 border border-brand-mint/20'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={valueClass}>Payment #{idx + 1}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            payment.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        <div className={`text-xs mt-1 ${labelClass}`}>
                          ${payment.amount} USDC • {new Date(payment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Order Status Bar */}
              {mvrOrder && (
                <div className={`p-4 rounded-xl border ${cardClass}`}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className={`text-sm ${labelClass}`}>Order #</span>
                      <p className={`text-lg ${valueClass}`}>{mvrOrder.orderNumber}</p>
                    </div>
                    <div>
                      <span className={`text-sm ${labelClass}`}>Status</span>
                      <p className={`text-lg font-semibold flex items-center gap-2 ${getStatusColor(mvrOrder.status, theme)}`}>
                        {mvrOrder.status === 'completed' && <CheckCircle className="h-5 w-5" />}
                        {mvrOrder.status === 'pending' && <Clock className="h-5 w-5" />}
                        {mvrOrder.status === 'needs_review' && <AlertTriangle className="h-5 w-5" />}
                        {mvrOrder.status.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <span className={`text-sm ${labelClass}`}>Ordered</span>
                      <p className={valueClass}>{formatDate(mvrOrder.orderedAt)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MVR Results */}
              {mvrResult ? (
                <>
                  {/* License Information - Primary Card */}
                  <div className={`p-6 rounded-xl border ${cardClass}`}>
                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                      <Shield className="h-5 w-5 text-blue-500" />
                      License Information
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className={`text-sm ${labelClass}`}>License Number</span>
                        <p className={valueClass}>{mvrResult.licenseNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <span className={`text-sm ${labelClass}`}>State</span>
                        <p className={valueClass}>{mvrResult.licenseState || 'N/A'}</p>
                      </div>
                      <div>
                        <span className={`text-sm ${labelClass}`}>Status</span>
                        <p className={`font-semibold ${getStatusColor(mvrResult.licenseStatus, theme)}`}>
                          {mvrResult.licenseStatus || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <span className={`text-sm ${labelClass}`}>Expiration</span>
                        <p className={valueClass}>{formatDate(mvrResult.licenseExpirationDate)}</p>
                      </div>
                    </div>

                    {/* Multiple License Classes (CDL drivers often have B, C, D) */}
                    {mvrResult.licenses && mvrResult.licenses.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-200/30">
                        <h4 className={`text-md font-semibold mb-3 ${headingClass}`}>
                          License Classes
                        </h4>
                        <div className="space-y-3">
                          {mvrResult.licenses.map((license, idx) => (
                            <div 
                              key={idx}
                              className={`p-3 rounded-lg ${
                                theme === 'light' ? 'bg-gray-50' : 'bg-brand-sage-light/20'
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${
                                    license.type?.toLowerCase().includes('commercial')
                                      ? 'text-blue-600'
                                      : theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                                  }`}>
                                    Class {license.class || '?'}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    license.type?.toLowerCase().includes('commercial')
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {license.type || 'Unknown'}
                                  </span>
                                </div>
                                <span className={`text-sm font-medium ${getStatusColor(license.status, theme)}`}>
                                  {license.status || 'Unknown'}
                                </span>
                              </div>
                              {license.classDescription && (
                                <p className={`text-sm mt-1 ${labelClass}`}>
                                  {license.classDescription}
                                </p>
                              )}
                              {license.restrictions && (
                                <p className={`text-xs mt-2 ${labelClass}`}>
                                  <span className="font-medium">Restrictions:</span> {license.restrictions}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CDL Endorsements & Restrictions (shown if no detailed license blocks) */}
                    {(!mvrResult.licenses || mvrResult.licenses.length === 0) && (
                      <>
                        {(mvrResult.cdlEndorsements?.length > 0 || mvrResult.cdlRestrictions?.length > 0) && (
                          <div className="mt-6 pt-4 border-t border-gray-200/30 grid grid-cols-2 gap-4">
                            {mvrResult.cdlEndorsements?.length > 0 && (
                              <div>
                                <span className={`text-sm ${labelClass}`}>Endorsements</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {mvrResult.cdlEndorsements.map((e, i) => (
                                    <span key={i} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                      {e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {mvrResult.cdlRestrictions?.length > 0 && (
                              <div>
                                <span className={`text-sm ${labelClass}`}>Restrictions</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {mvrResult.cdlRestrictions.map((r, i) => (
                                    <span key={i} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Medical Certificate */}
                  {(mvrResult.medicalCertExpiration || mvrResult.medicalCertStatus) && (
                    <div className={`p-6 rounded-xl border ${cardClass}`}>
                      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                        <Stethoscope className="h-5 w-5 text-green-500" />
                        Medical Certificate
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className={`text-sm ${labelClass}`}>Status</span>
                          <p className={`font-semibold ${getStatusColor(mvrResult.medicalCertStatus, theme)}`}>
                            {mvrResult.medicalCertStatus || 'Unknown'}
                          </p>
                        </div>
                        {mvrResult.medicalCertIssueDate && (
                          <div>
                            <span className={`text-sm ${labelClass}`}>Issued</span>
                            <p className={valueClass}>{formatDate(mvrResult.medicalCertIssueDate)}</p>
                          </div>
                        )}
                        <div>
                          <span className={`text-sm ${labelClass}`}>Expiration</span>
                          <p className={valueClass}>{formatDate(mvrResult.medicalCertExpiration)}</p>
                        </div>
                        {mvrResult.medicalCertSelfCertification && (
                          <div>
                            <span className={`text-sm ${labelClass}`}>Self Certification</span>
                            <p className={`text-sm ${valueClass}`}>{mvrResult.medicalCertSelfCertification}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
                      <div className={`text-3xl font-bold ${
                        (mvrResult.totalPoints || 0) > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {mvrResult.totalPoints || 0}
                      </div>
                      <div className={`text-sm ${labelClass}`}>Points</div>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
                      <div className={`text-3xl font-bold ${
                        (mvrResult.violationCount || 0) > 0 ? 'text-orange-500' : 'text-green-500'
                      }`}>
                        {mvrResult.violationCount || 0}
                      </div>
                      <div className={`text-sm ${labelClass}`}>Violations</div>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
                      <div className={`text-3xl font-bold ${
                        (mvrResult.accidentCount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {mvrResult.accidentCount || 0}
                      </div>
                      <div className={`text-sm ${labelClass}`}>Accidents</div>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
                      <div className={`text-3xl font-bold ${
                        (mvrResult.suspensionCount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {mvrResult.suspensionCount || 0}
                      </div>
                      <div className={`text-sm ${labelClass}`}>Suspensions</div>
                    </div>
                  </div>

                  {/* Violations Detail */}
                  {mvrResult.violations && mvrResult.violations.length > 0 && (
                    <div className={`p-6 rounded-xl border ${cardClass}`}>
                      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Violations ({mvrResult.violations.length})
                      </h3>
                      <div className="space-y-3">
                        {mvrResult.violations.map((violation, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-lg border-l-4 border-orange-400 ${
                              theme === 'light' ? 'bg-orange-50' : 'bg-orange-900/20'
                            }`}
                          >
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div className="flex-1">
                                <p className={`font-medium ${headingClass}`}>
                                  {violation.description || violation.type || 'Violation'}
                                </p>
                                <div className={`text-sm mt-1 flex flex-wrap gap-3 ${labelClass}`}>
                                  {violation.date && (
                                    <span>Issue: {formatDate(violation.date)}</span>
                                  )}
                                  {violation.convictionDate && (
                                    <span>Conviction: {formatDate(violation.convictionDate)}</span>
                                  )}
                                  {violation.state && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {violation.state}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {violation.points !== undefined && violation.points > 0 && (
                                  <span className="text-sm font-bold text-red-600">
                                    {violation.points} pts
                                  </span>
                                )}
                                {(violation.acdCode || violation.stateCode) && (
                                  <span className={`text-xs ${labelClass}`}>
                                    {violation.state && `${violation.state}/`}{violation.acdCode || violation.stateCode}
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
                    <div className={`p-6 rounded-xl border ${cardClass}`}>
                      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                        <Car className="h-5 w-5 text-red-500" />
                        Accidents ({mvrResult.accidents.length})
                      </h3>
                      <div className="space-y-3">
                        {mvrResult.accidents.map((accident, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-lg border-l-4 border-red-400 ${
                              theme === 'light' ? 'bg-red-50' : 'bg-red-900/20'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className={`font-medium ${headingClass}`}>
                                  {accident.description || 'Accident'}
                                </p>
                                <p className={`text-sm ${labelClass}`}>
                                  {formatDate(accident.date)}
                                </p>
                              </div>
                              <div className="text-right">
                                {accident.severity && (
                                  <span className={`text-sm font-medium ${
                                    accident.severity.toLowerCase().includes('fatal') 
                                      ? 'text-red-600' 
                                      : 'text-orange-600'
                                  }`}>
                                    {accident.severity}
                                  </span>
                                )}
                                {accident.fault && (
                                  <p className={`text-xs ${labelClass}`}>
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
                    <div className={`p-6 rounded-xl border ${cardClass}`}>
                      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                        <XCircle className="h-5 w-5 text-red-500" />
                        Suspensions ({mvrResult.suspensions.length})
                      </h3>
                      <div className="space-y-3">
                        {mvrResult.suspensions.map((suspension, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-lg border-l-4 border-red-600 ${
                              theme === 'light' ? 'bg-red-50' : 'bg-red-900/20'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className={`font-medium ${headingClass}`}>
                                  {suspension.reason || 'Suspension'}
                                </p>
                                <p className={`text-sm ${labelClass}`}>
                                  From: {formatDate(suspension.date)}
                                  {suspension.endDate && ` → To: ${formatDate(suspension.endDate)}`}
                                </p>
                              </div>
                              {suspension.state && (
                                <span className={`text-sm flex items-center gap-1 ${labelClass}`}>
                                  <MapPin className="h-3 w-3" />
                                  {suspension.state}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Report Timestamp */}
                  <div className={`text-center text-xs ${labelClass}`}>
                    Report received: {new Date(mvrResult.receivedAt).toLocaleString()}
                    {mvrResult.parsedAt && ` • Processed: ${new Date(mvrResult.parsedAt).toLocaleString()}`}
                  </div>
                </>
              ) : (
                <div className={`p-6 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-yellow-900/20 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-yellow-600" />
                    <div>
                      <p className={`font-medium ${theme === 'light' ? 'text-yellow-800' : 'text-yellow-400'}`}>
                        MVR results are still processing
                      </p>
                      <p className={`text-sm ${theme === 'light' ? 'text-yellow-700' : 'text-yellow-500'}`}>
                        This typically takes a few minutes. Please check back later.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
