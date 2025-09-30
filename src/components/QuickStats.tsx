'use client'

import { useState, useEffect } from 'react'

interface Stats {
  userResumes: number
  userBlockchainVerified: number
  userPublicResumes: number
  lastUpdated: string
}

interface QuickStatsProps {
  userAddress?: string
}

export default function QuickStats({ userAddress }: QuickStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    if (!userAddress) {
      setStats(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('📊 QuickStats: Fetching user stats for:', userAddress)
      const response = await fetch(
        `/api/users/profile?walletAddress=${userAddress}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch user stats: ${response.statusText}`)
      }

      const userData = await response.json()
      console.log('✅ QuickStats: User data fetched successfully:', userData)

      // Calculate stats from user data
      const resumes = userData.resumes || []
      const userStats: Stats = {
        userResumes: resumes.length,
        userBlockchainVerified: resumes.filter((r: any) => r.ipfs_hash).length,
        userPublicResumes: resumes.filter((r: any) => r.is_public).length,
        lastUpdated: new Date().toISOString(),
      }

      setStats(userStats)
    } catch (err) {
      console.error('❌ QuickStats: Error fetching user stats:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to fetch user stats'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Removed automatic polling - stats only refresh on manual button click or user address change
  }, [userAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't show anything if user is not logged in
  if (!userAddress) {
    return null
  }

  if (loading && !stats) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Your Stats</h3>
        <div className='space-y-3'>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='flex justify-between'>
              <div className='h-4 bg-gray-200 rounded w-24 animate-pulse'></div>
              <div className='h-4 bg-gray-200 rounded w-8 animate-pulse'></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Your Stats</h3>
        <div className='text-center py-4'>
          <p className='text-red-600 text-sm mb-2'>Failed to load stats</p>
          <button
            onClick={fetchStats}
            className='text-blue-600 hover:text-blue-800 text-sm underline'
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium text-gray-900'>Your Stats</h3>
        <button
          onClick={fetchStats}
          disabled={loading}
          className='text-gray-400 hover:text-gray-600 transition-colors'
          title='Refresh stats'
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            />
          </svg>
        </button>
      </div>

      <div className='space-y-3'>
        <div className='flex justify-between'>
          <span className='text-gray-600'>Your Resumes</span>
          <span className='font-medium text-gray-900'>
            {stats?.userResumes || 0}
          </span>
        </div>
        <div className='flex justify-between'>
          <span className='text-gray-600'>Blockchain Verified</span>
          <span className='font-medium text-gray-900'>
            {stats?.userBlockchainVerified || 0}
          </span>
        </div>
        <div className='flex justify-between'>
          <span className='text-gray-600'>Public Resumes</span>
          <span className='font-medium text-gray-900'>
            {stats?.userPublicResumes || 0}
          </span>
        </div>
      </div>

      {stats?.lastUpdated && (
        <div className='mt-4 pt-3 border-t border-gray-100'>
          <p className='text-xs text-gray-500'>
            Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  )
}
