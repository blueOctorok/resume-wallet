'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import ComplianceReview from './ComplianceReview'
import { useTheme } from '@/contexts/ThemeContext'

interface DriverDashboardProps {
  onCompleteEmploymentVerification?: () => void
  userAddress?: string
  blockchainData?: {
    transactionHash: string
    blockNumber: number
    applicationId: number | null
  } | null
}

const DriverDashboard = ({
  onCompleteEmploymentVerification,
  userAddress,
  blockchainData,
}: DriverDashboardProps) => {
  const { theme } = useTheme()
  const [showShareLink, setShowShareLink] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch real data from database
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userAddress) {
        setLoading(false)
        return
      }

      try {
        const { createClient } = await import('@/utils/supabase/client')
        const supabase = createClient()

        // Get user id by wallet address
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', userAddress)
          .single()

        if (userErr || !userRow) {
          setDashboardData(null)
          return
        }

        // Get latest driver application for user
        const { data: appRows } = await supabase
          .from('driver_applications')
          .select(
            'id, created_at, is_complete, verification_status'
          )
          .eq('user_id', userRow.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const latest = appRows && appRows.length > 0 ? appRows[0] : null

        const submittedDate = latest?.created_at
          ? new Date(latest.created_at)
          : new Date()

        // DEC-2026-07-001: do not surface Base tx / whole-app VERIFIED as issuer proof
        const dashboardInfo: any = {
          status: latest?.is_complete ? 'SUBMITTED' : (latest?.verification_status || 'PENDING'),
          submittedDate: submittedDate.toLocaleDateString(),
          estimatedReviewTime: '3-5 business days',
          driverApplicationVerified: false,
          employmentVerified: false,
          dotApproved: false,
          applicationId: latest?.id ?? null,
          shareLink: '',
        }

        setDashboardData(dashboardInfo)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [userAddress, blockchainData])

  // Use dashboard data or fallback to basic info
  const data = dashboardData || {
    status: 'PENDING DOT REVIEW',
    submittedDate: new Date().toLocaleDateString(),
    estimatedReviewTime: '3-5 business days',
    driverApplicationVerified: false,
    employmentVerified: false,
    dotApproved: false,
    name: 'Driver',
    cdlClass: 'Class A',
    yearsExperience: 0,
    accidentCount: 0,
    convictionCount: 0,
    employmentHistory: 0,
    shareLink: '',
  }

  // Status display mapping
  const normalizedStatus = (data.status || '').toString().toUpperCase()
  const statusDisplay = (() => {
    switch (normalizedStatus) {
      case 'VERIFIED':
        // Legacy whole-app DB flag — not issuer verification (DEC-2026-07-001)
        return { label: 'Submitted', tone: 'success' as const }
      case 'REJECTED':
      case 'FAILED':
        return { label: 'Failed', tone: 'danger' as const }
      case 'SUBMITTED':
        return { label: 'Submitted', tone: 'success' as const }
      case 'PENDING DOT REVIEW':
      case 'PENDING':
      default:
        return { label: 'Pending', tone: 'warning' as const }
    }
  })()

  if (loading) {
    return (
      <div className='max-w-6xl mx-auto p-6 text-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto'></div>
        <p className={`mt-4 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading dashboard data...
        </p>
      </div>
    )
  }

  return (
    <div
      className={`max-w-6xl mx-auto p-6 ${
        isDarkTheme(theme)
          ? 'bg-teal-200/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        isDarkTheme(theme) ? 'border-teal-500' : 'border-teal-700'
      }`}
    >
      {/* Header */}
      <div className='mb-8'>
        <h1
          className={`text-3xl font-bold mb-2 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Driver Application Dashboard
        </h1>
        <p
          className={`text-lg ${
            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Manage your verified driver application and track your progress
        </p>
      </div>

      {/* Status Overview */}
      <div className='mb-8'>
        <div
          className={`p-6 rounded-lg border-2 ${
            statusDisplay.tone === 'success'
              ? isDarkTheme(theme)
                ? 'bg-green-900/20 border-green-500/50'
                : 'bg-green-50 border-green-200'
              : statusDisplay.tone === 'danger'
                ? isDarkTheme(theme)
                  ? 'bg-red-900/20 border-red-500/50'
                  : 'bg-red-50 border-red-200'
                : isDarkTheme(theme)
                  ? 'bg-yellow-900/20 border-yellow-500/50'
                  : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h2
                className={`text-xl font-semibold ${
                  statusDisplay.tone === 'success'
                    ? isDarkTheme(theme) ? 'text-green-400' : 'text-green-800'
                    : statusDisplay.tone === 'danger'
                      ? isDarkTheme(theme) ? 'text-red-400' : 'text-red-800'
                      : isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-800'
                }`}
              >
                {statusDisplay.tone === 'success' ? '✅' : statusDisplay.tone === 'danger' ? '❌' : '⏳'} {data.status}
              </h2>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                statusDisplay.tone === 'success'
                  ? isDarkTheme(theme)
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-green-100 text-green-800'
                  : statusDisplay.tone === 'danger'
                    ? isDarkTheme(theme)
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-red-100 text-red-800'
                    : isDarkTheme(theme)
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {statusDisplay.label}
            </span>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <p
                className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Submitted
              </p>
              <p
                className={`font-semibold ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                {data.submittedDate}
              </p>
            </div>

            <div>
              <p
                className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Est. Review Time
              </p>
              <p
                className={`font-semibold ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                {data.estimatedReviewTime}
              </p>
            </div>

            <div>
              <p
                className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Application ID
              </p>
              <p
                className={`font-mono text-sm ${
                  isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                }`}
              >
                {data.applicationId ? `#${data.applicationId}` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Progress */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Verification Progress
        </h2>

        <div className='space-y-3'>
          {/* Driver Application */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <div className='flex items-center space-x-3'>
              {data.driverApplicationVerified ? (
                <div className='w-6 h-6 rounded-full bg-green-500 flex items-center justify-center'>
                  <svg
                    className='h-4 w-4 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                </div>
              ) : (
                <div className='w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center'>
                  <div className='w-2 h-2 rounded-full bg-gray-200' />
                </div>
              )}
              <span
                className={`font-medium ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                Driver Application (Forms 1-3)
              </span>
            </div>
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
              }`}
            >
              Verified ✓
            </span>
          </div>

          {/* Employment Verification */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <div className='flex items-center space-x-3'>
              {data.employmentVerified ? (
                <div className='w-6 h-6 rounded-full bg-green-500 flex items-center justify-center'>
                  <svg
                    className='h-4 w-4 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                </div>
              ) : (
                <div className='w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center'>
                  <div className='w-2 h-2 rounded-full bg-yellow-200' />
                </div>
              )}
              <span
                className={`font-medium ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                Employment Verification
              </span>
            </div>
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-600'
              }`}
            >
              Incomplete
            </span>
          </div>

          {/* DOT Approval */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <div className='flex items-center space-x-3'>
              {data.dotApproved ? (
                <div className='w-6 h-6 rounded-full bg-green-500 flex items-center justify-center'>
                  <svg
                    className='h-4 w-4 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                </div>
              ) : (
                <div className='w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center'>
                  <div className='w-2 h-2 rounded-full bg-gray-200' />
                </div>
              )}
              <span
                className={`font-medium ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                DOT Approval
              </span>
            </div>
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Pending
            </span>
          </div>
        </div>
      </div>

      {/* AI Compliance Review */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          🤖 AI Compliance Review
        </h2>
        <ComplianceReview
          applicationSummary={
            (() => {
              const parts: string[] = []
              if (data.applicationId) parts.push(`Application ID: ${data.applicationId}`)
              if (data.submittedDate) parts.push(`Submitted: ${data.submittedDate}`)
              return parts.join(' | ')
            })()
          }
        />
      </div>

      {/* Verified coverage (DEC-2026-07-001) */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Verified coverage
        </h2>

        <div
          className={`p-6 rounded-lg ${
            isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}`}>
            Submitting this application does not mark it verified. Issuer-backed
            MVR, PSP, and prior-employer confirmations lock fields and raise your
            live verified %. A packet headlines &quot;Verified&quot; only when a
            majority of risk-bearing fields are issuer-backed.
          </p>
        </div>
      </div>

      {/* Driver Stats */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          📋 Driver Profile Summary
        </h2>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div
            className={`p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              CDL Class
            </p>
            <p
              className={`text-2xl font-bold ${
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
              }`}
            >
              {data.cdlClass}
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Experience
            </p>
            <p
              className={`text-2xl font-bold ${
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
              }`}
            >
              {data.yearsExperience} yrs
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Accidents
            </p>
            <p
              className={`text-2xl font-bold ${
                isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
              }`}
            >
              {data.accidentCount}
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Convictions
            </p>
            <p
              className={`text-2xl font-bold ${
                isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
              }`}
            >
              {data.convictionCount}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          🎯 Quick Actions
        </h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {!data.employmentVerified && onCompleteEmploymentVerification && (
            <button
              onClick={onCompleteEmploymentVerification}
              className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                isDarkTheme(theme)
                  ? 'bg-teal-600 text-white hover:bg-teal-500'
                  : 'bg-teal-700 text-white hover:bg-teal-700/90'
              }`}
            >
              <div className='text-3xl mb-2'>📝</div>
              <h3 className='font-semibold mb-1'>
                Complete Employment Verification
              </h3>
              <p className='text-sm opacity-90'>
                Finish your employment verification to complete your profile
              </p>
            </button>
          )}

          <button
            disabled
            title='Coming soon'
            className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg ${
              isDarkTheme(theme)
                ? 'bg-gray-800 text-white opacity-60 cursor-not-allowed'
                : 'bg-gray-50 text-gray-900 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className='text-3xl mb-2'>👁️</div>
            <h3 className='font-semibold mb-1'>View Application</h3>
            <p className='text-sm opacity-90'>
              Review your submitted application details
            </p>
          </button>

          <button
            disabled
            title='Coming soon'
            className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg ${
              isDarkTheme(theme)
                ? 'bg-gray-800 text-white opacity-60 cursor-not-allowed'
                : 'bg-gray-50 text-gray-900 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className='text-3xl mb-2'>📄</div>
            <h3 className='font-semibold mb-1'>Download PDF</h3>
            <p className='text-sm opacity-90'>
              Download your verified application as PDF
            </p>
          </button>

          <button
            onClick={() => setShowShareLink(!showShareLink)}
            className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              isDarkTheme(theme)
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
            }`}
          >
            <div className='text-3xl mb-2'>🔗</div>
            <h3 className='font-semibold mb-1'>Share with Employers</h3>
            <p className='text-sm opacity-90'>
              Generate a shareable verification link
            </p>
          </button>
        </div>

        {/* Share Link Modal */}
        {showShareLink && (
          <div className='mt-4 p-4 rounded-lg bg-teal-700/20 border border-teal-500/30'>
            <p
              className={`text-sm mb-2 ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Share this link with employers:
            </p>
            {data.shareLink ? (
              <div className='flex items-center space-x-2'>
                <input
                  type='text'
                  value={data.shareLink}
                  readOnly
                  className={`flex-1 px-4 py-2 rounded-lg font-mono text-sm ${
                    isDarkTheme(theme)
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(data.shareLink)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    isDarkTheme(theme)
                      ? 'bg-teal-600 text-white hover:bg-teal-500'
                      : 'bg-teal-700 text-white hover:bg-teal-700/90'
                  }`}
                >
                  Copy
                </button>
              </div>
            ) : (
              <div
                className={`px-4 py-2 rounded-lg text-sm ${
                  isDarkTheme(theme)
                    ? 'bg-gray-800 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                No shareable link available yet. Submit an application to get a link.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className='text-center'>
        <p
          className={`text-sm ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Your application data is securely stored on the blockchain and cannot
          be tampered with.
        </p>
      </div>
    </div>
  )
}

export default DriverDashboard
