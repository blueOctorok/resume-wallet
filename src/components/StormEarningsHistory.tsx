'use client'

import { useState, useEffect } from 'react'
import { Download, ExternalLink, RefreshCw, Coins, TrendingUp } from 'lucide-react'

interface Distribution {
  id: string
  amountStorm: number
  usdcSpent: number
  paymentType: string
  userType: string
  rateMultiplier: number
  txHash: string
  createdAt: string
  totalDistributedBefore: number
}

interface Summary {
  totalEarned: number
  totalUsdcSpent: number
  transactionCount: number
  averageRate: number
}

interface StormEarningsHistoryProps {
  walletAddress: string
  compact?: boolean
}

export default function StormEarningsHistory({
  walletAddress,
  compact = false,
}: StormEarningsHistoryProps) {
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    if (!walletAddress) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/storm/history', {
        headers: {
          'x-wallet-address': walletAddress,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch history')
      }

      setDistributions(data.distributions || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [walletAddress])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPaymentType = (type: string) => {
    const labels: Record<string, string> = {
      MVR_ORDER: 'MVR Report',
      RESUME_VERIFICATION: 'Resume Verification',
      SUBSCRIPTION: 'Subscription',
      BACKGROUND_CHECK: 'Background Check',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const exportToCSV = () => {
    if (distributions.length === 0) return

    const headers = [
      'Date',
      'STORM Earned',
      'USDC Spent',
      'Payment Type',
      'User Type',
      'Rate Multiplier',
      'Transaction Hash',
      'BaseScan Link',
    ]

    const rows = distributions.map(d => [
      new Date(d.createdAt).toISOString(),
      d.amountStorm.toFixed(6),
      d.usdcSpent.toFixed(2),
      d.paymentType,
      d.userType,
      d.rateMultiplier.toString(),
      d.txHash,
      `https://sepolia.basescan.org/tx/${d.txHash}`,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    // Add summary at the bottom
    const summarySection = [
      '',
      'SUMMARY',
      `Total STORM Earned,${summary?.totalEarned.toFixed(6) || '0'}`,
      `Total USDC Spent,${summary?.totalUsdcSpent.toFixed(2) || '0'}`,
      `Total Transactions,${summary?.transactionCount || 0}`,
      `Average Rate (STORM/USDC),${summary?.averageRate.toFixed(4) || '0'}`,
      '',
      `Wallet Address,${walletAddress}`,
      `Export Date,${new Date().toISOString()}`,
    ].join('\n')

    const fullCSV = csvContent + '\n\n' + summarySection

    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `storm-earnings-${walletAddress.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="w-5 h-5 animate-spin text-yellow-500 mr-2" />
        <span className="text-gray-400">Loading earnings history...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-300 text-sm">Total Earned</span>
          </div>
          <span className="text-yellow-400 font-mono font-medium">
            {summary?.totalEarned.toFixed(2) || '0'} STORM
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">From {summary?.transactionCount || 0} purchases</span>
          {distributions.length > 0 && (
            <button
              onClick={exportToCSV}
              className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-white">STORM Earnings</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {distributions.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 
                         rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Total Earned</p>
            <p className="text-lg font-mono font-semibold text-yellow-400">
              {summary.totalEarned.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">STORM</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Total Spent</p>
            <p className="text-lg font-mono font-semibold text-blue-400">
              ${summary.totalUsdcSpent.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">USDC</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Transactions</p>
            <p className="text-lg font-mono font-semibold text-white">
              {summary.transactionCount}
            </p>
            <p className="text-xs text-gray-500">purchases</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Avg Rate</p>
            <p className="text-lg font-mono font-semibold text-green-400">
              {summary.averageRate.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">STORM/$</p>
          </div>
        </div>
      )}

      {/* Transaction List */}
      {distributions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No STORM earnings yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Make a purchase to start earning STORM tokens
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {distributions.map((d) => (
            <div
              key={d.id}
              className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 
                         hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">
                      +{d.amountStorm.toFixed(4)} STORM
                    </span>
                    {d.userType === 'employer' && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        0.5x
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {formatPaymentType(d.paymentType)} • ${d.usdcSpent.toFixed(2)} USDC
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{formatDate(d.createdAt)}</p>
                  <a
                    href={`https://sepolia.basescan.org/tx/${d.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1 justify-end"
                  >
                    View tx
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Note */}
      <p className="text-xs text-gray-500 text-center">
        All transactions are recorded on the Base blockchain and can be verified on BaseScan
      </p>
    </div>
  )
}
