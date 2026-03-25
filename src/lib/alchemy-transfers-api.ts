/**
 * Alchemy Transfers API Integration
 * For tracking resume verification transaction history
 */

import { alchemySDK } from '@/lib/alchemy-token-api'

// Re-export USDC address for convenience
export { BASE_SEPOLIA_USDC_ADDRESS } from '@/lib/alchemy-token-api'

// Types for transfer data - matching actual Alchemy API response
export interface TransferResult {
  blockNum: string
  uniqueId: string
  hash: string
  from: string
  to: string
  value: number
  erc721TokenId?: string | null
  erc1155Metadata?: any | null
  tokenId?: string | null
  asset: string
  category:
    | 'external'
    | 'internal'
    | 'erc20'
    | 'erc721'
    | 'erc1155'
    | 'specialnft'
  rawContract: {
    value: string
    address: string | null
    decimal: string
  }
  metadata?: {
    blockTimestamp: string
  }
}

export interface TransfersResponse {
  transfers: TransferResult[]
  pageKey?: string
  success: boolean
  error?: string
}

/** Deduplicate by `uniqueId`, sort by block number (desc = newest first). */
function deduplicateAndSort(
  transfers: TransferResult[],
  order: 'asc' | 'desc' = 'desc',
): TransferResult[] {
  const seen = new Set<string>()
  const unique = transfers.filter((t) => {
    if (seen.has(t.uniqueId)) return false
    seen.add(t.uniqueId)
    return true
  })
  unique.sort((a, b) => {
    const diff = parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16)
    return order === 'desc' ? diff : -diff
  })
  return unique
}

/**
 * Single-direction asset transfer call (fromAddress XOR toAddress).
 * Shared by every public helper so query logic lives in one place.
 */
