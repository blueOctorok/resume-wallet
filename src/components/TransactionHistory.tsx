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
import { useTheme } from '@/contexts/ThemeContext'

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
  const { theme } = useTheme()
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
      <div className={`p-6 rounded-lg ${
        theme === 'dark'
          ? 'bg-brand-sage-light/10 border border-brand-cream/20'
          : 'bg-white border border-gray-200'
      }`}>
        <div className='flex items-center space-x-2'>
          <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${
            theme === 'dark' ? 'border-brand-mint' : 'border-blue-600'
          }`}></div>
          <span className={theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'}>
            Loading transaction history...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg ${
        theme === 'dark'
          ? 'bg-brand-sage-light/10 border border-brand-cream/20'
          : 'bg-white border border-gray-200'
      }`}>
        <div className={`mb-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          <span>❌</span> Error: {error}
        </div>
        <button
          onClick={handleRefresh}
          className={`px-4 py-2 rounded-md ${
            theme === 'dark'
              ? 'bg-brand-mint hover:bg-brand-mint/80 text-brand-sage'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-lg ${
      theme === 'dark'
        ? 'bg-transparent'
        : 'bg-white'
    }`}>
      {/* Header */}
      {showFilters && (
        <div className={`p-4 border-b ${
          theme === 'dark' ? 'border-brand-mint/20' : 'border-gray-200'
        }`}>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={`text-xl font-bold ${
              theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
            }`}>📊 Transaction History</h2>
            <button
              onClick={handleRefresh}
              className={`text-sm underline ${
                theme === 'dark'
                  ? 'text-brand-mint hover:text-brand-cream'
                  : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              🔄 Refresh
            </button>
          </div>

          {/* Summary */}
          <div className={`flex flex-wrap items-center gap-2 text-xs mb-4 ${
            theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
          }`}>
            <span>
              Address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </span>
            <span>•</span>
            <span>Total: {transactionCount}</span>
            <span>•</span>
            <span>Showing: {transfers.length}</span>
          </div>

          {/* Filters */}
          <div className='flex flex-wrap gap-2'>
            {(['all', 'from', 'to', 'resume', 'usdc'] as FilterType[]).map(
              (filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === filterType
                      ? theme === 'dark'
                        ? 'bg-brand-mint text-brand-sage'
                        : 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-brand-sage-light/20 text-brand-cream/70 hover:bg-brand-sage-light/30'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getFilterLabel(filterType)}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className='max-h-[400px] overflow-y-auto'>
        {transfers.length === 0 ? (
          <div className={`p-6 text-center ${
            theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-500'
          }`}>
            <div className='text-4xl mb-2'>📭</div>
            <div>No transactions found</div>
            <div className='text-xs mt-1'>
              {hasHistory
                ? 'Try adjusting the filter'
                : 'This address has no transaction history'}
            </div>
          </div>
        ) : (
          <div className={`divide-y ${
            theme === 'dark' ? 'divide-brand-mint/20' : 'divide-gray-200'
          }`}>
            {transfers.map((transfer, index) => {
              const formatted = formatTransferForDisplay(transfer)

              return (
                <div
                  key={`${transfer.hash}-${index}`}
                  className={`p-4 transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-brand-sage-light/10'
                      : 'hover:bg-gray-50'
                  }`}
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
                          <div className={`font-medium ${
                            theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
                          }`}>
                            {formatted.type}
                          </div>
                          <div className={`text-xs ${
                            theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-500'
                          }`}>
                            {formatted.timestamp}
                          </div>
                        </div>
                      </div>

                      <div className={`mt-2 text-xs ${
                        theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
                      }`}>
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
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
                      }`}>
                        {formatted.amount} {transfer.asset || 'ETH'}
                      </div>
                      <div className={`text-xs ${
                        theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-500'
                      }`}>
                        Block #{formatted.blockNumber}
                      </div>
                    </div>
                  </div>

                  <div className='mt-2'>
                    <a
                      href={`https://sepolia.basescan.org/tx/${transfer.hash}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={`text-xs underline ${
                        theme === 'dark'
                          ? 'text-brand-mint hover:text-brand-cream'
                          : 'text-blue-600 hover:text-blue-800'
                      }`}
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
        <div className={`p-4 border-t text-center ${
          theme === 'dark' ? 'border-brand-mint/20' : 'border-gray-200'
        }`}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              loadingMore
                ? theme === 'dark'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-400 text-white cursor-not-allowed'
                : theme === 'dark'
                  ? 'bg-brand-mint hover:bg-brand-mint/80 text-brand-sage'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loadingMore ? '⏳ Loading...' : '📄 Load More'}
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className={`px-4 py-3 text-xs text-center ${
        theme === 'dark'
          ? 'text-brand-cream/50'
          : 'bg-gray-50 text-gray-500'
      }`}>
        Powered by Alchemy Transfers API • Base Sepolia Network
        {autoRefresh && (
          <> • Auto-refreshes every {Math.floor(refreshInterval / 1000)}s</>
        )}
      </div>
    </div>
  )
}
