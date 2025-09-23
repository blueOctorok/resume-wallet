/**
 * Alchemy Simulation API Integration
 *
 * Provides transaction simulation capabilities for:
 * - Contract deployment cost estimation
 * - Resume verification transaction previews
 * - Asset change analysis
 * - Error detection before sending transactions
 *
 * Based on Alchemy's alchemy_simulateAssetChanges endpoint
 */

import { Alchemy, Network } from 'alchemy-sdk'

// Base Sepolia USDC contract address
export const BASE_SEPOLIA_USDC_ADDRESS =
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e'

// Initialize Alchemy SDK for Base Sepolia
const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'

const alchemySettings = {
  apiKey: ALCHEMY_API_KEY,
  network: Network.BASE_SEPOLIA,
}

export const alchemySDK = new Alchemy(alchemySettings)

// Types for simulation responses (matching Alchemy SDK)
export interface AssetChange {
  assetType: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155' | 'SPECIAL_NFT'
  changeType: 'TRANSFER' | 'APPROVAL'
  from: string
  to: string
  rawAmount: string
  contractAddress: string | null
  tokenId: string | null
  decimals: number
  symbol: string
  name: string
  logo: string | null
  amount: string
}

export interface SimulationResult {
  changes: AssetChange[]
  gasUsed: string
  error: string | null
  success: boolean
  errorMessage?: string
}

export interface TransactionRequest {
  from: string
  to?: string
  value?: string
  data?: string
  gas?: string
  gasPrice?: string
}

/**
 * Simulate a transaction and return asset changes and gas usage
 */
