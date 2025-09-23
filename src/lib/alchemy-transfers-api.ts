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

/**
 * Get complete transaction history for a wallet address using raw Alchemy API
 * Implements the official Alchemy tutorial approach for comprehensive transaction history
 *
 * This function gets transactions both FROM and TO the specified address to create
 * a complete picture of the user's transaction history.
 */
export async function getWalletTransfers(
  address: string,
  options: {
    fromBlock?: string
    toBlock?: string
    maxCount?: number
    pageKey?: string
    category?: (
      | 'external'
      | 'internal'
      | 'erc20'
      | 'erc721'
      | 'erc1155'
      | 'specialnft'
    )[]
    order?: 'asc' | 'desc'
    withMetadata?: boolean
    includeFromAddress?: boolean
    includeToAddress?: boolean
  } = {}
): Promise<TransfersResponse> {
  try {
    console.log(`🔍 Getting transfers for wallet: ${address}`)

    const {
      fromBlock = '0x0',
      toBlock = 'latest',
      maxCount = 100,
      pageKey,
      category = ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      order = 'desc', // newest first
      withMetadata = true,
      includeFromAddress = true,
      includeToAddress = true,
    } = options

    // Use raw Alchemy API call
    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    // Build request parameters following Alchemy tutorial approach
    const params: any = {
      fromBlock,
      toBlock,
      maxCount,
      pageKey,
      category,
      order,
      withMetadata,
    }

    // Include fromAddress and/or toAddress based on options
    // Following the tutorial: use both for complete transaction history
    if (includeFromAddress) {
      params.fromAddress = address
    }
    if (includeToAddress) {
      params.toAddress = address
    }

    const requestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [params],
      id: 1,
    }

    console.log('🔧 Raw API request:', requestBody)

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
      throw new Error(`Alchemy API Error: ${data.error.message}`)
    }

    console.log(`✅ Retrieved ${data.result.transfers.length} transfers`)
    console.log('🔧 Raw API response:', data.result)

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get wallet transfers:', errorMessage)

    return {
      transfers: [],
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Get transactions originating FROM an address (following Alchemy tutorial)
 * Shows what the user has sent/spent
 */
export async function getTransactionsFrom(
  address: string,
  options: {
    fromBlock?: string
    toBlock?: string
    maxCount?: number
    pageKey?: string
    category?: (
      | 'external'
      | 'internal'
      | 'erc20'
      | 'erc721'
      | 'erc1155'
      | 'specialnft'
    )[]
    order?: 'asc' | 'desc'
    withMetadata?: boolean
  } = {}
): Promise<TransfersResponse> {
  return getWalletTransfers(address, {
    ...options,
    includeFromAddress: true,
    includeToAddress: false,
  })
}

/**
 * Get transactions sent TO an address (following Alchemy tutorial)
 * Shows what the user has received
 */
export async function getTransactionsTo(
  address: string,
  options: {
    fromBlock?: string
    toBlock?: string
    maxCount?: number
    pageKey?: string
    category?: (
      | 'external'
      | 'internal'
      | 'erc20'
      | 'erc721'
      | 'erc1155'
      | 'specialnft'
    )[]
    order?: 'asc' | 'desc'
    withMetadata?: boolean
  } = {}
): Promise<TransfersResponse> {
  return getWalletTransfers(address, {
    ...options,
    includeFromAddress: false,
    includeToAddress: true,
  })
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
    console.log(`🔍 Getting resume verification history for: ${userAddress}`)

    const { maxCount = 50, pageKey, order = 'desc' } = options

    if (!contractAddress) {
      console.warn(
        '⚠️ No contract address provided for resume verification history'
      )
      return {
        transfers: [],
        success: true,
        pageKey: undefined,
      }
    }

    // Use raw Alchemy API call with contractAddresses filter (following tutorial)
    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const requestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: userAddress, // Transactions FROM the user (resume submissions)
          contractAddresses: [contractAddress], // Filter for our ResumeRegistry contract
          maxCount,
          pageKey,
          category: ['external', 'internal'], // Contract interactions
          order,
          withMetadata: true,
          excludeZeroValue: false, // Include gas-sponsored transactions
        },
      ],
      id: 1,
    }

    console.log('🔧 Resume verification API request:', requestBody)

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
      throw new Error(`Alchemy API Error: ${data.error.message}`)
    }

    console.log(
      `✅ Found ${data.result.transfers.length} resume verification transactions`
    )
    console.log('🔧 Resume verification API response:', data.result)

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get resume verification history:', errorMessage)

    return {
      transfers: [],
      success: false,
      error: errorMessage,
    }
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
    console.log(`🔍 Getting first transfer for contract: ${contractAddress}`)

    const {
      category = ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      excludeZeroValue = true,
    } = options

    // Use raw Alchemy API call following the tutorial exactly
    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const requestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          contractAddresses: [contractAddress],
          excludeZeroValue,
          category,
          maxCount: 1, // Only need the first one
          order: 'asc', // Ascending to get the earliest
        },
      ],
      id: 1,
    }

    console.log('🔧 First transfer API request:', requestBody)

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
      throw new Error(`Alchemy API Error: ${data.error.message}`)
    }

    console.log('✅ First transfer found:', data.result.transfers[0])

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get first contract transfer:', errorMessage)

    return {
      transfers: [],
      success: false,
      error: errorMessage,
    }
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
    console.log(`🔍 Getting last transfer for contract: ${contractAddress}`)

    const {
      category = ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      excludeZeroValue = true,
      maxPages = 10, // Prevent infinite loops for very active contracts
    } = options

    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    // First request - get initial page (most recent by default)
    const initialRequestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          contractAddresses: [contractAddress],
          excludeZeroValue,
          category,
          maxCount: 1000, // Max per request
          order: 'desc', // Descending to get most recent first
        },
      ],
      id: 1,
    }

    console.log('🔧 Last transfer initial API request:', initialRequestBody)

    const initialResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initialRequestBody),
    })

    if (!initialResponse.ok) {
      throw new Error(
        `HTTP ${initialResponse.status}: ${initialResponse.statusText}`
      )
    }

    const initialData = await initialResponse.json()

    if (initialData.error) {
      throw new Error(`Alchemy API Error: ${initialData.error.message}`)
    }

    let pageKey = initialData.result.pageKey
    let pagesSearched = 1
    let totalTransfers = initialData.result.transfers.length

    // If no pageKey, we have all transfers in the first page
    if (!pageKey) {
      const lastTransfer = initialData.result.transfers[0] // First item in desc order is the latest
      console.log('✅ Last transfer found (single page):', lastTransfer)

      return {
        transfers: lastTransfer ? [lastTransfer] : [],
        pageKey: undefined,
        success: true,
        totalTransfers,
        pagesSearched,
      }
    }

    // Following the tutorial: use pagination to find the absolute last transfer
    console.log(
      '📄 Contract has multiple pages, searching for absolute last transfer...'
    )

    let lastTransferFound: TransferResult | null = null
    let counter = 0

    while (pageKey && counter < maxPages) {
      const nextRequestBody = {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            contractAddresses: [contractAddress],
            excludeZeroValue,
            category,
            maxCount: 1000,
            order: 'desc',
            pageKey: pageKey.toString(),
          },
        ],
        id: 1,
      }

      const nextResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextRequestBody),
      })

      if (!nextResponse.ok) {
        throw new Error(
          `HTTP ${nextResponse.status}: ${nextResponse.statusText}`
        )
      }

      const nextData = await nextResponse.json()

      if (nextData.error) {
        throw new Error(`Alchemy API Error: ${nextData.error.message}`)
      }

      pageKey = nextData.result.pageKey
      counter += 1
      pagesSearched += 1
      totalTransfers += nextData.result.transfers.length

      console.log(
        `📄 Request #${counter} made! Found ${nextData.result.transfers.length} more transfers`
      )

      if (!pageKey) {
        // This is the last page - the first transfer in desc order is the most recent overall
        lastTransferFound = nextData.result.transfers[0]
        console.log(
          `✅ Last transfer found after ${counter} additional pages:`,
          lastTransferFound
        )
        break
      }
    }

    // If we hit maxPages limit, use the most recent from initial page
    if (counter >= maxPages && pageKey) {
      console.log(
        `⚠️ Reached maxPages limit (${maxPages}), using most recent from search`
      )
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get last contract transfer:', errorMessage)

    return {
      transfers: [],
      success: false,
      error: errorMessage,
      totalTransfers: 0,
      pagesSearched: 0,
    }
  }
}

