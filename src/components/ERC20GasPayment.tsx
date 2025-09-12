'use client'

import React, { useState, useEffect } from 'react'
import {
  checkUSDCBalance,
  checkUSDCAllowance,
  getAcceptedTokens,
  getPaymasterData,
  createUSDCApprovalTransaction,
  formatUSDCAmount,
  parseUSDCAmount,
  USDC_CONTRACT_ADDRESS,
} from '@/lib/erc20-gas-payment'
import { baseProvider } from '@/lib/base-account-sdk'

interface ERC20GasPaymentProps {
  gasAmount?: string // Amount of ETH equivalent to pay in USDC
  onPaymentMethodSelected?: (method: 'ETH' | 'USDC') => void
  onTransactionCreated?: (transaction: any) => void
  className?: string
}

export const ERC20GasPayment: React.FC<ERC20GasPaymentProps> = ({
  gasAmount = '0.001', // Default to 0.001 ETH worth of gas
  onPaymentMethodSelected,
  onTransactionCreated,
  className = '',
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'ETH' | 'USDC'>('ETH')
  const [usdcBalance, setUsdcBalance] = useState<string>('0')
  const [usdcAllowance, setUsdcAllowance] = useState<string>('0')
  const [acceptedTokens, setAcceptedTokens] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [userAddress, setUserAddress] = useState<string>('')

  // Get user address on component mount
  useEffect(() => {
    const getUserAddress = async () => {
      if (!baseProvider) return

      try {
        const accounts = await baseProvider.request({ method: 'eth_accounts' })
        if (accounts && accounts.length > 0) {
          setUserAddress(accounts[0])
        }
      } catch (error) {
        console.error('Failed to get user address:', error)
      }
    }

    getUserAddress()
  }, [])

  // Check USDC balance and allowance when user address is available
  useEffect(() => {
    if (userAddress && baseProvider) {
      checkUSDCInfo()
    }
  }, [userAddress])

  const checkUSDCInfo = async () => {
    if (!userAddress || !baseProvider) return

    setIsLoading(true)
    setError('')

    try {
      console.log('🔍 Checking USDC balance and allowance...')

      // Check USDC balance
      const balance = await checkUSDCBalance(userAddress, baseProvider)
      setUsdcBalance(balance)

      // Check USDC allowance for paymaster
      const allowance = await checkUSDCAllowance(userAddress, baseProvider)
      setUsdcAllowance(allowance)

      // Get accepted tokens from paymaster
      const tokens = await getAcceptedTokens()
      setAcceptedTokens(tokens)

      console.log('✅ USDC info:', {
        balance,
        allowance,
        acceptedTokens: tokens.length,
      })
    } catch (error: any) {
      console.error('❌ Failed to check USDC info:', error)
      setError(`Failed to check USDC info: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMethodChange = (method: 'ETH' | 'USDC') => {
    setSelectedMethod(method)
    onPaymentMethodSelected?.(method)
  }

  const handleApproveUSDC = async () => {
    if (!userAddress || !baseProvider) return

    setIsLoading(true)
    setError('')

    try {
      console.log('🔐 Creating USDC approval transaction...')

      // Calculate required USDC amount for gas
      const gasAmountInWei = parseUSDCAmount(gasAmount)

      // Create approval transaction
      const approvalTx = await createUSDCApprovalTransaction(
        userAddress,
        gasAmountInWei,
        baseProvider
      )

      console.log('✅ USDC approval transaction created:', approvalTx)
      onTransactionCreated?.(approvalTx)

      // Update allowance after approval
      await checkUSDCInfo()
    } catch (error: any) {
      console.error('❌ Failed to create USDC approval:', error)
      setError(`Failed to create approval: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const needsApproval = () => {
    const gasAmountInWei = parseUSDCAmount(gasAmount)
    const currentAllowance = parseUSDCAmount(usdcAllowance)
    return gasAmountInWei > currentAllowance
  }

  const hasSufficientUSDC = () => {
    const requiredAmount = parseUSDCAmount(gasAmount)
    const currentBalance = parseUSDCAmount(usdcBalance)
    return currentBalance >= requiredAmount
  }

  return (
    <div
      className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}
    >
      <h3 className='text-lg font-medium text-gray-900 mb-4'>
        Gas Payment Method
      </h3>

      {/* Payment Method Selection */}
      <div className='space-y-3'>
        <div className='flex space-x-4'>
          <label className='flex items-center'>
            <input
              type='radio'
              name='gasMethod'
              value='ETH'
              checked={selectedMethod === 'ETH'}
              onChange={() => handleMethodChange('ETH')}
              className='mr-2'
            />
            <span className='text-sm font-medium text-gray-700'>
              Pay with ETH
            </span>
          </label>
          <label className='flex items-center'>
            <input
              type='radio'
              name='gasMethod'
              value='USDC'
              checked={selectedMethod === 'USDC'}
              onChange={() => handleMethodChange('USDC')}
              className='mr-2'
            />
            <span className='text-sm font-medium text-gray-700'>
              Pay with USDC
            </span>
          </label>
        </div>

        {/* Gas Amount Display */}
        <div className='p-3 bg-gray-50 border border-gray-200 rounded-md'>
          <p className='text-sm text-gray-700'>
            <strong>Estimated Gas Cost:</strong> {gasAmount} ETH
            {selectedMethod === 'USDC' && (
              <span className='text-gray-500'>
                {' '}
                (≈ {formatUSDCAmount(parseUSDCAmount(gasAmount))} USDC)
              </span>
            )}
          </p>
        </div>

        {/* USDC Information */}
        {selectedMethod === 'USDC' && (
          <div className='space-y-3'>
            {/* USDC Balance */}
            <div className='p-3 bg-blue-50 border border-blue-200 rounded-md'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-blue-800'>
                  USDC Balance:
                </span>
                <span
                  className={`text-sm font-medium ${
                    hasSufficientUSDC() ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatUSDCAmount(parseUSDCAmount(usdcBalance))} USDC
                </span>
              </div>
              {!hasSufficientUSDC() && (
                <p className='text-xs text-red-600 mt-1'>
                  Insufficient USDC balance for gas payment
                </p>
              )}
            </div>

            {/* USDC Allowance */}
            <div className='p-3 bg-yellow-50 border border-yellow-200 rounded-md'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-yellow-800'>
                  Paymaster Allowance:
                </span>
                <span
                  className={`text-sm font-medium ${
                    !needsApproval() ? 'text-green-600' : 'text-orange-600'
                  }`}
                >
                  {formatUSDCAmount(parseUSDCAmount(usdcAllowance))} USDC
                </span>
              </div>
              {needsApproval() && (
                <p className='text-xs text-orange-600 mt-1'>
                  Approval required for gas payments
                </p>
              )}
            </div>

            {/* Approval Button */}
            {needsApproval() && hasSufficientUSDC() && (
              <button
                onClick={handleApproveUSDC}
                disabled={isLoading}
                className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isLoading ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    Creating Approval...
                  </>
                ) : (
                  <>
                    <svg
                      className='w-4 h-4'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' />
                    </svg>
                    Approve USDC for Gas
                  </>
                )}
              </button>
            )}

            {/* Accepted Tokens Info */}
            {acceptedTokens.length > 0 && (
              <div className='p-3 bg-green-50 border border-green-200 rounded-md'>
                <p className='text-sm font-medium text-green-800 mb-2'>
                  Accepted Tokens:
                </p>
                <div className='space-y-1'>
                  {acceptedTokens.map((token, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between text-xs'
                    >
                      <span className='text-green-700'>
                        {token.symbol || token.name}
                      </span>
                      <span className='text-green-600'>
                        {token.address?.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={checkUSDCInfo}
          disabled={isLoading || !userAddress}
          className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {isLoading ? (
            <>
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
              Checking...
            </>
          ) : (
            <>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
              Refresh USDC Info
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
            <p className='text-sm text-red-800'>{error}</p>
          </div>
        )}

        {/* Status Summary */}
        <div className='p-3 bg-gray-50 border border-gray-200 rounded-md'>
          <p className='text-xs text-gray-600'>
            <strong>Selected Method:</strong> {selectedMethod}
          </p>
          {selectedMethod === 'USDC' && (
            <>
              <p className='text-xs text-gray-600 mt-1'>
                <strong>Status:</strong>{' '}
                {!hasSufficientUSDC()
                  ? 'Insufficient USDC balance'
                  : needsApproval()
                    ? 'Approval required'
                    : 'Ready for USDC gas payment'}
              </p>
              <p className='text-xs text-gray-500 mt-1'>
                <strong>USDC Contract:</strong> {USDC_CONTRACT_ADDRESS}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ERC20GasPayment
