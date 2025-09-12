'use client'

import React, { useState, useEffect } from 'react'
import {
  checkPaymentStatus,
  formatPaymentStatus,
  isPaymentFinal,
  isPaymentSuccessful,
  PaymentStatus,
} from '@/lib/base-pay'

interface PaymentStatusTrackerProps {
  paymentId: string
  testnet?: boolean
  onStatusChange?: (status: PaymentStatus) => void
  onComplete?: (status: PaymentStatus) => void
  maxPollingAttempts?: number
  pollingInterval?: number
  className?: string
}

export const PaymentStatusTracker: React.FC<PaymentStatusTrackerProps> = ({
  paymentId,
  testnet = process.env.NODE_ENV !== 'production',
  onStatusChange,
  onComplete,
  maxPollingAttempts = 30,
  pollingInterval = 2000,
  className = '',
}) => {
  const [currentStatus, setCurrentStatus] = useState<PaymentStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string>('')
  const [pollingAttempts, setPollingAttempts] = useState(0)

  useEffect(() => {
    if (paymentId && !isPolling) {
      startPolling()
    }
  }, [paymentId])

  const startPolling = async () => {
    if (!paymentId) return

    setIsPolling(true)
    setError('')
    setPollingAttempts(0)

    try {
      let attempts = 0
      const pollInterval = setInterval(async () => {
        try {
          attempts++
          setPollingAttempts(attempts)

          console.log(
            `🔍 Checking payment status (attempt ${attempts}/${maxPollingAttempts}) for ID: ${paymentId}`
          )

          const status = await checkPaymentStatus(paymentId, testnet)
          console.log('📊 Payment status:', status)

          setCurrentStatus(status)
          onStatusChange?.(status)

          // Check if payment is in a final state
          if (isPaymentFinal(status)) {
            clearInterval(pollInterval)
            setIsPolling(false)
            onComplete?.(status)
            console.log('✅ Payment reached final state:', status.status)
            return
          }

          // Stop polling if we've reached max attempts
          if (attempts >= maxPollingAttempts) {
            clearInterval(pollInterval)
            setIsPolling(false)
            setError(
              `Payment status check timed out after ${maxPollingAttempts} attempts`
            )
            console.log('⏰ Payment status polling timed out')
            return
          }
        } catch (error: any) {
          console.error(
            `❌ Payment status check failed (attempt ${attempts}):`,
            error
          )

          if (attempts >= maxPollingAttempts) {
            clearInterval(pollInterval)
            setIsPolling(false)
            setError(`Failed to check payment status: ${error.message}`)
            return
          }
        }
      }, pollingInterval)
    } catch (error: any) {
      console.error('❌ Failed to start payment status polling:', error)
      setError(`Failed to start polling: ${error.message}`)
      setIsPolling(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'pending':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'not_found':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'pending':
        return '⏳'
      case 'failed':
        return '❌'
      case 'not_found':
        return '❓'
      default:
        return '❓'
    }
  }

  if (!paymentId) {
    return (
      <div
        className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}
      >
        <p className='text-sm text-gray-600'>No payment ID provided</p>
      </div>
    )
  }

  return (
    <div
      className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}
    >
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-sm font-medium text-gray-900'>Payment Status</h3>
        {isPolling && (
          <div className='flex items-center gap-2 text-xs text-blue-600'>
            <div className='w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin'></div>
            Polling... ({pollingAttempts}/{maxPollingAttempts})
          </div>
        )}
      </div>

      <div className='space-y-2'>
        {/* Payment ID */}
        <div className='text-xs text-gray-600'>
          <strong>Payment ID:</strong> {paymentId.slice(0, 8)}...
          {paymentId.slice(-8)}
        </div>

        {/* Current Status */}
        {currentStatus ? (
          <div
            className={`p-3 rounded-md border ${getStatusColor(currentStatus.status)}`}
          >
            <div className='flex items-center gap-2'>
              <span className='text-lg'>
                {getStatusIcon(currentStatus.status)}
              </span>
              <div>
                <p className='text-sm font-medium'>
                  {formatPaymentStatus(currentStatus)}
                </p>
                {currentStatus.message && (
                  <p className='text-xs opacity-75 mt-1'>
                    {currentStatus.message}
                  </p>
                )}
              </div>
            </div>

            {/* Additional status details */}
            {currentStatus.amount && (
              <div className='mt-2 text-xs opacity-75'>
                <strong>Amount:</strong> {currentStatus.amount} USDC
              </div>
            )}

            {currentStatus.sender && (
              <div className='mt-1 text-xs opacity-75'>
                <strong>From:</strong> {currentStatus.sender.slice(0, 6)}...
                {currentStatus.sender.slice(-4)}
              </div>
            )}

            {currentStatus.recipient && (
              <div className='mt-1 text-xs opacity-75'>
                <strong>To:</strong> {currentStatus.recipient.slice(0, 6)}...
                {currentStatus.recipient.slice(-4)}
              </div>
            )}

            {currentStatus.error && (
              <div className='mt-2 text-xs opacity-75'>
                <strong>Error:</strong> {currentStatus.error}
              </div>
            )}
          </div>
        ) : (
          <div className='p-3 bg-gray-50 border border-gray-200 rounded-md'>
            <div className='flex items-center gap-2'>
              <div className='w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
              <p className='text-sm text-gray-600'>
                Checking payment status...
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
            <p className='text-sm text-red-800'>{error}</p>
          </div>
        )}

        {/* Final Status Summary */}
        {currentStatus && isPaymentFinal(currentStatus) && (
          <div
            className={`p-3 rounded-md border ${
              isPaymentSuccessful(currentStatus)
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                isPaymentSuccessful(currentStatus)
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}
            >
              {isPaymentSuccessful(currentStatus)
                ? '🎉 Payment completed successfully!'
                : '❌ Payment failed or was not found'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaymentStatusTracker
