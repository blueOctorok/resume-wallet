'use client'

import React, { useState } from 'react'
import {
  sendPayment,
  payForPremiumAnalysis,
  payForEmployerSubscription,
  payForResumeVerification,
  sendCustomPayment,
  checkPaymentStatus,
  pollPaymentStatus,
  formatPaymentStatus,
  isPaymentSuccessful,
  getPaymentErrorMessage,
  PaymentRequest,
  PaymentResult,
  PaymentError,
} from '@/lib/base-pay'

interface BasePayButtonProps {
  amount: string
  recipient: string
  onPaymentSuccess?: (result: PaymentResult) => void
  onPaymentError?: (error: PaymentError) => void
  onPaymentStatusUpdate?: (status: any) => void
  collectUserInfo?: boolean
  className?: string
  children?: React.ReactNode
}

export const BasePayButton: React.FC<BasePayButtonProps> = ({
  amount,
  recipient,
  onPaymentSuccess,
  onPaymentError,
  onPaymentStatusUpdate,
  collectUserInfo = false,
  className = '',
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string>('')

  const handlePayment = async () => {
    setIsLoading(true)
    setPaymentError(null)
    setPaymentResult(null)
    setPaymentStatus('')

    try {
      console.log('💳 Starting Base Pay payment...', { amount, recipient })

      // Create payment request
      const request: PaymentRequest = {
        amount,
        to: recipient,
        testnet: process.env.NODE_ENV !== 'production',
        payerInfo: collectUserInfo
          ? {
              requests: [
                { type: 'email', optional: false },
                { type: 'name', optional: true },
              ],
            }
          : undefined,
      }

      // Send payment
      const result = await sendPayment(request)

      console.log('✅ Payment initiated:', result)
      setPaymentResult(result)
      setPaymentStatus('Payment initiated successfully!')

      // Notify parent component
      onPaymentSuccess?.(result)

      // Start polling for payment status
      if (result.id) {
        setPaymentStatus('Checking payment status...')

        try {
          const finalStatus = await pollPaymentStatus(
            result.id,
            process.env.NODE_ENV !== 'production',
            30, // max attempts
            2000 // interval ms
          )

          console.log('📊 Final payment status:', finalStatus)
          setPaymentStatus(formatPaymentStatus(finalStatus))
          onPaymentStatusUpdate?.(finalStatus)

          if (isPaymentSuccessful(finalStatus)) {
            console.log('🎉 Payment completed successfully!')
          } else {
            console.log('❌ Payment failed or timed out')
          }
        } catch (statusError) {
          console.error('Error polling payment status:', statusError)
          setPaymentStatus('Payment initiated but status check failed')
        }
      }
    } catch (error: any) {
      console.error('❌ Payment failed:', error)
      const paymentError: PaymentError = {
        code: error.code || 500,
        message: error.message || 'Payment failed',
        stack: error.stack,
      }
      setPaymentError(paymentError)
      setPaymentStatus(
        `Payment failed: ${getPaymentErrorMessage(paymentError)}`
      )
      onPaymentError?.(paymentError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        onClick={handlePayment}
        disabled={isLoading}
        className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        {isLoading ? (
          <>
            <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            Processing...
          </>
        ) : (
          <>
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
              <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' />
            </svg>
            {children || `Pay ${amount} USDC`}
          </>
        )}
      </button>

      {paymentStatus && (
        <div
          className={`p-3 rounded-md text-sm ${
            paymentStatus.includes('✅')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : paymentStatus.includes('❌')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {paymentStatus}
        </div>
      )}

      {paymentResult && (
        <div className='p-3 bg-green-50 border border-green-200 rounded-md'>
          <p className='text-sm text-green-800'>
            <strong>Payment ID:</strong> {paymentResult.id}
          </p>
          {paymentResult.payerInfoResponses && (
            <div className='mt-2 text-xs text-green-700'>
              <p>
                <strong>User Info Collected:</strong>
              </p>
              {paymentResult.payerInfoResponses.email && (
                <p>Email: {paymentResult.payerInfoResponses.email}</p>
              )}
              {paymentResult.payerInfoResponses.name && (
                <p>
                  Name: {paymentResult.payerInfoResponses.name.firstName}{' '}
                  {paymentResult.payerInfoResponses.name.familyName}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {paymentError && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-800'>
            <strong>Error:</strong> {getPaymentErrorMessage(paymentError)}
          </p>
          {process.env.NODE_ENV === 'development' && paymentError.stack && (
            <details className='mt-2'>
              <summary className='text-xs text-red-600 cursor-pointer'>
                Stack trace
              </summary>
              <pre className='text-xs text-red-600 mt-1 whitespace-pre-wrap'>
                {paymentError.stack}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// Pre-configured payment buttons
export const PremiumAnalysisButton: React.FC<{
  onPaymentSuccess?: (result: PaymentResult) => void
}> = ({ onPaymentSuccess }) => (
  <BasePayButton
    amount='5.00'
    recipient={
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000'
    }
    onPaymentSuccess={onPaymentSuccess}
    collectUserInfo={true}
  >
    Pay $5.00 for Premium Analysis
  </BasePayButton>
)

export const EmployerSubscriptionButton: React.FC<{
  onPaymentSuccess?: (result: PaymentResult) => void
}> = ({ onPaymentSuccess }) => (
  <BasePayButton
    amount='29.99'
    recipient={
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000'
    }
    onPaymentSuccess={onPaymentSuccess}
    collectUserInfo={true}
  >
    Subscribe for $29.99/month
  </BasePayButton>
)

export const ResumeVerificationButton: React.FC<{
  onPaymentSuccess?: (result: PaymentResult) => void
}> = ({ onPaymentSuccess }) => (
  <BasePayButton
    amount='0.50'
    recipient={
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000'
    }
    onPaymentSuccess={onPaymentSuccess}
  >
    Pay $0.50 for Verification
  </BasePayButton>
)

export default BasePayButton