async function fetchTransfers(
  address: string,
  direction: 'from' | 'to',
  options: {
    fromBlock?: string
    toBlock?: string
    maxCount?: number
    category?: string[]
    order?: 'asc' | 'desc'
    withMetadata?: boolean
    contractAddresses?: string[]
  } = {},
): Promise<TransfersResponse> {
  const {
    fromBlock = '0x0',
    toBlock = 'latest',
    maxCount = 100,
    category = ['external', 'erc20', 'erc721', 'erc1155'],
    order = 'desc',
    withMetadata = true,
    contractAddresses,
  } = options

  const ALCHEMY_API_KEY =
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
  const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = {
    fromBlock,
    toBlock,
    maxCount: `0x${maxCount.toString(16)}`,
    category,
    order,
    withMetadata,
    ...(direction === 'from' ? { fromAddress: address } : { toAddress: address }),
    ...(contractAddresses?.length ? { contractAddresses } : {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [params],
      id: 1,
    }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  const data = await res.json()
  if (data.error) throw new Error(`Alchemy: ${data.error.message}`)

  return {
    transfers: data.result.transfers ?? [],
    pageKey: data.result.pageKey,
    success: true,
  }
}

/**
 * Complete wallet transfer history (sent + received, merged & deduped).
 *
 * alchemy_getAssetTransfers treats fromAddress + toAddress as AND (must match
 * both), not OR. We fire two parallel calls and merge so every transfer shows.
 */
export async function getWalletTransfers(
  address: string,
  options: {
    fromBlock?: string
    toBlock?: string
    maxCount?: number
    category?: ('external' | 'internal' | 'erc20' | 'erc721' | 'erc1155' | 'specialnft')[]
    order?: 'asc' | 'desc'
    withMetadata?: boolean
    /** @deprecated Use getTransactionsFrom / getTransactionsTo instead */
    includeFromAddress?: boolean
    /** @deprecated Use getTransactionsFrom / getTransactionsTo instead */
    includeToAddress?: boolean
  } = {},
): Promise<TransfersResponse> {
  try {
    const {
      maxCount = 100,
      includeFromAddress = true,
      includeToAddress = true,
      ...rest
    } = options

    const onlyFrom = includeFromAddress && !includeToAddress
    const onlyTo = !includeFromAddress && includeToAddress

    if (onlyFrom) return fetchTransfers(address, 'from', { ...rest, maxCount })
    if (onlyTo) return fetchTransfers(address, 'to', { ...rest, maxCount })

    const [sent, received] = await Promise.all([
      fetchTransfers(address, 'from', { ...rest, maxCount }),
      fetchTransfers(address, 'to', { ...rest, maxCount }),
    ])

    if (!sent.success) return sent
    if (!received.success) return received

    const merged = deduplicateAndSort(
      [...sent.transfers, ...received.transfers],
      rest.order ?? 'desc',
    )

    return { transfers: merged.slice(0, maxCount), success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WALLET TRANSFERS]', msg)
    return { transfers: [], success: false, error: msg }
  }
}

/** Transfers originating FROM an address (what the user sent). */
export async function getTransactionsFrom(
  address: string,
  options: { maxCount?: number; order?: 'asc' | 'desc' } = {},
): Promise<TransfersResponse> {
  try {
    return await fetchTransfers(address, 'from', options)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { transfers: [], success: false, error: msg }
  }
}

/** Transfers sent TO an address (what the user received). */
export async function getTransactionsTo(
  address: string,
  options: { maxCount?: number; order?: 'asc' | 'desc' } = {},
): Promise<TransfersResponse> {
  try {
    return await fetchTransfers(address, 'to', options)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { transfers: [], success: false, error: msg }
  }
}

/**
 * Get resume verification transactions specifically
 * Filters for interactions with our ResumeRegistry contract using contractAddresses filter
 * Following the official Alchemy tutorial for contract-specific transfers
 */
export async function getResumeVerificationHistory(
  userAddress: string,
  contractAddress?: string,
  options: {
    maxCount?: number
    pageKey?: string
    order?: 'asc' | 'desc'
  } = {}
): Promise<TransfersResponse> {
  try {
    const { maxCount = 50, pageKey, order = 'desc' } = options

    if (!contractAddress) {
      return { transfers: [], success: true, pageKey: undefined }
    }

    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        id: 1,
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: userAddress,
          contractAddresses: [contractAddress],
          maxCount,
          pageKey,
          category: ['external'],
          order,
          withMetadata: true,
          excludeZeroValue: false,
        }],
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = await res.json()
    if (data.error) throw new Error(`Alchemy: ${data.error.message}`)

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[RESUME HISTORY]', msg)
    return { transfers: [], success: false, error: msg }
  }
}

/**
 * Get the first transfer event for a contract (following Alchemy tutorial)
 * Useful for finding when a contract was first deployed or used
 */
export async function getContractFirstTransfer(
  contractAddress: string,
  options: {
    category?: (
      | 'external'
      | 'internal'
      | 'erc20'
      | 'erc721'
      | 'erc1155'
      | 'specialnft'
    )[]
    excludeZeroValue?: boolean
  } = {}
): Promise<TransfersResponse> {
  try {
    const {
      category = ['external', 'erc20', 'erc721', 'erc1155'],
      excludeZeroValue = true,
    } = options

    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        id: 1,
        params: [{
          fromBlock: '0x0',
          contractAddresses: [contractAddress],
          excludeZeroValue,
          category,
          maxCount: '0x1',
          order: 'asc',
        }],
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = await res.json()
    if (data.error) throw new Error(`Alchemy: ${data.error.message}`)

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CONTRACT FIRST TRANSFER]', msg)
    return { transfers: [], success: false, error: msg }
  }
}

/**
 * Get the last (most recent) transfer event for a contract (following Alchemy tutorial)
 * Uses pagination to find the absolute latest transfer
 * Perfect for real-time monitoring of contract activity
 */
export async function getContractLastTransfer(
  contractAddress: string,
  options: {
    category?: (
      | 'external'
      | 'internal'
      | 'erc20'
      | 'erc721'
      | 'erc1155'
      | 'specialnft'
    )[]
    excludeZeroValue?: boolean
    maxPages?: number
  } = {}
): Promise<
  TransfersResponse & { totalTransfers?: number; pagesSearched?: number }
