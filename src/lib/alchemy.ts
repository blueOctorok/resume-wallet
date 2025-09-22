/**
 * Alchemy RPC Provider Configuration
 * Following Alchemy's Viem integration docs exactly
 */

import { createPublicClient, http, Block } from 'viem'
import { baseSepolia, base } from 'viem/chains'

// Environment variables - use client-side accessible ones
const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QlWCKp4hl'

if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is required')
}

console.log('🔍 Alchemy API Key:', ALCHEMY_API_KEY.substring(0, 8) + '...')

// Base Sepolia Client (for testing)
export const alchemySepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
})

// Base Mainnet Client (for production)
export const alchemyMainnetClient = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
})

// Current client (defaults to Sepolia for testing)
export const alchemyClient = alchemySepoliaClient

// Test connection function
export async function testAlchemyConnection(): Promise<{
  success: boolean
  blockNumber?: bigint
  error?: string
}> {
  try {
    const blockNumber = await alchemyClient.getBlockNumber()
    console.log('✅ Alchemy connection successful! Latest block:', blockNumber)
    return { success: true, blockNumber }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Alchemy connection failed:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// Get latest block (following Alchemy's example exactly)
export async function getLatestBlock(): Promise<Block | null> {
  try {
    // Get the latest block (no blockNumber parameter = latest)
    const block: Block = await alchemyClient.getBlock()
    return block
  } catch (error) {
    console.error('Error getting latest block:', error)
    return null
  }
}

// Export the configuration for other files
export const alchemyConfig = {
  apiKey: ALCHEMY_API_KEY,
  baseSepoliaUrl: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  baseMainnetUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  client: alchemyClient,
  sepoliaClient: alchemySepoliaClient,
  mainnetClient: alchemyMainnetClient,
}
