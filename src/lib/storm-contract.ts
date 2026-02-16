/**
 * STORM Token Contract Configuration and Interaction
 *
 * Handles interaction with:
 * - StormToken (ERC20)
 * - RewardDistributor (holds 9M pool, distributes rewards)
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// Contract addresses - set via environment variables after deployment
export const STORM_CONTRACTS = {
  // Base Sepolia (testnet)
  baseSepolia: {
    token: process.env.STORM_TOKEN_ADDRESS || '',
    distributor: process.env.REWARD_DISTRIBUTOR_ADDRESS || '',
  },
  // Base Mainnet (production) - will be set after mainnet deploy
  base: {
    token: process.env.STORM_TOKEN_ADDRESS_MAINNET || '',
    distributor: process.env.REWARD_DISTRIBUTOR_ADDRESS_MAINNET || '',
  },
} as const

// StormToken ABI (minimal for reading balances)
export const STORM_TOKEN_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

// RewardDistributor ABI (for distributing rewards)
export const REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function distribute(address to, uint256 amount)',
  'function distributeBatch(address[] recipients, uint256[] amounts)',
  'function remainingPool() view returns (uint256)',
  'function totalDistributed() view returns (uint256)',
  'function stormToken() view returns (address)',
  'function DISTRIBUTOR_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
])

/**
 * Get the chain config based on environment
 */
function getChain() {
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  return isMainnet ? base : baseSepolia
}

/**
 * Get contract addresses for current environment
 */
export function getStormContracts() {
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  return isMainnet ? STORM_CONTRACTS.base : STORM_CONTRACTS.baseSepolia
}

/**
 * Check if STORM contracts are configured
 */
export function isStormConfigured(): boolean {
  const contracts = getStormContracts()
  return !!(contracts.token && contracts.distributor)
}

/**
 * Create a public client for reading contract state
 */
function getPublicClient() {
  const chain = getChain()
  const rpcUrl =
    chain.id === base.id
      ? process.env.NEXT_PUBLIC_ALCHEMY_BASE_MAINNET_URL
      : process.env.ALCHEMY_BASE_SEPOLIA_URL

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  })
}

/**
 * Create a wallet client for sending transactions
 * Uses the deployer/distributor private key
 */
function getWalletClient() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not configured for STORM distribution')
  }

  const normalizedKey = privateKey.startsWith('0x')
    ? (privateKey as `0x${string}`)
    : (`0x${privateKey}` as `0x${string}`)

  const account = privateKeyToAccount(normalizedKey)
  const chain = getChain()
  const rpcUrl =
    chain.id === base.id
      ? process.env.NEXT_PUBLIC_ALCHEMY_BASE_MAINNET_URL
      : process.env.ALCHEMY_BASE_SEPOLIA_URL

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })
}

/**
 * Get total STORM distributed from the reward pool.
 * Used to calculate decay for new rewards.
 */
export async function getTotalDistributed(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const client = getPublicClient()
  const totalDistributed = await client.readContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'totalDistributed',
  })

  return totalDistributed
}

/**
 * Get remaining STORM in the reward pool
 */
export async function getRemainingPool(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const client = getPublicClient()
  const remaining = await client.readContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'remainingPool',
  })

  return remaining
}

/**
 * Get STORM balance for an address
 */
export async function getStormBalance(address: string): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.token) {
    throw new Error('StormToken address not configured')
  }

  const client = getPublicClient()
  const balance = await client.readContract({
    address: contracts.token as `0x${string}`,
    abi: STORM_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })

  return balance
}

/**
 * Distribute STORM tokens to a user.
 * Called after a successful USDC payment.
 *
 * @param toAddress - User's wallet address
 * @param amountWei - Amount in wei (use toWei() from storm-rewards.ts)
 * @returns Transaction hash
 */
export async function distributeReward(
  toAddress: string,
  amountWei: bigint
): Promise<string> {
  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const walletClient = getWalletClient()
  const publicClient = getPublicClient()

  // Send the distribute transaction
  const hash = await walletClient.writeContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'distribute',
    args: [toAddress as `0x${string}`, amountWei],
  })

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status !== 'success') {
    throw new Error(`STORM distribution failed: ${hash}`)
  }

  return hash
}

/**
 * Batch distribute STORM tokens to multiple users.
 * More gas-efficient for airdrops or multiple rewards.
 *
 * @param recipients - Array of wallet addresses
 * @param amountsWei - Array of amounts in wei (must match recipients length)
 * @returns Transaction hash
 */
export async function distributeBatch(
  recipients: string[],
  amountsWei: bigint[]
): Promise<string> {
  if (recipients.length !== amountsWei.length) {
    throw new Error('Recipients and amounts arrays must have same length')
  }

  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const walletClient = getWalletClient()
  const publicClient = getPublicClient()

  const hash = await walletClient.writeContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'distributeBatch',
    args: [
      recipients as `0x${string}`[],
      amountsWei,
    ],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status !== 'success') {
    throw new Error(`STORM batch distribution failed: ${hash}`)
  }

  return hash
}
