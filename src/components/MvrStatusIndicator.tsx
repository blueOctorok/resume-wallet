'use client'

import { useState, useEffect } from 'react'
import { FileText, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrStatusIndicatorProps {
  walletAddress: string | null
  onOpenManagement: () => void
}

interface MvrStatus {
  hasMvr: boolean
  hasPayment: boolean
  paymentPending?: boolean
  payments: Array<{
    id: string
    txHash: string
    amount: string
    status: string
    createdAt: string
  }>
  order: {
    id: string
    orderNumber: string
    status: string
    orderedAt: string
    paymentId: string | null
  } | null
  result: {
    id: string
    resultStatus: string
    receivedAt: string
    parsedAt: string | null
    licenseNumber: string | null
    licenseState: string | null
  } | null
}

export default function MvrStatusIndicator({ walletAddress, onOpenManagement }: MvrStatusIndicatorProps) {
  const { theme } = useTheme()
  const [mvrStatus, setMvrStatus] = useState<MvrStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false)
      return
    }

    const fetchMvrStatus = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/mvr/check-status?walletAddress=${encodeURIComponent(walletAddress)}`)
        
        if (!response.ok) {
          // For any non-OK response, default to "no MVR" state
          // This handles 404, 500, etc. gracefully
          setMvrStatus({ hasMvr: false, hasPayment: false, payments: [], order: null, result: null })
          setLoading(false)
          return
        }

        const data = await response.json()
        console.log('[MVR INDICATOR] Status fetched:', data)
        setMvrStatus(data)
      } catch (err: any) {
        // For network or other errors, default to "no MVR" state silently
        setMvrStatus({ hasMvr: false, hasPayment: false, payments: [], order: null, result: null })
      } finally {
        setLoading(false)
      }
    }

    fetchMvrStatus()

    // Refresh every 30 seconds to catch status updates
    const interval = setInterval(fetchMvrStatus, 30000)
    return () => clearInterval(interval)
  }, [walletAddress])

  const handleClick = () => {
    console.log('[MVR INDICATOR] Opening MVR Management Modal')
    onOpenManagement()
  }

  // Desktop only - hidden on mobile
  return (
    <div className="hidden lg:block fixed left-4 top-24 z-[60] pointer-events-none">
      <div
        onClick={handleClick}
        className={`pointer-events-auto cursor-pointer rounded-xl p-4 shadow-lg border transition-all hover:shadow-xl hover:scale-105 ${
          theme === 'light'
            ? 'bg-white/90 backdrop-blur-sm border-brand-sage/40'
            : 'bg-brand-sage-light/30 backdrop-blur-xl border-brand-mint/50'
        }`}
        style={{
          minWidth: '200px',
          maxWidth: '240px',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`flex-shrink-0 mt-0.5 ${
              loading
                ? 'text-gray-400'
                : mvrStatus?.paymentPending
                  ? 'text-orange-500'
                  : mvrStatus?.hasMvr
                    ? mvrStatus.result?.resultStatus === 'parsed'
                      ? 'text-green-500'
                      : 'text-yellow-500'
                    : 'text-gray-400'
            }`}
          >
            {loading ? (
              <Clock className="h-5 w-5 animate-pulse" />
            ) : mvrStatus?.paymentPending ? (
              <FileText className="h-5 w-5 animate-pulse" />
            ) : mvrStatus?.hasMvr ? (
              mvrStatus.result?.resultStatus === 'parsed' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5" />
              )
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm font-semibold mb-1 ${
                theme === 'light' ? 'text-gray-900' : 'text-brand-cream'
              }`}
            >
              MVR Status
            </div>

            {loading ? (
              <div
                className={`text-xs ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                Checking...
              </div>
            ) : error ? (
              <div
                className={`text-xs ${
                  theme === 'light' ? 'text-red-600' : 'text-red-400'
                }`}
              >
                Error loading
              </div>
            ) : mvrStatus?.paymentPending ? (
              <div className="space-y-1">
                <div
                  className={`text-xs font-medium ${
                    theme === 'light' ? 'text-orange-600' : 'text-orange-400'
                  }`}
                >
                  Payment Pending
                </div>
                <div
                  className={`text-xs ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {mvrStatus.payments.length} payment{mvrStatus.payments.length > 1 ? 's' : ''} • Complete order
                </div>
                <div
                  className={`text-xs underline mt-1 ${
                    theme === 'light'
                      ? 'text-brand-sage hover:text-brand-sage/80'
                      : 'text-brand-mint hover:text-brand-mint/80'
                  }`}
                >
                  Complete Order →
                </div>
              </div>
            ) : mvrStatus?.hasMvr ? (
              <div className="space-y-1">
                <div
                  className={`text-xs ${
                    theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  {mvrStatus.result?.resultStatus === 'parsed'
                    ? 'Available'
                    : mvrStatus.order?.status === 'pending'
                      ? 'Processing...'
                      : 'Ordered'}
                </div>
                {mvrStatus.result?.licenseNumber && (
                  <div
                    className={`text-xs ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {mvrStatus.result.licenseState} • {mvrStatus.result.licenseNumber.slice(0, 4)}...
                  </div>
                )}
                {mvrStatus.hasMvr && (
                  <div
                    className={`text-xs underline mt-1 ${
                      theme === 'light'
                        ? 'text-brand-sage hover:text-brand-sage/80'
                        : 'text-brand-mint hover:text-brand-mint/80'
                    }`}
                  >
                    View MVR →
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div
                  className={`text-xs ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  No payments or orders
                </div>
                <div
                  className={`text-xs underline mt-1 ${
                    theme === 'light'
                      ? 'text-brand-sage hover:text-brand-sage/80'
                      : 'text-brand-mint hover:text-brand-mint/80'
                  }`}
                >
                  Order MVR →
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