export async function simulateTransaction(
  transaction: TransactionRequest
): Promise<SimulationResult> {
  try {
    console.log('🧪 Simulating transaction:', transaction)

    const result = await alchemySDK.transact.simulateAssetChanges(transaction)

    console.log('✅ Simulation successful:', result)

    return {
      changes: result.changes as AssetChange[],
      gasUsed: result.gasUsed || '0x0',
      error: result.error ? String(result.error) : null,
      success: !result.error,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown simulation error'
    console.error('❌ Simulation failed:', errorMessage)

    return {
      changes: [],
      gasUsed: '0x0',
      error: errorMessage,
      success: false,
      errorMessage,
    }
  }
}

/**
 * Simulate contract deployment
 */
export async function simulateContractDeployment(params: {
  from: string
  contractBytecode: string
  constructorArgs?: string
  value?: string
}): Promise<SimulationResult & { deploymentAddress?: string }> {
  try {
    const {
      from,
      contractBytecode,
      constructorArgs = '',
      value = '0x0',
    } = params

    // For contract deployment, 'to' is null/undefined
    const transaction: TransactionRequest = {
      from,
      value,
      data: contractBytecode + constructorArgs.replace('0x', ''),
    }

    console.log('🏗️ Simulating contract deployment:', transaction)

    const result = await simulateTransaction(transaction)

    return {
      ...result,
      // Note: Simulation doesn't return the actual deployment address
      // That would only be available after real deployment
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Contract deployment simulation failed'
    console.error('❌ Contract deployment simulation failed:', errorMessage)

    return {
      changes: [],
      gasUsed: '0x0',
      error: errorMessage,
      success: false,
      errorMessage,
    }
  }
}

/**
 * Simulate resume verification transaction
 */
export async function simulateResumeVerification(params: {
  from: string
  contractAddress: string
  resumeHash: string
  userAddress: string
}): Promise<SimulationResult & { estimatedCostUSD?: number }> {
  try {
    const { from, contractAddress, resumeHash, userAddress } = params

    // Encode the function call for verifyResume(bytes32 resumeHash, address userAddress)
    // This is a simplified encoding - in practice, you'd use ethers or viem to encode properly
    const functionSelector = '0x12345678' // This would be the actual function selector
    const encodedCall =
      functionSelector +
      resumeHash.replace('0x', '').padStart(64, '0') +
      userAddress.replace('0x', '').padStart(64, '0')

    const transaction: TransactionRequest = {
      from,
      to: contractAddress,
      value: '0x0',
      data: encodedCall,
    }

    console.log('📄 Simulating resume verification:', transaction)

    const result = await simulateTransaction(transaction)

    // Estimate USD cost (this would need real gas price data)
    let estimatedCostUSD: number | undefined
    if (result.success && result.gasUsed) {
      const gasUsed = parseInt(result.gasUsed, 16)
      // Rough estimate: Base gas price ~0.001 gwei, ETH ~$2000
      // This would need real-time pricing in production
      estimatedCostUSD = gasUsed * 0.000000001 * 2000
    }

    return {
      ...result,
      estimatedCostUSD,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Resume verification simulation failed'
    console.error('❌ Resume verification simulation failed:', errorMessage)

    return {
      changes: [],
      gasUsed: '0x0',
      error: errorMessage,
      success: false,
      errorMessage,
    }
  }
}

/**
 * Simulate USDC transfer (for gas payment scenarios)
 */
export async function simulateUSDCTransfer(params: {
  from: string
  to: string
  amount: string // Amount in USDC (e.g., "10.50")
}): Promise<SimulationResult> {
  try {
    const { from, to, amount } = params

    // Convert amount to raw USDC (6 decimals)
    const rawAmount = (parseFloat(amount) * 1000000).toString(16)

    // Encode ERC20 transfer function call
    const transferSelector = '0xa9059cbb' // transfer(address,uint256)
    const encodedCall =
      transferSelector +
      to.replace('0x', '').padStart(64, '0') +
      rawAmount.padStart(64, '0')

    const transaction: TransactionRequest = {
      from,
      to: BASE_SEPOLIA_USDC_ADDRESS,
      value: '0x0',
      data: encodedCall,
    }

    console.log('💰 Simulating USDC transfer:', transaction)

    return await simulateTransaction(transaction)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'USDC transfer simulation failed'
    console.error('❌ USDC transfer simulation failed:', errorMessage)

    return {
      changes: [],
      gasUsed: '0x0',
      error: errorMessage,
      success: false,
      errorMessage,
    }
  }
}

/**
 * Get human-readable summary of asset changes
 */
export function formatAssetChanges(changes: AssetChange[]): string[] {
  return changes.map((change) => {
    const direction =
      change.changeType === 'TRANSFER'
        ? change.from.toLowerCase() === change.to.toLowerCase()
          ? 'Internal'
          : 'Transfer'
        : 'Approval'

    const asset = change.symbol || 'Unknown Token'
    const amount = change.amount || 'Unknown Amount'

    if (change.changeType === 'TRANSFER') {
      return `${direction}: ${amount} ${asset} from ${change.from.slice(0, 6)}...${change.from.slice(-4)} to ${change.to.slice(0, 6)}...${change.to.slice(-4)}`
    } else {
      return `${direction}: ${amount} ${asset} approved for ${change.to.slice(0, 6)}...${change.to.slice(-4)}`
    }
  })
}

/**
 * Calculate estimated transaction cost in USD
 */
export async function estimateTransactionCostUSD(
  gasUsed: string,
  gasPrice?: string
): Promise<number> {
  try {
    const gasUsedDecimal = parseInt(gasUsed, 16)

    // Get current gas price if not provided
    let gasPriceDecimal: number
    if (gasPrice) {
      gasPriceDecimal = parseInt(gasPrice, 16)
    } else {
      // Get current gas price from network
      const currentGasPrice = await alchemySDK.core.getGasPrice()
      gasPriceDecimal = parseInt(currentGasPrice.toString(), 10)
    }

    // Calculate cost in ETH
    const costInWei = gasUsedDecimal * gasPriceDecimal
    const costInETH = costInWei / 1e18

    // Convert to USD (this would need real-time ETH price in production)
    const ETH_PRICE_USD = 2000 // Placeholder - would fetch from price API
    const costInUSD = costInETH * ETH_PRICE_USD

    return costInUSD
  } catch (error) {
    console.error('❌ Failed to estimate transaction cost:', error)
    return 0
  }
}

/**
 * Validate transaction before simulation
 */
export function validateTransaction(transaction: TransactionRequest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check required fields
  if (!transaction.from) {
    errors.push('From address is required')
  }

  // Validate addresses
  if (transaction.from && !transaction.from.match(/^0x[a-fA-F0-9]{40}$/)) {
    errors.push('Invalid from address format')
  }

  if (transaction.to && !transaction.to.match(/^0x[a-fA-F0-9]{40}$/)) {
    errors.push('Invalid to address format')
  }

  // Validate hex values
  if (transaction.value && !transaction.value.match(/^0x[a-fA-F0-9]+$/)) {
    errors.push('Invalid value format (must be hex)')
  }

  if (transaction.data && !transaction.data.match(/^0x[a-fA-F0-9]*$/)) {
    errors.push('Invalid data format (must be hex)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Raw API call to alchemy_simulateAssetChanges (alternative to SDK)
 * Enhanced to match official Alchemy examples exactly
 */
export async function simulateTransactionRaw(
  transaction: TransactionRequest
): Promise<SimulationResult> {
  try {
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    // Clean transaction object - remove undefined values
    const cleanTransaction = Object.fromEntries(
      Object.entries(transaction).filter(([_, value]) => value !== undefined)
    )

    const requestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_simulateAssetChanges',
      params: [cleanTransaction],
      id: 1,
    }

    console.log('🧪 Raw simulation request (official format):', requestBody)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`)
    }

    console.log('✅ Raw simulation response:', data.result)

    return {
      changes: data.result.changes || [],
      gasUsed: data.result.gasUsed || '0x0',
      error: data.result.error,
      success: !data.result.error,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Raw simulation failed'
    console.error('❌ Raw simulation failed:', errorMessage)

    return {
      changes: [],
      gasUsed: '0x0',
      error: errorMessage,
      success: false,
      errorMessage,
    }
  }
}