> {
  try {
    const {
      category = ['external', 'erc20', 'erc721', 'erc1155'],
      excludeZeroValue = true,
      maxPages = 10,
    } = options

    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const baseParams = {
      fromBlock: '0x0',
      toBlock: 'latest',
      contractAddresses: [contractAddress],
      excludeZeroValue,
      category,
      maxCount: '0x3e8',
      order: 'desc' as const,
    }

    const initialRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', id: 1,
        params: [baseParams],
      }),
    })

    if (!initialRes.ok) throw new Error(`HTTP ${initialRes.status}: ${initialRes.statusText}`)
    const initialData = await initialRes.json()
    if (initialData.error) throw new Error(`Alchemy: ${initialData.error.message}`)

    let pageKey = initialData.result.pageKey
    let pagesSearched = 1
    let totalTransfers = initialData.result.transfers.length

    if (!pageKey) {
      const lastTransfer = initialData.result.transfers[0]
      return {
        transfers: lastTransfer ? [lastTransfer] : [],
        pageKey: undefined,
        success: true,
        totalTransfers,
        pagesSearched,
      }
    }

    // Paginate to find the absolute latest transfer
    let lastTransferFound: TransferResult | null = null
    let counter = 0

    while (pageKey && counter < maxPages) {
      const nextRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', id: 1,
          params: [{ ...baseParams, pageKey: pageKey.toString() }],
        }),
      })

      if (!nextRes.ok) throw new Error(`HTTP ${nextRes.status}: ${nextRes.statusText}`)
      const nextData = await nextRes.json()
      if (nextData.error) throw new Error(`Alchemy: ${nextData.error.message}`)

      pageKey = nextData.result.pageKey
      counter += 1
      pagesSearched += 1
      totalTransfers += nextData.result.transfers.length

      if (!pageKey) {
        lastTransferFound = nextData.result.transfers[0]
        break
      }
    }

    if (counter >= maxPages && pageKey) {
      lastTransferFound = initialData.result.transfers[0]
    }

    return {
      transfers: lastTransferFound ? [lastTransferFound] : [],
      pageKey: undefined,
      success: true,
      totalTransfers,
      pagesSearched,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CONTRACT LAST TRANSFER]', msg)
    return { transfers: [], success: false, error: msg, totalTransfers: 0, pagesSearched: 0 }
  }
}

/**
 * Get USDC transaction history using raw Alchemy API.
 *
 * alchemy_getAssetTransfers does NOT support fromAddress + toAddress in the
 * same request (it means "from AND to", not "from OR to"). We fire two
 * parallel calls — sent + received — then merge, deduplicate on uniqueId, and
 * sort newest-first.
 */
export async function getUSDCTransferHistory(
  address: string,
  usdcContractAddress: string,
  options: {
    maxCount?: number
    order?: 'asc' | 'desc'
  } = {}
): Promise<TransfersResponse> {
  try {
    const { maxCount = 50, order = 'desc' } = options
    const hexMax = `0x${maxCount.toString(16)}`

    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const shared = {
      fromBlock: '0x0',
      toBlock: 'latest',
      contractAddresses: [usdcContractAddress],
      maxCount: hexMax,
      category: ['erc20'],
      order,
      withMetadata: true,
    }

    const [sentRes, recvRes] = await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', id: 1,
          params: [{ ...shared, fromAddress: address }],
        }),
      }),
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', id: 2,
          params: [{ ...shared, toAddress: address }],
        }),
      }),
    ])

    if (!sentRes.ok) throw new Error(`HTTP ${sentRes.status}: ${sentRes.statusText}`)
    if (!recvRes.ok) throw new Error(`HTTP ${recvRes.status}: ${recvRes.statusText}`)

    const sentData = await sentRes.json()
    const recvData = await recvRes.json()
    if (sentData.error) throw new Error(`Alchemy: ${sentData.error.message}`)
    if (recvData.error) throw new Error(`Alchemy: ${recvData.error.message}`)

    const merged = deduplicateAndSort(
      [...(sentData.result.transfers ?? []), ...(recvData.result.transfers ?? [])],
      order,
    )

    return { transfers: merged.slice(0, maxCount), success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[USDC HISTORY]', msg)
    return { transfers: [], success: false, error: msg }
  }
}

