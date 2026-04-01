'use client'

import { useState, useEffect } from 'react'
import { FileText, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrStatusIndicatorProps {
  walletAddress: string | null
  onOpenManagement: () => void
  /**
   * Controls where the indicator is rendered so we can tweak layout without duplicating logic.
   * - 'sidebar': floating card on the left side (desktop only)
   * - 'nav-desktop': inline chip in the nav bottom row (desktop)
   * - 'nav-mobile': full-width item inside the mobile driver dropdown
   */
  placement?: 'sidebar' | 'nav-desktop' | 'nav-mobile'
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

export default function MvrStatusIndicator({
  walletAddress,
  onOpenManagement,
  placement = 'sidebar',
}: MvrStatusIndicatorProps) {
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
        // Only log in development to reduce terminal noise
        if (process.env.NODE_ENV === 'development') {
          console.log('[MVR INDICATOR] Status fetched:', {
            hasMvr: data.hasMvr,
            hasPayment: data.hasPayment,
            ordersCount: data.orders?.length || 0,
          })
        }
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

  // Placement-aware wrapper classes
  const wrapperClassName =
    placement === 'sidebar'
      ? 'hidden lg:block fixed left-4 top-24 z-[60] pointer-events-none'
      : placement === 'nav-desktop'
        ? 'hidden md:block'
        : 'block md:hidden w-full'

  // Compact styling for nav, slightly larger for sidebar
  // nav-mobile should match button styling (like Driver Options and Stormi buttons)
  const cardBaseClasses =
    placement === 'nav-desktop'
      ? 'cursor-pointer rounded-lg px-3.5 py-2.5 shadow-md border transition-all hover:shadow-lg hover:scale-105'
      : placement === 'nav-mobile'
        ? 'cursor-pointer w-full px-4 py-2 rounded-lg border transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105'
        : 'cursor-pointer rounded-xl p-4 shadow-lg border transition-all hover:shadow-xl hover:scale-105'

  const cardThemeClasses =
    placement === 'nav-mobile'
      ? theme !== 'dark'
        ? 'text-white bg-teal-600 hover:bg-teal-700 border-teal-600 hover:border-teal-700'
        : 'text-white bg-teal-600/80 hover:bg-teal-700 border-teal-500/50 hover:border-teal-500'
      : theme !== 'dark'
        ? 'bg-white/90 backdrop-blur-sm border-gray-300'
        : 'bg-gray-800/80 backdrop-blur-xl border-teal-500/50'

  const cardLayoutClasses =
    placement === 'nav-mobile'
      ? 'w-full'
      : placement === 'nav-desktop'
        ? ''
        : ''

  const cardClassName = `${cardBaseClasses} ${cardThemeClasses} ${cardLayoutClasses}`

  const cardStyle =
    placement === 'sidebar'
      ? {
          minWidth: '200px',
          maxWidth: '240px',
          pointerEvents: 'auto' as const,
        }
      : undefined

  return (
    <div className={wrapperClassName}>
      <div
        onClick={handleClick}
        className={cardClassName}
        style={cardStyle}
      >
        <div className={`flex items-center ${placement === 'nav-desktop' || placement === 'nav-mobile' ? 'gap-2.5' : 'gap-3'} ${placement === 'nav-mobile' ? 'justify-center' : ''}`}>
          {/* Icon - Hidden on mobile */}
          {placement !== 'nav-mobile' && (
            <div
              className={`flex-shrink-0 ${
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
                <Clock className={`${placement === 'nav-desktop' ? 'h-4.5 w-4.5' : 'h-5 w-5'} animate-pulse`} />
              ) : mvrStatus?.paymentPending ? (
                <FileText className={`${placement === 'nav-desktop' ? 'h-4.5 w-4.5' : 'h-5 w-5'} animate-pulse`} />
              ) : mvrStatus?.hasMvr ? (
                mvrStatus.result?.resultStatus === 'parsed' ? (
                  <CheckCircle2 className={placement === 'nav-desktop' ? 'h-4.5 w-4.5' : 'h-5 w-5'} />
                ) : (
                  <Clock className={placement === 'nav-desktop' ? 'h-4.5 w-4.5' : 'h-5 w-5'} />
                )
              ) : (
                <FileText className={placement === 'nav-desktop' ? 'h-4.5 w-4.5' : 'h-5 w-5'} />
              )}
            </div>
          )}

          {/* Content */}
          <div className={`${placement === 'nav-mobile' ? '' : 'flex-1'} min-w-0`}>
            {placement === 'sidebar' && (
              <div
                className={`text-sm font-semibold mb-0.5 ${
                  theme !== 'dark' ? 'text-gray-900' : 'text-brand-cream'
                }`}
              >
                MVR Status
              </div>
            )}

            {loading ? (
              <div
                className={`${placement === 'nav-mobile' ? 'text-xs' : 'text-sm'} font-medium ${
                  placement === 'nav-mobile'
                    ? ''
                    : theme !== 'dark' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                {placement === 'nav-mobile' ? 'MVR: Checking...' : 'Checking...'}
              </div>
            ) : error ? (
              <div
                className={`${placement === 'nav-mobile' ? 'text-xs' : 'text-sm'} font-medium ${
                  placement === 'nav-mobile'
                    ? ''
                    : theme !== 'dark' ? 'text-red-700' : 'text-red-400'
                }`}
              >
                {placement === 'nav-mobile' ? 'MVR: Error' : 'Error'}
              </div>
            ) : mvrStatus?.paymentPending ? (
              <div
                className={`${placement === 'nav-mobile' ? 'text-xs' : 'text-sm'} ${placement === 'nav-mobile' ? 'font-medium' : 'font-semibold'} ${
                  placement === 'nav-mobile'
                    ? ''
                    : theme !== 'dark' ? 'text-orange-700' : 'text-orange-400'
                }`}
              >
                {placement === 'nav-mobile' ? 'MVR: Payment Pending' : 'Payment Pending'}
              </div>
            ) : mvrStatus?.hasMvr ? (
              <div>
                <div
                  className={`${placement === 'nav-mobile' ? 'text-xs' : 'text-sm'} ${placement === 'nav-mobile' ? 'font-medium' : 'font-semibold'} ${
                    placement === 'nav-mobile'
                      ? ''
                      : theme !== 'dark' ? 'text-gray-900' : 'text-gray-200'
                  }`}
                >
                  {placement === 'nav-mobile'
                    ? `MVR: ${mvrStatus.result?.resultStatus === 'parsed'
                      ? 'Available'
                      : mvrStatus.order?.status === 'pending'
                        ? 'Processing'
                        : 'Ordered'}`
                    : mvrStatus.result?.resultStatus === 'parsed'
                      ? 'Available'
                      : mvrStatus.order?.status === 'pending'
                        ? 'Processing'
                        : 'Ordered'}
                </div>
                {placement === 'sidebar' && mvrStatus.result?.licenseNumber && (
                  <div
                    className={`text-xs mt-0.5 ${
                      theme !== 'dark' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {mvrStatus.result.licenseState} • {mvrStatus.result.licenseNumber.slice(0, 4)}...
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`${placement === 'nav-mobile' ? 'text-xs' : 'text-sm'} font-medium ${
                  placement === 'nav-mobile'
                    ? ''
                    : theme !== 'dark' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                {placement === 'nav-mobile' ? 'MVR: No Order' : 'No MVR'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

