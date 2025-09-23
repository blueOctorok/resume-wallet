'use client'

import { useState, useEffect } from 'react'
import {
  getWalletTransfers,
  getTransactionsFrom,
  getTransactionsTo,
  getResumeVerificationHistory,
  getUSDCTransferHistory,
  formatTransferForDisplay,
  parseTransactionHistory,
  hasTransactionHistory,
  TransferResult,
  BASE_SEPOLIA_USDC_ADDRESS,
} from '@/lib/alchemy-transfers-api'

interface TransactionHistoryProps {
  walletAddress: string
  contractAddress?: string
  maxTransactions?: number
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

type FilterType = 'all' | 'from' | 'to' | 'resume' | 'usdc'

export default function TransactionHistory({
  walletAddress,
  contractAddress,
  maxTransactions = 50,
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 30000,
}: TransactionHistoryProps) {
  const [transfers, setTransfers] = useState<TransferResult[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [hasHistory, setHasHistory] = useState<boolean>(false)
  const [transactionCount, setTransactionCount] = useState<number>(0)
  const [pageKey, setPageKey] = useState<string | undefined>()
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  const fetchTransfers = async (isLoadMore = false) => {
    if (!walletAddress) {
      setError('No wallet address provided')
      setLoading(false)
      return
    }

    try {
      if (!isLoadMore) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      let response
      const options = {
        maxCount: maxTransactions,
        pageKey: isLoadMore ? pageKey : undefined,
      }

      // Fetch based on filter (following Alchemy tutorial patterns)
      switch (filter) {
        case 'from':
          // Get transactions originating FROM the address (what user sent/spent)
          response = await getTransactionsFrom(walletAddress, options)
          break
        case 'to':
          // Get transactions sent TO the address (what user received)
          response = await getTransactionsTo(walletAddress, options)
          break
        case 'resume':
          response = await getResumeVerificationHistory(
            walletAddress,
            contractAddress,
            options
          )
          break
        case 'usdc':
          response = await getUSDCTransferHistory(
            walletAddress,
            BASE_SEPOLIA_USDC_ADDRESS,
            options
          )
          break
        case 'all':
        default:
          // Get complete transaction history (both from and to)
          response = await getWalletTransfers(walletAddress, options)
          break
      }

      if (!response.success) {
        setError(response.error || 'Failed to fetch transaction history')
        setTransfers([])
      } else {
        if (isLoadMore) {
          setTransfers((prev) => [...prev, ...response.transfers])
        } else {
          setTransfers(response.transfers)
        }
        setPageKey(response.pageKey)
      }

      // Check if address has any history (only on initial load)
      if (!isLoadMore) {
        const historyCheck = await hasTransactionHistory(walletAddress)
        if (historyCheck.success) {
          setHasHistory(historyCheck.hasHistory)
          setTransactionCount(historyCheck.transactionCount)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('❌ Error fetching transaction history:', errorMessage)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Initial fetch and filter changes
  useEffect(() => {
    fetchTransfers()
  }, [walletAddress, filter])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => fetchTransfers(), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, walletAddress, filter])

  const handleLoadMore = () => {
    if (pageKey && !loadingMore) {
      fetchTransfers(true)
    }
  }

  const handleRefresh = () => {
    setPageKey(undefined)
    fetchTransfers()
  }

  const getFilterLabel = (filterType: FilterType): string => {
    switch (filterType) {
      case 'all':
        return 'All Transactions'
      case 'from':
        return 'Sent (From)'
      case 'to':
        return 'Received (To)'
      case 'resume':
        return 'Resume Verifications'
      case 'usdc':
        return 'USDC Transfers'
      default:
        return 'All Transactions'
    }
  }

  if (loading) {
    return (
      <div className='p-6 bg-white rounded-lg shadow-md'>
        <div className='flex items-center space-x-2'>
          <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600'></div>
          <span className='text-gray-600'>Loading transaction history...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-6 bg-white rounded-lg shadow-md'>
        <div className='text-red-600 mb-4'>
          <span className='text-red-600'>❌</span> Error: {error}
        </div>
        <button
          onClick={handleRefresh}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className='bg-white rounded-lg shadow-md'>
      {/* Header */}
      <div className='p-6 border-b border-gray-200'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-2xl font-bold'>📊 Transaction History</h2>
          <button
            onClick={handleRefresh}
            className='text-sm text-blue-600 hover:text-blue-800 underline'
          >
            🔄 Refresh
          </button>
        </div>

        {/* Summary */}
        <div className='flex items-center space-x-4 text-sm text-gray-600 mb-4'>
          <span>
            Address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </span>
          <span>•</span>
          <span>Total Transactions: {transactionCount}</span>
          <span>•</span>
          <span>Showing: {transfers.length}</span>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className='flex space-x-2'>
            {(['all', 'from', 'to', 'resume', 'usdc'] as FilterType[]).map(
              (filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filter === filterType
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getFilterLabel(filterType)}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className='max-h-96 overflow-y-auto'>
        {transfers.length === 0 ? (
          <div className='p-6 text-center text-gray-500'>
            <div className='text-4xl mb-2'>📭</div>
            <div>No transactions found</div>
            <div className='text-sm mt-1'>
              {hasHistory
                ? 'Try adjusting the filter'
                : 'This address has no transaction history'}
            </div>
          </div>
        ) : (
          <div className='divide-y divide-gray-200'>
            {transfers.map((transfer, index) => {
              const formatted = formatTransferForDisplay(transfer)

              return (
                <div
                  key={`${transfer.hash}-${index}`}
                  className='p-4 hover:bg-gray-50'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center space-x-3'>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            formatted.category === 'erc20'
                              ? 'bg-green-500'
                              : formatted.category === 'external'
                                ? 'bg-blue-500'
                                : formatted.category === 'internal'
                                  ? 'bg-purple-500'
                                  : 'bg-gray-500'
                          }`}
                        ></div>
                        <div>
                          <div className='font-medium text-gray-900'>
                            {formatted.type}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {formatted.timestamp}
                          </div>
                        </div>
                      </div>

                      <div className='mt-2 text-sm text-gray-600'>
                        <div>
                          From: {formatted.from.slice(0, 10)}...
                          {formatted.from.slice(-8)}
                        </div>
                        <div>
                          To: {formatted.to.slice(0, 10)}...
                          {formatted.to.slice(-8)}
                        </div>
                      </div>
                    </div>

                    <div className='text-right'>
                      <div className='font-medium text-gray-900'>
                        {formatted.amount} {transfer.asset || 'ETH'}
                      </div>
                      <div className='text-xs text-gray-500'>
                        Block #{formatted.blockNumber}
                      </div>
                    </div>
                  </div>

                  <div className='mt-2'>
                    <a
                      href={`https://sepolia.basescan.org/tx/${transfer.hash}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-xs text-blue-600 hover:text-blue-800 underline'
                    >
                      View on BaseScan →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Load More */}
      {pageKey && (
        <div className='p-4 border-t border-gray-200 text-center'>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              loadingMore
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loadingMore ? '⏳ Loading...' : '📄 Load More'}
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className='px-6 py-3 bg-gray-50 rounded-b-lg text-xs text-gray-500 text-center'>
        Powered by Alchemy Transfers API • Base Sepolia Network
        {autoRefresh &&
          ` • Auto-refreshes every ${Math.floor(refreshInterval / 1000)}s`}
      </div>
    </div>
  )
}
