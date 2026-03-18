/**
 * STORM Token Contract Configuration and Interaction
 *
 * Handles interaction with:
 * - StormToken (ERC20, 50M fixed supply)
 * - RewardDistributor (holds 25M pool, distributes USDC-backed user rewards)
 * - TreasuryDistributor (holds 17M pool, distributes referral/community rewards)
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export const STORM_CONTRACTS = {
  baseSepolia: {
    token: process.env.STORM_TOKEN_ADDRESS || '',
    distributor: process.env.REWARD_DISTRIBUTOR_ADDRESS || '',
    treasuryDistributor: process.env.TREASURY_DISTRIBUTOR_ADDRESS || '',
  },
  base: {
    token: process.env.STORM_TOKEN_ADDRESS_MAINNET || '',
    distributor: process.env.REWARD_DISTRIBUTOR_ADDRESS_MAINNET || '',
    treasuryDistributor: process.env.TREASURY_DISTRIBUTOR_ADDRESS_MAINNET || '',
  },
} as const

export const STORM_TOKEN_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

// Shared ABI shape — both RewardDistributor and TreasuryDistributor use the same interface
const DISTRIBUTOR_ABI = parseAbi([
  'function distribute(address to, uint256 amount)',
  'function distributeBatch(address[] recipients, uint256[] amounts)',
  'function remainingPool() view returns (uint256)',
  'function totalDistributed() view returns (uint256)',
  'function stormToken() view returns (address)',
  'function DISTRIBUTOR_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
])

export const REWARD_DISTRIBUTOR_ABI = DISTRIBUTOR_ABI
export const TREASURY_DISTRIBUTOR_ABI = DISTRIBUTOR_ABI

function getChain() {
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  return isMainnet ? base : baseSepolia
}

export function getStormContracts() {
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  return isMainnet ? STORM_CONTRACTS.base : STORM_CONTRACTS.baseSepolia
}

export function isStormConfigured(): boolean {
  const contracts = getStormContracts()
  return !!(contracts.token && contracts.distributor)
}

export function isTreasuryConfigured(): boolean {
  const contracts = getStormContracts()
  return !!(contracts.token && contracts.treasuryDistributor)
}

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

// ── Reward Pool (25M, decay-based user rewards) ─────────────────────────────

export async function getTotalDistributed(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const client = getPublicClient()
  return client.readContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'totalDistributed',
  })
}

export async function getRemainingPool(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.distributor) {
    throw new Error('RewardDistributor address not configured')
  }

  const client = getPublicClient()
  return client.readContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'remainingPool',
  })
}

export async function getStormBalance(address: string): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.token) {
    throw new Error('StormToken address not configured')
  }

  const client = getPublicClient()
  return client.readContract({
    address: contracts.token as `0x${string}`,
    abi: STORM_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
}

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

  const hash = await walletClient.writeContract({
    address: contracts.distributor as `0x${string}`,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'distribute',
    args: [toAddress as `0x${string}`, amountWei],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`STORM distribution failed: ${hash}`)
  }

  return hash
}

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
    args: [recipients as `0x${string}`[], amountsWei],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`STORM batch distribution failed: ${hash}`)
  }

  return hash
}

// ── Treasury Pool (15M, fixed-amount referral/community rewards) ─────────────

export async function getTreasuryRemaining(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.treasuryDistributor) {
    throw new Error('TreasuryDistributor address not configured')
  }

  const client = getPublicClient()
  return client.readContract({
    address: contracts.treasuryDistributor as `0x${string}`,
    abi: TREASURY_DISTRIBUTOR_ABI,
    functionName: 'remainingPool',
  })
}

export async function getTreasuryTotalDistributed(): Promise<bigint> {
  const contracts = getStormContracts()
  if (!contracts.treasuryDistributor) {
    throw new Error('TreasuryDistributor address not configured')
  }

  const client = getPublicClient()
  return client.readContract({
    address: contracts.treasuryDistributor as `0x${string}`,
    abi: TREASURY_DISTRIBUTOR_ABI,
    functionName: 'totalDistributed',
  })
}

/**
 * Distribute STORM from the treasury to a recipient.
 * Used for referral rewards, community bonuses, etc.
 */
export async function distributeTreasuryReward(
  toAddress: string,
  amountWei: bigint
): Promise<string> {
  const contracts = getStormContracts()
  if (!contracts.treasuryDistributor) {
    throw new Error('TreasuryDistributor address not configured')
  }

  const walletClient = getWalletClient()
  const publicClient = getPublicClient()

  const hash = await walletClient.writeContract({
    address: contracts.treasuryDistributor as `0x${string}`,
    abi: TREASURY_DISTRIBUTOR_ABI,
    functionName: 'distribute',
    args: [toAddress as `0x${string}`, amountWei],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Treasury distribution failed: ${hash}`)
  }

  return hash
}

/**
 * Batch distribute from treasury to multiple recipients.
 * Useful for distributing to both referrer and referred in one tx.
 */
export async function distributeTreasuryBatch(
  recipients: string[],
  amountsWei: bigint[]
): Promise<string> {
  if (recipients.length !== amountsWei.length) {
    throw new Error('Recipients and amounts arrays must have same length')
  }

  const contracts = getStormContracts()
  if (!contracts.treasuryDistributor) {
    throw new Error('TreasuryDistributor address not configured')
  }

  const walletClient = getWalletClient()
  const publicClient = getPublicClient()

  const hash = await walletClient.writeContract({
    address: contracts.treasuryDistributor as `0x${string}`,
    abi: TREASURY_DISTRIBUTOR_ABI,
    functionName: 'distributeBatch',
    args: [recipients as `0x${string}`[], amountsWei],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Treasury batch distribution failed: ${hash}`)
  }

  return hash
}
