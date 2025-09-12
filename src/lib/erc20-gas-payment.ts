/**
 * ERC20 Gas Payment Integration
 * Allows users to pay transaction gas fees using USDC instead of ETH
 */

import { baseProvider } from './base-account-sdk'

// USDC contract address on Base Sepolia
export const USDC_CONTRACT_ADDRESS =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// ERC20 ABI for USDC contract (minimal set for balance, allowance, approve)
export const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
]

// Paymaster contract address (placeholder - replace with actual paymaster)
export const PAYMASTER_CONTRACT_ADDRESS =
  '0x0000000000000000000000000000000000000000'

export interface AcceptedToken {
  address: string
  symbol: string
  name: string
  decimals: number
  rate: string // Exchange rate to ETH
}

/**
 * Check USDC balance for a given address
 */
export const checkUSDCBalance = async (
  address: string,
  provider: any
): Promise<string> => {
  try {
    console.log('🔍 Checking USDC balance for:', address)

    const result = await provider.request({
      method: 'eth_call',
      params: [
        {
          to: USDC_CONTRACT_ADDRESS,
          data: `0x70a08231${address.slice(2).padStart(64, '0')}`, // balanceOf(address)
        },
        'latest',
      ],
    })

    const balance = BigInt(result)
    const formattedBalance = formatUSDCAmount(balance.toString())

    console.log('✅ USDC balance:', formattedBalance)
    return formattedBalance
  } catch (error) {
    console.error('❌ Failed to check USDC balance:', error)
    throw error
  }
}

/**
 * Check USDC allowance for paymaster
 */
export const checkUSDCAllowance = async (
  owner: string,
  provider: any
): Promise<string> => {
  try {
    console.log('🔍 Checking USDC allowance for paymaster...')

    const result = await provider.request({
      method: 'eth_call',
      params: [
        {
          to: USDC_CONTRACT_ADDRESS,
          data: `0xdd62ed3e${owner.slice(2).padStart(64, '0')}${PAYMASTER_CONTRACT_ADDRESS.slice(2).padStart(64, '0')}`, // allowance(owner, spender)
        },
        'latest',
      ],
    })

    const allowance = BigInt(result)
    const formattedAllowance = formatUSDCAmount(allowance.toString())

    console.log('✅ USDC allowance:', formattedAllowance)
    return formattedAllowance
  } catch (error) {
    console.error('❌ Failed to check USDC allowance:', error)
    throw error
  }
}

/**
 * Get accepted payment tokens from paymaster
 */
export const getAcceptedTokens = async (): Promise<AcceptedToken[]> => {
  try {
    console.log('🔍 Getting accepted tokens from paymaster...')

    // This would typically call a paymaster API or contract method
    // For now, return USDC as accepted token
    const acceptedTokens: AcceptedToken[] = [
      {
        address: USDC_CONTRACT_ADDRESS,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        rate: '1.0', // 1 USDC = 1 USD worth of ETH
      },
    ]

    console.log('✅ Accepted tokens:', acceptedTokens)
    return acceptedTokens
  } catch (error) {
    console.error('❌ Failed to get accepted tokens:', error)
    throw error
  }
}

/**
 * Get paymaster data for ERC20 gas payment
 */
export const getPaymasterData = async (
  userOperation: any,
  tokenAddress: string,
  tokenAmount: string
): Promise<any> => {
  try {
    console.log('🔍 Getting paymaster data for ERC20 payment...', {
      tokenAddress,
      tokenAmount,
    })

    // This would typically call a paymaster service
    // For now, return placeholder data
    const paymasterData = {
      paymaster: PAYMASTER_CONTRACT_ADDRESS,
      paymasterData: '0x', // Encoded paymaster data
      paymasterVerificationGasLimit: '100000',
      paymasterPostOpGasLimit: '100000',
    }

    console.log('✅ Paymaster data:', paymasterData)
    return paymasterData
  } catch (error) {
    console.error('❌ Failed to get paymaster data:', error)
    throw error
  }
}

/**
 * Create USDC approval transaction
 */
export const createUSDCApprovalTransaction = async (
  owner: string,
  amount: string,
  provider: any
): Promise<any> => {
  try {
    console.log('🔐 Creating USDC approval transaction...', { owner, amount })

    // Encode approve function call
    const approveData = `0x095ea7b3${PAYMASTER_CONTRACT_ADDRESS.slice(2).padStart(64, '0')}${parseUSDCAmount(amount).toString(16).padStart(64, '0')}`

    const transaction = {
      from: owner,
      to: USDC_CONTRACT_ADDRESS,
      data: approveData,
      gas: '100000', // Estimated gas for approval
      gasPrice: '0x0', // Will be set by wallet
    }

    console.log('✅ USDC approval transaction created:', transaction)
    return transaction
  } catch (error) {
    console.error('❌ Failed to create USDC approval transaction:', error)
    throw error
  }
}

