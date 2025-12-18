'use client'

import { useState, useEffect } from 'react'
import { X, FileText, DollarSign, Clock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrManagementModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  onOrderNew: () => void
  onCompleteOrder: (paymentTxHash: string) => void
  onViewMvr: (orderId: string) => void
}

interface Payment {
  id: string
  txHash: string
  amount: string
  status: string
  createdAt: string
}

interface Order {
  id: string
  orderNumber: string
  status: string
  orderedAt: string
  paymentId: string | null
  hasResult: boolean
}

interface MvrStatusData {
  hasMvr: boolean
  hasPayment: boolean
  paymentPending?: boolean
  payments: Payment[]
  orders: Order[]
}

export default function MvrManagementModal({
  isOpen,
  onClose,
  walletAddress,
  onOrderNew,
  onCompleteOrder,
  onViewMvr,
}: MvrManagementModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MvrStatusData | null>(null)

  useEffect(() => {
    if (!isOpen || !walletAddress) {
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch comprehensive MVR status
        const response = await fetch(`/api/mvr/check-status?walletAddress=${encodeURIComponent(walletAddress)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch MVR data')
        }

        const result = await response.json()
        
        // Transform the data to match our interface
        const transformedData: MvrStatusData = {
          hasMvr: result.hasMvr,
          hasPayment: result.hasPayment,
          paymentPending: result.paymentPending,
          payments: result.payments || [],
          orders: result.order ? [{
            id: result.order.id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            orderedAt: result.order.orderedAt,
            paymentId: result.order.paymentId,
            hasResult: !!result.result,
          }] : [],
        }

        setData(transformedData)
      } catch (err: any) {
        console.error('Error fetching MVR data:', err)
        setError(err.message || 'Failed to load MVR data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isOpen, walletAddress])

  if (!isOpen) return null

  const orphanedPayments = data?.payments.filter(p => 
    !data?.orders.some(o => o.paymentId === p.id)
  ) || []

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border scrollbar-hide-mobile ${
          theme === 'light'
            ? 'bg-white border-gray-300'
            : 'bg-gray-900/95 backdrop-blur-xl border-gray-700'
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${
            theme === 'light'
              ? 'bg-white border-gray-300'
              : 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-brand-sage/10' : 'bg-brand-mint/20'}`}>
              <FileText className={`h-6 w-6 ${theme === 'light' ? 'text-brand-sage' : 'text-brand-mint'}`} />
            </div>
            <h2
              className={`text-2xl font-bold ${
                theme === 'light' ? 'text-gray-900' : 'text-white'
              }`}
            >
              MVR Management
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
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Payments */}
                <div
                  className={`p-5 rounded-xl border-2 transition-all hover:scale-105 ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-300 shadow-lg'
                      : 'bg-gradient-to-br from-blue-950/40 to-blue-900/20 border-blue-700/50 shadow-2xl shadow-blue-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-blue-200' : 'bg-blue-900/50'}`}>
                      <DollarSign className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-blue-100'}`}>
                      Payments
                    </h3>
                  </div>
                  <p className={`text-3xl font-extrabold mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                    {data?.payments.length || 0}
                  </p>
                  <p className={`text-sm font-medium ${theme === 'light' ? 'text-blue-600' : 'text-blue-400/80'}`}>
                    ${data?.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2) || '0.00'} USDC
                  </p>
                </div>

                {/* Total Orders */}
                <div
                  className={`p-5 rounded-xl border-2 transition-all hover:scale-105 ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300 shadow-lg'
                      : 'bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-700/50 shadow-2xl shadow-emerald-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-emerald-200' : 'bg-emerald-900/50'}`}>
                      <FileText className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h3 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-emerald-100'}`}>
                      Orders
                    </h3>
                  </div>
                  <p className={`text-3xl font-extrabold mb-1 ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'}`}>
                    {data?.orders.length || 0}
                  </p>
                  <p className={`text-sm font-medium ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400/80'}`}>
                    {data?.orders.filter(o => o.hasResult).length || 0} completed
                  </p>
                </div>

                {/* Orphaned Payments */}
                {orphanedPayments.length > 0 && (
                  <div
                    className={`p-5 rounded-xl border-2 transition-all hover:scale-105 animate-pulse ${
                      theme === 'light'
                        ? 'bg-gradient-to-br from-amber-50 to-orange-100/50 border-amber-300 shadow-lg'
                        : 'bg-gradient-to-br from-amber-950/40 to-orange-900/20 border-amber-700/50 shadow-2xl shadow-amber-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-amber-200' : 'bg-amber-900/50'}`}>
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-amber-100'}`}>
                        Action Needed
                      </h3>
                    </div>
                    <p className={`text-3xl font-extrabold mb-1 ${theme === 'light' ? 'text-amber-700' : 'text-amber-300'}`}>
                      {orphanedPayments.length}
                    </p>
                    <p className={`text-sm font-medium ${theme === 'light' ? 'text-amber-600' : 'text-amber-400/80'}`}>
                      Pending completion
                    </p>
                  </div>
                )}
              </div>

              {/* Orphaned Payments Alert */}
              {orphanedPayments.length > 0 && (
                <div
                  className={`p-5 rounded-xl border-2 ${
                    theme === 'light'
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-400 shadow-lg'
                      : 'bg-gradient-to-r from-amber-950/50 to-orange-950/50 border-amber-700/60 shadow-2xl shadow-amber-900/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-amber-200' : 'bg-amber-900/60'}`}>
                      <AlertCircle className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold text-lg mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-amber-100'}`}>
                        {orphanedPayments.length} Payment{orphanedPayments.length > 1 ? 's' : ''} Awaiting Order Completion
                      </h4>
                      <p className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-700' : 'text-amber-200/80'}`}>
                        Complete the order form to process your MVR request and secure your Motor Vehicle Record.
                      </p>
                      <button
                        onClick={() => {
                          onCompleteOrder(orphanedPayments[0].txHash)
                          onClose()
                        }}
                        className={`px-6 py-3 rounded-lg font-bold transition-all hover:scale-105 shadow-lg ${
                          theme === 'light'
                            ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-gray-900 shadow-orange-500/50'
                        }`}
                      >
                        Complete Order Now →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {data && data.payments.length > 0 && (
                <div
                  className={`p-5 rounded-xl border-2 ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-300 shadow-lg'
                      : 'bg-gray-800/50 border-gray-700 shadow-2xl'
                  }`}
                >
                  <h3
                    className={`text-lg font-bold mb-4 flex items-center gap-3 ${
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-blue-100' : 'bg-blue-900/50'}`}>
                      <DollarSign className="h-5 w-5 text-blue-400" />
                    </div>
                    Payment History
                  </h3>
                  <div className="space-y-3">
                    {data.payments.map((payment) => {
                      const isOrphaned = !data.orders.some(o => o.paymentId === payment.id)
                      return (
                        <div
                          key={payment.id}
                          className={`p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                            isOrphaned
                              ? theme === 'light'
                                ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
                                : 'bg-gradient-to-r from-amber-950/30 to-orange-950/30 border-amber-700/40'
                              : theme === 'light'
                                ? 'bg-white border-gray-300'
                                : 'bg-gray-800/30 border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                                ${payment.amount} USDC
                              </span>
                              {isOrphaned && (
                                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  Needs Order
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-semibold ${
                                payment.status === 'completed'
                                  ? theme === 'light'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-green-900/40 text-green-400 border border-green-700/30'
                                  : theme === 'light'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/30'
                              }`}
                            >
                              {payment.status}
                            </span>
                          </div>
                          <div className={`text-sm space-y-2 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Transaction:</span>
                              <code className={`px-2 py-1 rounded font-mono text-xs ${
                                theme === 'light' ? 'bg-gray-200' : 'bg-gray-900/50 border border-gray-700'
                              }`}>
                                {payment.txHash.slice(0, 12)}...{payment.txHash.slice(-10)}
                              </code>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{new Date(payment.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Order History */}
              {data && data.orders.length > 0 ? (
                <div
                  className={`p-5 rounded-xl border-2 ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-300 shadow-lg'
                      : 'bg-gray-800/50 border-gray-700 shadow-2xl'
                  }`}
                >
                  <h3
                    className={`text-lg font-bold mb-4 flex items-center gap-3 ${
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-900/50'}`}>
                      <FileText className="h-5 w-5 text-emerald-400" />
                    </div>
                    Order History
                  </h3>
                  <div className="space-y-3">
                    {data.orders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-5 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                          order.hasResult
                            ? theme === 'light'
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300'
                              : 'bg-gradient-to-r from-emerald-950/30 to-green-950/30 border-emerald-700/40'
                            : theme === 'light'
                              ? 'bg-white border-gray-300'
                              : 'bg-gray-800/30 border-gray-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                              Order #{order.orderNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {order.hasResult ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <Clock className="h-5 w-5 text-amber-400" />
                            )}
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-semibold ${
                                order.hasResult
                                  ? theme === 'light'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/30'
                                  : theme === 'light'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-amber-900/40 text-amber-400 border border-amber-700/30'
                              }`}
                            >
                              {order.hasResult ? 'Available' : 'Processing'}
                            </span>
                          </div>
                        </div>
                        <div className={`text-sm mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                          <Clock className="h-4 w-4" />
                          <span>Ordered: {new Date(order.orderedAt).toLocaleString()}</span>
                        </div>
                        {order.hasResult && (
                          <button
                            onClick={() => {
                              onViewMvr(order.id)
                              onClose()
                            }}
                            className={`px-6 py-3 rounded-lg font-bold transition-all hover:scale-105 shadow-lg flex items-center gap-2 ${
                              theme === 'light'
                                ? 'bg-gradient-to-r from-brand-sage to-emerald-600 hover:from-brand-sage-dark hover:to-emerald-700 text-white'
                                : 'bg-gradient-to-r from-brand-mint to-emerald-400 hover:from-brand-mint/90 hover:to-emerald-300 text-gray-900 shadow-emerald-500/50'
                            }`}
                          >
                            <FileText className="h-5 w-5" />
                            View MVR Report →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`p-12 rounded-xl border-2 border-dashed text-center ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-400'
                      : 'bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700'
                  }`}
                >
                  <div className={`p-4 rounded-full mx-auto mb-4 w-fit ${
                    theme === 'light' ? 'bg-gray-200' : 'bg-gray-800'
                  }`}>
                    <FileText className={`h-16 w-16 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`} />
                  </div>
                  <p className={`text-xl font-bold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    No MVR Orders Yet
                  </p>
                  <p className={`text-sm mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    Order your first Motor Vehicle Record to get started
                  </p>
                  <button
                    onClick={() => {
                      onOrderNew()
                      onClose()
                    }}
                    className={`px-8 py-4 rounded-lg font-bold transition-all hover:scale-105 shadow-xl ${
                      theme === 'light'
                        ? 'bg-gradient-to-r from-brand-sage to-emerald-600 hover:from-brand-sage-dark hover:to-emerald-700 text-white'
                        : 'bg-gradient-to-r from-brand-mint to-emerald-400 hover:from-brand-mint/90 hover:to-emerald-300 text-gray-900 shadow-emerald-500/50'
                    }`}
                  >
                    Order Your First MVR →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

