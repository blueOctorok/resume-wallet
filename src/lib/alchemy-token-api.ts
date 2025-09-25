/**
 * Alchemy Token API Integration
 * Specifically configured for Base Sepolia USDC balance checking
 */

import { Alchemy, Network } from 'alchemy-sdk'

// Base Sepolia USDC contract address
export const BASE_SEPOLIA_USDC_ADDRESS =
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e'

// Environment variables
const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'

if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is required for Token API')
}

// Alchemy SDK configuration for Base Sepolia
const alchemySettings = {
  apiKey: ALCHEMY_API_KEY,
  network: Network.BASE_SEPOLIA, // Base Sepolia testnet
}

export const alchemySDK = new Alchemy(alchemySettings)

console.log('🪙 Alchemy Token API initialized for Base Sepolia')

/**
 * Get USDC balance for a wallet address
 */
export async function getUSDCBalance(walletAddress: string): Promise<{
  balance: string
  balanceFormatted: string
  decimals: number
  symbol: string
  success: boolean
  error?: string
}> {
  try {
    // Get token balances for the specific USDC contract
    const balances = await alchemySDK.core.getTokenBalances(walletAddress, [
      BASE_SEPOLIA_USDC_ADDRESS,
    ])

    // Get USDC token metadata
    const metadata = await alchemySDK.core.getTokenMetadata(
      BASE_SEPOLIA_USDC_ADDRESS
    )

    if (balances.tokenBalances.length === 0) {
      return {
        balance: '0',
        balanceFormatted: '0.00',
        decimals: 6,
        symbol: 'USDC',
        success: false,
        error: 'No USDC balance found',
      }
    }

    const usdcBalance = balances.tokenBalances[0]

    if (usdcBalance.error) {
      return {
        balance: '0',
        balanceFormatted: '0.00',
        decimals: 6,
        symbol: 'USDC',
        success: false,
        error: usdcBalance.error,
      }
    }

    // Convert hex balance to decimal
    const balanceHex = usdcBalance.tokenBalance || '0x0'
    const balanceBigInt = BigInt(balanceHex)
    const decimals = metadata.decimals || 6

    // Format balance (USDC has 6 decimals)
    const balanceFormatted = (
      Number(balanceBigInt) / Math.pow(10, decimals)
    ).toFixed(2)

    return {
      balance: balanceBigInt.toString(),
      balanceFormatted,
      decimals,
      symbol: metadata.symbol || 'USDC',
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get USDC balance:', errorMessage)

    return {
      balance: '0',
      balanceFormatted: '0.00',
      decimals: 6,
      symbol: 'USDC',
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Get all token balances for a wallet address
 */
export async function getAllTokenBalances(walletAddress: string): Promise<{
  address: string
  tokenBalances: Array<{
    contractAddress: string
    tokenBalance: string
    symbol?: string
    name?: string
    decimals?: number
    logo?: string
    balanceFormatted?: string
  }>
  success: boolean
  error?: string
}> {
  try {
    console.log(`🔍 Getting all token balances for: ${walletAddress}`)

    // Get all token balances (Alchemy will return common tokens)
    const balances = await alchemySDK.core.getTokenBalances(walletAddress)

    // Process each token balance
    const processedBalances = await Promise.all(
      balances.tokenBalances.map(async (tokenBalance) => {
        try {
          // Get token metadata
          const metadata = await alchemySDK.core.getTokenMetadata(
            tokenBalance.contractAddress
          )

          // Convert balance to formatted string
          const balanceHex = tokenBalance.tokenBalance || '0x0'
          const balanceBigInt = BigInt(balanceHex)
          const decimals = metadata.decimals || 18
          const balanceFormatted = (
            Number(balanceBigInt) / Math.pow(10, decimals)
          ).toFixed(decimals === 6 ? 2 : 6)

          return {
            contractAddress: tokenBalance.contractAddress,
            tokenBalance: tokenBalance.tokenBalance || '0x0',
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            logo: metadata.logo,
            balanceFormatted,
          }
        } catch (metadataError) {
          console.warn(
            `⚠️ Failed to get metadata for token ${tokenBalance.contractAddress}:`,
            metadataError
          )
          return {
            contractAddress: tokenBalance.contractAddress,
            tokenBalance: tokenBalance.tokenBalance || '0x0',
          }
        }
      })
    )

    console.log(`✅ Retrieved ${processedBalances.length} token balances`)

    return {
      address: walletAddress,
      tokenBalances: processedBalances,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get token balances:', errorMessage)

    return {
      address: walletAddress,
      tokenBalances: [],
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Get token metadata for any contract address
 */
export async function getTokenMetadata(contractAddress: string): Promise<{
  name?: string
  symbol?: string
  decimals?: number
  logo?: string
  success: boolean
  error?: string
}> {
  try {
    console.log(`🔍 Getting token metadata for: ${contractAddress}`)

    const metadata = await alchemySDK.core.getTokenMetadata(contractAddress)

    console.log(`✅ Token metadata:`, {
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
    })

    return {
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      logo: metadata.logo,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get token metadata:', errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Check if wallet has sufficient USDC for transaction
 */
export async function hasSufficientUSDC(
  walletAddress: string,
  requiredAmount: string
): Promise<{
  hasSufficient: boolean
  currentBalance: string
  requiredAmount: string
  shortfall?: string
  success: boolean
  error?: string
}> {
  try {
    const balanceResult = await getUSDCBalance(walletAddress)

    if (!balanceResult.success) {
      return {
        hasSufficient: false,
        currentBalance: '0.00',
        requiredAmount,
        success: false,
        error: balanceResult.error,
      }
    }

    const currentBalanceNum = parseFloat(balanceResult.balanceFormatted)
    const requiredAmountNum = parseFloat(requiredAmount)

    const hasSufficient = currentBalanceNum >= requiredAmountNum
    const shortfall = hasSufficient
      ? undefined
      : (requiredAmountNum - currentBalanceNum).toFixed(2)

    return {
      hasSufficient,
      currentBalance: balanceResult.balanceFormatted,
      requiredAmount,
      shortfall,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to check USDC sufficiency:', errorMessage)

    return {
      hasSufficient: false,
      currentBalance: '0.00',
      requiredAmount,
      success: false,
      error: errorMessage,
    }
  }
}

// Export configuration for other files
export const tokenAPIConfig = {
  apiKey: ALCHEMY_API_KEY,
  network: Network.BASE_SEPOLIA,
  usdcAddress: BASE_SEPOLIA_USDC_ADDRESS,
  sdk: alchemySDK,
}
