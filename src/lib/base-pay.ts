/**
 * Base Pay Integration for Resume Wallet
 * Enables one-tap USDC payments with no fees
 */

import { pay, getPaymentStatus } from '@base-org/account'

export interface PaymentRequest {
  amount: string
  to: string
  testnet?: boolean
  payerInfo?: {
    requests: Array<{
      type:
        | 'email'
        | 'physicalAddress'
        | 'phoneNumber'
        | 'name'
        | 'onchainAddress'
      optional?: boolean
    }>
    callbackURL?: string
  }
}

export interface PaymentResult {
  id: string
  amount: string
  to: string
  payerInfoResponses?: {
    email?: string
    phoneNumber?: {
      number: string
      country: string
    }
    physicalAddress?: {
      address1: string
      city: string
      state: string
      postalCode: string
      country: string
      name: {
        firstName: string
        familyName: string
      }
    }
    name?: {
      firstName: string
      familyName: string
    }
    onchainAddress?: string
  }
}

export interface PaymentError {
  code: number
  message: string
  stack?: string
}

export interface PaymentStatus {
  status: 'completed' | 'pending' | 'failed' | 'not_found'
  id: string
  message: string
  sender?: string
  amount?: string
  recipient?: string
  error?: string
}

/**
 * Send USDC payment using Base Pay
 */
export const sendPayment = async (
  request: PaymentRequest
): Promise<PaymentResult> => {
  try {
    const result = await pay(request)
    return result as PaymentResult
  } catch (error: any) {
    console.error('Base Pay payment failed:', error)
    throw {
      code: error.code || 500,
      message: error.message || 'Payment failed',
      stack: error.stack,
    } as PaymentError
  }
}

/**
 * Premium resume analysis payment
 */
export const payForPremiumAnalysis = async (
  userEmail?: string
): Promise<PaymentResult> => {
  const request: PaymentRequest = {
    amount: '5.00',
    to:
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000',
    testnet: process.env.NODE_ENV !== 'production',
    payerInfo: {
      requests: [
        { type: 'email', optional: false },
        { type: 'name', optional: true },
      ],
    },
  }

  return await sendPayment(request)
}

/**
 * Employer subscription payment
 */
export const payForEmployerSubscription = async (): Promise<PaymentResult> => {
  const request: PaymentRequest = {
    amount: '29.99',
    to:
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000',
    testnet: process.env.NODE_ENV !== 'production',
    payerInfo: {
      requests: [
        { type: 'email', optional: false },
        { type: 'physicalAddress', optional: true },
        { type: 'phoneNumber', optional: true },
      ],
    },
  }

  return await sendPayment(request)
}

/**
 * Resume verification fee payment
 */
export const payForResumeVerification = async (): Promise<PaymentResult> => {
  const request: PaymentRequest = {
    amount: '0.50',
    to:
      process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ||
      '0x0000000000000000000000000000000000000000',
    testnet: process.env.NODE_ENV !== 'production',
  }

  return await sendPayment(request)
}

/**
 * Custom payment with specific amount and recipient
 */
export const sendCustomPayment = async (
  amount: string,
  recipient: string,
  collectInfo: boolean = false
): Promise<PaymentResult> => {
  const request: PaymentRequest = {
    amount,
    to: recipient,
    testnet: process.env.NODE_ENV !== 'production',
    payerInfo: collectInfo
      ? {
          requests: [
            { type: 'email', optional: false },
            { type: 'name', optional: true },
          ],
        }
      : undefined,
  }

  return await sendPayment(request)
}

/**
 * Check if Base Pay is available
 */
export const isBasePayAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).base
}

/**
 * Format payment amount for display
 */
export const formatPaymentAmount = (amount: string): string => {
  const num = parseFloat(amount)
  return num.toFixed(2)
}

/**
 * Validate payment amount
 */
export const validatePaymentAmount = (amount: string): boolean => {
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0 && num <= 10000 // Max $10,000
}

/**
 * Validate Ethereum address
 */
export const validateAddress = (address: string): boolean => {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Get payment status from transaction hash using Base Pay
 */
export const checkPaymentStatus = async (
  transactionId: string,
  testnet: boolean = false
): Promise<PaymentStatus> => {
  try {
    const status = await getPaymentStatus({
      id: transactionId,
      testnet: testnet,
    })
    return status
  } catch (error: any) {
    console.error('Error checking payment status:', error)
    throw {
      code: error.code || 500,
      message: error.message || 'Failed to check payment status',
      stack: error.stack,
    } as PaymentError
  }
}

/**
 * Poll payment status until completion or failure
 */
export const pollPaymentStatus = async (
  transactionId: string,
  testnet: boolean = false,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<PaymentStatus> => {
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const status = await checkPaymentStatus(transactionId, testnet)

      // Return immediately if completed, failed, or not found
      if (
        status.status === 'completed' ||
        status.status === 'failed' ||
        status.status === 'not_found'
      ) {
        return status
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      attempts++
    } catch (error) {
      console.error(
        `Payment status check attempt ${attempts + 1} failed:`,
        error
      )
      attempts++

      if (attempts >= maxAttempts) {
        throw error
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  // If we get here, we've exceeded max attempts
  throw new Error('Payment status check timed out')
}

/**
 * Payment error messages for user-friendly display
 */
export const getPaymentErrorMessage = (error: PaymentError): string => {
  switch (error.code) {
    case 4001:
      return 'Payment was cancelled by user'
    case 4002:
      return 'Payment was rejected'
    case 4100:
      return 'Unauthorized - please try again'
    case 4200:
      return 'Unsupported payment method'
    case 4900:
      return 'Unauthorized - please refresh and try again'
    default:
      return error.message || 'Payment failed. Please try again.'
  }
}

/**
 * Get user-friendly status message
 */
export const getStatusMessage = (status: PaymentStatus): string => {
  switch (status.status) {
    case 'completed':
      return 'Payment completed successfully!'
    case 'pending':
      return 'Payment is being processed...'
    case 'failed':
      return status.error || 'Payment failed'
    case 'not_found':
      return 'Transaction not found'
    default:
      return 'Unknown payment status'
  }
}

/**
 * Check if payment is in a final state
 */
export const isPaymentFinal = (status: PaymentStatus): boolean => {
  return (
    status.status === 'completed' ||
    status.status === 'failed' ||
    status.status === 'not_found'
  )
}

/**
 * Check if payment was successful
 */
export const isPaymentSuccessful = (status: PaymentStatus): boolean => {
  return status.status === 'completed'
}

/**
 * Format payment status for display
 */
export const formatPaymentStatus = (status: PaymentStatus): string => {
  const statusEmoji = {
    completed: '✅',
    pending: '⏳',
    failed: '❌',
    not_found: '❓',
  }

  return `${statusEmoji[status.status]} ${getStatusMessage(status)}`
}
