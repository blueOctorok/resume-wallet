/**
 * Alchemy Token API Integration
 * Supports both Base Mainnet and Base Sepolia USDC balance checking
 */

import { Alchemy, Network } from 'alchemy-sdk'

// Base Mainnet USDC contract address
export const BASE_MAINNET_USDC_ADDRESS =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Base Sepolia USDC contract address
export const BASE_SEPOLIA_USDC_ADDRESS =
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e'

// Determine which network to use (default to Mainnet for production)
const USE_MAINNET = process.env.NEXT_PUBLIC_USE_BASE_MAINNET !== 'false' // Default to true/mainnet
const NETWORK = USE_MAINNET ? Network.BASE_MAINNET : Network.BASE_SEPOLIA
const USDC_ADDRESS = USE_MAINNET ? BASE_MAINNET_USDC_ADDRESS : BASE_SEPOLIA_USDC_ADDRESS

// Environment variables
const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'

if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is required for Token API')
}

// Alchemy SDK configuration for Mainnet
const alchemySettingsMainnet = {
  apiKey: ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
}

// Alchemy SDK configuration for Sepolia
const alchemySettingsSepolia = {
  apiKey: ALCHEMY_API_KEY,
  network: Network.BASE_SEPOLIA,
}

export const alchemySDKMainnet = new Alchemy(alchemySettingsMainnet)
export const alchemySDKSepolia = new Alchemy(alchemySettingsSepolia)

// Default SDK (for backwards compatibility)
export const alchemySDK = USE_MAINNET ? alchemySDKMainnet : alchemySDKSepolia

console.log(`🪙 Alchemy Token API initialized for both Base Mainnet and Base Sepolia`)

/**
 * Get USDC balance for a wallet address on Base Mainnet
 */
export async function getUSDCBalanceMainnet(walletAddress: string): Promise<{
  balance: string
  balanceFormatted: string
  decimals: number
  symbol: string
  success: boolean
  error?: string
}> {
  try {
    const balances = await alchemySDKMainnet.core.getTokenBalances(walletAddress, [
      BASE_MAINNET_USDC_ADDRESS,
    ])

    const metadata = await alchemySDKMainnet.core.getTokenMetadata(
      BASE_MAINNET_USDC_ADDRESS
    )
    
    return parseUSDCBalanceResponse(balances, metadata)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get Base Mainnet USDC balance:', errorMessage)
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
 * Get USDC balance for a wallet address on Base Sepolia
 */
export async function getUSDCBalanceSepolia(walletAddress: string): Promise<{
  balance: string
  balanceFormatted: string
  decimals: number
  symbol: string
  success: boolean
  error?: string
}> {
  try {
    const balances = await alchemySDKSepolia.core.getTokenBalances(walletAddress, [
      BASE_SEPOLIA_USDC_ADDRESS,
    ])

    const metadata = await alchemySDKSepolia.core.getTokenMetadata(
      BASE_SEPOLIA_USDC_ADDRESS
    )
    
    return parseUSDCBalanceResponse(balances, metadata)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get Base Sepolia USDC balance:', errorMessage)
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
 * Helper function to parse USDC balance response
 */
function parseUSDCBalanceResponse(balances: any, metadata: any): {
  balance: string
  balanceFormatted: string
  decimals: number
  symbol: string
  success: boolean
  error?: string
} {
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
}

/**
 * Get USDC balance for a wallet address (defaults to configured network)
 * @deprecated Use getUSDCBalanceMainnet or getUSDCBalanceSepolia for clarity
 */
export async function getUSDCBalance(walletAddress: string): Promise<{
  balance: string
  balanceFormatted: string
  decimals: number
  symbol: string
  success: boolean
  error?: string
}> {
  // Use the configured network for backwards compatibility
  return USE_MAINNET 
    ? getUSDCBalanceMainnet(walletAddress)
    : getUSDCBalanceSepolia(walletAddress)
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
  network: NETWORK,
  usdcAddress: USDC_ADDRESS,
  isMainnet: USE_MAINNET,
  sdk: alchemySDK,
}
