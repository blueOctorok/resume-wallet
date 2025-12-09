'use client'

import { useEffect, useState } from 'react'

interface CreditsData {
  wallet?: string
  has_credits?: boolean
  remaining?: number
  total?: number
  created_at?: string
  expires_at?: string
  error?: string
}

export function CreditsDisplay() {
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/admin/credits')
      const data = await response.json()
      setCredits(data)
    } catch (error) {
      console.error('Failed to fetch credits:', error)
      setCredits({ error: 'Failed to fetch credits' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredits()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return null
  }

  if (credits?.error) {
    return null
  }

  if (!credits?.has_credits) {
    return null
  }

  const remaining = credits.remaining || 0
  const total = credits.total || 0
  const percentage = total > 0 ? (remaining / total) * 100 : 0
  const expiresAt = credits.expires_at ? new Date(credits.expires_at) : null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isVisible ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[250px] border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              AI Credits
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {remaining}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                / {total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  percentage > 50
                    ? 'bg-green-500'
                    : percentage > 20
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>Value: ${(remaining * 0.00052).toFixed(4)} USDC</div>
              <div className="text-gray-400">~$0.00052 per request</div>
              {expiresAt && (
                <div>Expires: {expiresAt.toLocaleDateString()}</div>
              )}
            </div>

            {credits.wallet && (
              <div className="text-xs text-gray-400 dark:text-gray-500 truncate pt-2 border-t border-gray-200 dark:border-gray-700">
                {credits.wallet.slice(0, 6)}...{credits.wallet.slice(-4)}
              </div>
            )}
          </div>

          <button
            onClick={fetchCredits}
            className="mt-3 w-full text-xs py-1 px-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
          title="Show credits"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">💳</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {remaining}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}