/**
 * Get transaction details with enhanced metadata
 */
export async function getTransactionDetails(transactionHash: string): Promise<{
  transaction?: any
  receipt?: any
  success: boolean
  error?: string
}> {
  try {
    const [transaction, receipt] = await Promise.all([
      alchemySDK.core.getTransaction(transactionHash),
      alchemySDK.core.getTransactionReceipt(transactionHash),
    ])

    return { transaction, receipt, success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[TX DETAILS]', msg)
    return { success: false, error: msg }
  }
}

/**
 * Format transfer data for display (following Alchemy tutorial patterns)
 */
export function formatTransferForDisplay(transfer: TransferResult): {
  hash: string
  type: string
  amount: string
  from: string
  to: string
  timestamp: string
  blockNumber: number
  category: string
  asset: string
  rawValue: string
} {
  const timestamp = transfer.metadata?.blockTimestamp
    ? new Date(transfer.metadata.blockTimestamp).toLocaleString()
    : 'Unknown'

  const amount = transfer.value ? transfer.value.toString() : '0'
  const blockNumber = parseInt(transfer.blockNum, 16)

  // Determine transaction type based on Alchemy tutorial examples
  let type = 'Transfer'
  if (transfer.category === 'external') {
    // Check if it's a contract interaction (external transaction to a contract)
    if (transfer.to && transfer.to !== transfer.from && transfer.value === 0) {
      type = 'Contract Interaction'
    } else {
      type = 'ETH Transfer'
    }
  } else if (transfer.category === 'erc20') {
    type = `${transfer.asset || 'Token'} Transfer`
  } else if (transfer.category === 'erc721') {
    type = 'NFT Transfer'
  } else if (transfer.category === 'erc1155') {
    type = 'Multi-Token Transfer'
  }

  return {
    hash: transfer.hash,
    type,
    amount,
    from: transfer.from,
    to: transfer.to,
    timestamp,
    blockNumber,
    category: transfer.category,
    asset: transfer.asset || 'Unknown',
    rawValue: transfer.rawContract?.value || '0x0',
  }
}

/**
 * Parse transaction history and extract key information (following tutorial examples)
 * This mimics the tutorial's approach to processing API responses
 */
export function parseTransactionHistory(transfers: TransferResult[]): Array<{
  tokenTransfer: string
  asset: string
  value: number | null
  category: string
  blockNumber: number
  hash: string
}> {
  return transfers.map((transfer) => ({
    tokenTransfer: `${transfer.value || 'null'} ${transfer.asset || 'null'}`,
    asset: transfer.asset || 'null',
    value: transfer.value,
    category: transfer.category,
    blockNumber: parseInt(transfer.blockNum, 16),
    hash: transfer.hash,
  }))
}

/**
 * Quick check: does this address have any transfer history?
 * Uses maxCount=1 so it's cheap (no redundant 1000-transfer fetch).
 */
export async function hasTransactionHistory(address: string): Promise<{
  hasHistory: boolean
  transactionCount: number
  success: boolean
  error?: string
}> {
  try {
    const response = await getWalletTransfers(address, {
      maxCount: 1,
      order: 'desc',
    })

    if (!response.success) {
      return { hasHistory: false, transactionCount: 0, success: false, error: response.error }
    }

    return {
      hasHistory: response.transfers.length > 0,
      transactionCount: response.transfers.length,
      success: true,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[HAS HISTORY]', msg)
    return { hasHistory: false, transactionCount: 0, success: false, error: msg }
  }
}

// Export configuration
export const transfersAPIConfig = {
  supportedCategories: [
    'external',
    'internal',
    'erc20',
    'erc721',
    'erc1155',
    'specialnft',
  ],
  maxResultsPerPage: 1000,
  pageKeyTTL: 600000, // 10 minutes in milliseconds
}
