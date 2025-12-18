'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Calendar, MapPin, CreditCard, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
}

interface MvrResult {
  id: string
  licenseNumber: string | null
  licenseState: string | null
  licenseClass: string | null
  licenseStatus: string | null
  licenseExpirationDate: string | null
  totalPoints: number | null
  violationCount: number | null
  accidentCount: number | null
  suspensionCount: number | null
  resultStatus: string
  receivedAt: string
  parsedAt: string | null
  parsedData?: any
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
                setMvrResult({
                  id: statusData.result.id,
                  licenseNumber: statusData.result.licenseNumber,
                  licenseState: statusData.result.licenseState,
                  licenseClass: statusData.result.licenseClass,
                  licenseStatus: statusData.result.licenseStatus,
                  licenseExpirationDate: statusData.result.licenseExpirationDate,
                  totalPoints: statusData.result.totalPoints,
                  violationCount: statusData.result.violationCount,
                  accidentCount: statusData.result.accidentCount,
                  suspensionCount: statusData.result.suspensionCount,
                  resultStatus: statusData.result.resultStatus,
                  receivedAt: statusData.result.receivedAt,
                  parsedAt: statusData.result.parsedAt,
                })
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border ${
          theme === 'light'
            ? 'bg-white border-gray-200'
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
            <h2
              className={`text-2xl font-bold ${
                theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
              }`}
            >
              MVR Report
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
              <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Loading MVR data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <p className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>{error}</p>
            </div>
          ) : (
            <>
              {/* Payment History */}
              {payments.length > 0 && (
                <div
                  className={`p-4 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-blue-900/20 border-blue-500/30'
                  }`}
                >
                  <h3
                    className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    Payment History ({payments.length})
                  </h3>
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <div
                        key={payment.id}
                        className={`p-3 rounded-lg text-sm ${
                          theme === 'light'
                            ? 'bg-white border border-blue-100'
                            : 'bg-brand-sage-light/30 border border-blue-500/20'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-brand-cream'}`}>
                            Payment #{idx + 1}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              payment.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>
                        <div className={`text-xs space-y-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                          <div>Amount: ${payment.amount} USDC</div>
                          <div>Tx: {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}</div>
                          <div>Date: {new Date(payment.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Information */}
              {mvrOrder && (
                <div
                  className={`p-4 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-brand-sage-light/20 border-brand-mint/30'
                  }`}
                >
                  <h3
                    className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    Order Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Order Number:</span>
                      <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                        {mvrOrder.orderNumber}
                      </p>
                    </div>
                    <div>
                      <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Status:</span>
                      <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                        {mvrOrder.status}
                      </p>
                    </div>
                    <div>
                      <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Ordered:</span>
                      <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                        {new Date(mvrOrder.orderedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MVR Results */}
              {mvrResult ? (
                <div
                  className={`p-4 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-brand-sage-light/20 border-brand-mint/30'
                  }`}
                >
                  <h3
                    className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    License Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {mvrResult.licenseNumber && (
                      <div>
                        <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>License Number:</span>
                        <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                          {mvrResult.licenseNumber}
                        </p>
                      </div>
                    )}
                    {mvrResult.licenseState && (
                      <div>
                        <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>State:</span>
                        <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                          {mvrResult.licenseState}
                        </p>
                      </div>
                    )}
                    {mvrResult.licenseClass && (
                      <div>
                        <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Class:</span>
                        <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                          {mvrResult.licenseClass}
                        </p>
                      </div>
                    )}
                    {mvrResult.licenseStatus && (
                      <div>
                        <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Status:</span>
                        <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                          {mvrResult.licenseStatus}
                        </p>
                      </div>
                    )}
                    {mvrResult.licenseExpirationDate && (
                      <div>
                        <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Expiration:</span>
                        <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                          {new Date(mvrResult.licenseExpirationDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary Stats */}
                  {(mvrResult.totalPoints !== null ||
                    mvrResult.violationCount !== null ||
                    mvrResult.accidentCount !== null ||
                    mvrResult.suspensionCount !== null) && (
                    <div className="mt-4 pt-4 border-t border-gray-200/30">
                      <h4
                        className={`text-md font-semibold mb-2 ${
                          theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
                        }`}
                      >
                        Summary
                      </h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        {mvrResult.totalPoints !== null && (
                          <div>
                            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Points:</span>
                            <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                              {mvrResult.totalPoints}
                            </p>
                          </div>
                        )}
                        {mvrResult.violationCount !== null && (
                          <div>
                            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Violations:</span>
                            <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                              {mvrResult.violationCount}
                            </p>
                          </div>
                        )}
                        {mvrResult.accidentCount !== null && (
                          <div>
                            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Accidents:</span>
                            <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                              {mvrResult.accidentCount}
                            </p>
                          </div>
                        )}
                        {mvrResult.suspensionCount !== null && (
                          <div>
                            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Suspensions:</span>
                            <p className={theme === 'light' ? 'text-gray-900 font-medium' : 'text-brand-cream font-medium'}>
                              {mvrResult.suspensionCount}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {mvrResult.parsedAt && (
                    <div className="mt-4 pt-4 border-t border-gray-200/30">
                      <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                        Report received: {new Date(mvrResult.receivedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`p-4 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-yellow-900/20 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-yellow-600" />
                    <p className={theme === 'light' ? 'text-yellow-800' : 'text-yellow-400'}>
                      MVR results are still processing. Please check back later.
                    </p>
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