/**
 * Get USDC transaction history using raw Alchemy API
 * Shows all USDC transfers for gas payment tracking
 */
export async function getUSDCTransferHistory(
  address: string,
  usdcContractAddress: string,
  options: {
    maxCount?: number
    pageKey?: string
    order?: 'asc' | 'desc'
  } = {}
): Promise<TransfersResponse> {
  try {
    console.log(`🔍 Getting USDC transfer history for: ${address}`)

    const { maxCount = 50, pageKey, order = 'desc' } = options

    // Use raw Alchemy API call
    const ALCHEMY_API_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
    const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

    const requestBody = {
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: address,
          toAddress: address,
          contractAddresses: [usdcContractAddress],
          maxCount,
          pageKey,
          category: ['erc20'],
          order,
          withMetadata: true,
        },
      ],
      id: 1,
    }

    console.log('🔧 USDC API request:', requestBody)

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
      throw new Error(`Alchemy API Error: ${data.error.message}`)
    }

    console.log(`✅ Retrieved ${data.result.transfers.length} USDC transfers`)
    console.log('🔧 USDC API response:', data.result)

    return {
      transfers: data.result.transfers,
      pageKey: data.result.pageKey,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get USDC transfer history:', errorMessage)

    return {
      transfers: [],
      success: false,
      error: errorMessage,
    }
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
    console.log(`🔍 Getting transaction details for: ${transactionHash}`)

    // Get transaction and receipt in parallel
    const [transaction, receipt] = await Promise.all([
      alchemySDK.core.getTransaction(transactionHash),
      alchemySDK.core.getTransactionReceipt(transactionHash),
    ])

    console.log(`✅ Retrieved transaction details`)

    return {
      transaction,
      receipt,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get transaction details:', errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
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
    type = 'ETH Transfer'
  } else if (transfer.category === 'internal') {
    type = 'Contract Interaction'
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
 * Check if address has any transaction history
 */
export async function hasTransactionHistory(address: string): Promise<{
  hasHistory: boolean
  transactionCount: number
  success: boolean
  error?: string
}> {
  try {
    console.log(`🔍 Checking transaction history for: ${address}`)

    const response = await getWalletTransfers(address, {
      maxCount: 1,
      order: 'desc',
    })

    if (!response.success) {
      return {
        hasHistory: false,
        transactionCount: 0,
        success: false,
        error: response.error,
      }
    }

    const hasHistory = response.transfers.length > 0

    // If there are transfers, get a rough count
    let transactionCount = 0
    if (hasHistory) {
      const fullResponse = await getWalletTransfers(address, {
        maxCount: 1000, // Get up to 1000 to estimate
      })
      transactionCount = fullResponse.transfers.length
    }

    console.log(`✅ Address has ${transactionCount} transactions`)

    return {
      hasHistory,
      transactionCount,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to check transaction history:', errorMessage)

    return {
      hasHistory: false,
      transactionCount: 0,
      success: false,
      error: errorMessage,
    }
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