/**
 * Format USDC amount for display (6 decimals)
 */
export const formatUSDCAmount = (amount: string): string => {
  const num = BigInt(amount)
  const decimals = BigInt(10 ** 6) // USDC has 6 decimals
  const wholePart = num / decimals
  const fractionalPart = num % decimals

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString()
  }

  const fractionalStr = fractionalPart.toString().padStart(6, '0')
  const trimmedFractional = fractionalStr.replace(/0+$/, '')

  return trimmedFractional
    ? `${wholePart}.${trimmedFractional}`
    : wholePart.toString()
}

/**
 * Parse USDC amount from display format to wei format
 */
export const parseUSDCAmount = (amount: string): string => {
  const [whole, fractional] = amount.split('.')
  const wholePart = BigInt(whole || '0')
  const fractionalPart = BigInt((fractional || '0').padEnd(6, '0').slice(0, 6))
  const decimals = BigInt(10 ** 6)

  return (wholePart * decimals + fractionalPart).toString()
}

/**
 * Convert ETH amount to equivalent USDC amount
 * This is a simplified conversion - in production you'd use an oracle
 */
export const convertETHToUSDC = (
  ethAmount: string,
  ethPrice: number = 2000
): string => {
  const ethNum = parseFloat(ethAmount)
  const usdcAmount = ethNum * ethPrice
  return usdcAmount.toFixed(6)
}

/**
 * Check if user has sufficient USDC balance for gas payment
 */
export const hasSufficientUSDCBalance = async (
  userAddress: string,
  requiredAmount: string,
  provider: any
): Promise<boolean> => {
  try {
    const balance = await checkUSDCBalance(userAddress, provider)
    const balanceNum = parseFloat(formatUSDCAmount(parseUSDCAmount(balance)))
    const requiredNum = parseFloat(requiredAmount)

    return balanceNum >= requiredNum
  } catch (error) {
    console.error('❌ Failed to check USDC balance:', error)
    return false
  }
}

/**
 * Check if user has sufficient USDC allowance for paymaster
 */
export const hasSufficientUSDCAllowance = async (
  userAddress: string,
  requiredAmount: string,
  provider: any
): Promise<boolean> => {
  try {
    const allowance = await checkUSDCAllowance(userAddress, provider)
    const allowanceNum = parseFloat(
      formatUSDCAmount(parseUSDCAmount(allowance))
    )
    const requiredNum = parseFloat(requiredAmount)

    return allowanceNum >= requiredNum
  } catch (error) {
    console.error('❌ Failed to check USDC allowance:', error)
    return false
  }
}

/**
 * Get gas estimation for USDC approval transaction
 */
export const estimateUSDCApprovalGas = async (
  userAddress: string,
  amount: string,
  provider: any
): Promise<string> => {
  try {
    const transaction = await createUSDCApprovalTransaction(
      userAddress,
      amount,
      provider
    )

    const gasEstimate = await provider.request({
      method: 'eth_estimateGas',
      params: [transaction],
    })

    console.log('✅ USDC approval gas estimate:', gasEstimate)
    return gasEstimate
  } catch (error) {
    console.error('❌ Failed to estimate USDC approval gas:', error)
    throw error
  }
}

/**
 * Create user operation with ERC20 gas payment
 */
export const createERC20GasUserOperation = async (
  userOperation: any,
  tokenAddress: string,
  tokenAmount: string
): Promise<any> => {
  try {
    console.log('🔧 Creating user operation with ERC20 gas payment...')

    const paymasterData = await getPaymasterData(
      userOperation,
      tokenAddress,
      tokenAmount
    )

    const erc20UserOperation = {
      ...userOperation,
      paymaster: paymasterData.paymaster,
      paymasterData: paymasterData.paymasterData,
      paymasterVerificationGasLimit:
        paymasterData.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: paymasterData.paymasterPostOpGasLimit,
    }

    console.log('✅ ERC20 gas user operation created:', erc20UserOperation)
    return erc20UserOperation
  } catch (error) {
    console.error('❌ Failed to create ERC20 gas user operation:', error)
    throw error
  }
}
