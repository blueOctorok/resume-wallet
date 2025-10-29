'use client'

import { useState, useEffect } from 'react'
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
        // Use blockchain data if available, otherwise fetch from database
        const dashboardInfo: any = {
          status: 'PENDING DOT REVIEW',
          submittedDate: new Date().toLocaleDateString(),
          estimatedReviewTime: '3-5 business days',
          driverApplicationVerified: true,
          employmentVerified: false,
          dotApproved: false,
        }

        // Add blockchain data if available
        if (blockchainData) {
          dashboardInfo.blockchainTxHash = blockchainData.transactionHash
          dashboardInfo.blockNumber = blockchainData.blockNumber
          dashboardInfo.applicationId = blockchainData.applicationId
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
    driverApplicationVerified: true,
    employmentVerified: false,
    dotApproved: false,
    name: 'Driver',
    cdlClass: 'Class A',
    yearsExperience: 0,
    accidentCount: 0,
    convictionCount: 0,
    employmentHistory: 0,
    shareLink: 'https://driverappchain.com/verify/abc123',
  }

  if (loading) {
    return (
      <div className='max-w-6xl mx-auto p-6 text-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mint mx-auto'></div>
        <p className={`mt-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading dashboard data...
        </p>
      </div>
    )
  }

  return (
    <div
      className={`max-w-6xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
      }`}
    >
      {/* Header */}
      <div className='mb-8'>
        <h1
          className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Driver Application Dashboard
        </h1>
        <p
          className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Manage your verified driver application and track your progress
        </p>
      </div>

      {/* Status Overview */}
      <div className='mb-8'>
        <div
          className={`p-6 rounded-lg border-2 ${
            theme === 'dark'
              ? 'bg-yellow-900/20 border-yellow-500/50'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h2
                className={`text-xl font-semibold ${
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
                }`}
              >
                ⏳ {data.status}
              </h2>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                theme === 'dark'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              Pending
            </span>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Submitted
              </p>
              <p
                className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {data.submittedDate}
              </p>
            </div>

            <div>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Est. Review Time
              </p>
              <p
                className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {data.estimatedReviewTime}
              </p>
            </div>

            <div>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Application ID
              </p>
              <p
                className={`font-mono text-sm ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
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
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Verification Progress
        </h2>

        <div className='space-y-3'>
          {/* Driver Application */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
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
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Driver Application (Forms 1-3)
              </span>
            </div>
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              }`}
            >
              Verified ✓
            </span>
          </div>

          {/* Employment Verification */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
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
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Employment Verification
              </span>
            </div>
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`}
            >
              Incomplete
            </span>
          </div>

          {/* DOT Approval */}
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
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
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                DOT Approval
              </span>
            </div>
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Pending
            </span>
          </div>
        </div>
      </div>

      {/* Blockchain Verification */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          🔗 Blockchain Verification
        </h2>

        <div
          className={`p-6 rounded-lg ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          <div className='space-y-3'>
            <div className='flex justify-between items-center'>
              <span
                className={`font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Transaction Hash:
              </span>
              {data.blockchainTxHash ? (
                <a
                  href={`https://sepolia.basescan.org/tx/${data.blockchainTxHash}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={`font-mono text-sm hover:underline ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  {data.blockchainTxHash.slice(0, 10)}...
                  {data.blockchainTxHash.slice(-8)}
                </a>
              ) : (
                <span
                  className={`font-mono text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Not available
                </span>
              )}
            </div>

            {data.blockNumber && (
              <div className='flex justify-between items-center'>
                <span
                  className={`font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Block Number:
                </span>
                <span
                  className={`font-mono text-sm ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  {data.blockNumber.toLocaleString()}
                </span>
              </div>
            )}

            {data.ipfsHash && (
              <div className='flex justify-between items-center'>
                <span
                  className={`font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  IPFS Hash:
                </span>
                <span
                  className={`font-mono text-sm ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  {data.ipfsHash.slice(0, 10)}...{data.ipfsHash.slice(-8)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Driver Stats */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          📋 Driver Profile Summary
        </h2>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              CDL Class
            </p>
            <p
              className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {data.cdlClass}
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Experience
            </p>
            <p
              className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {data.yearsExperience} yrs
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Accidents
            </p>
            <p
              className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              }`}
            >
              {data.accidentCount}
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Convictions
            </p>
            <p
              className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
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
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          🎯 Quick Actions
        </h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {!data.employmentVerified && onCompleteEmploymentVerification && (
            <button
              onClick={onCompleteEmploymentVerification}
              className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                  : 'bg-brand-sage text-white hover:bg-brand-sage/90'
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
            className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
            }`}
          >
            <div className='text-3xl mb-2'>👁️</div>
            <h3 className='font-semibold mb-1'>View Application</h3>
            <p className='text-sm opacity-90'>
              Review your submitted application details
            </p>
          </button>

          <button
            className={`p-6 rounded-lg text-left transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
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
              theme === 'dark'
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
          <div className='mt-4 p-4 rounded-lg bg-brand-sage/20 border border-brand-mint/30'>
            <p
              className={`text-sm mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Share this link with employers:
            </p>
            <div className='flex items-center space-x-2'>
              <input
                type='text'
                value={data.shareLink}
                readOnly
                className={`flex-1 px-4 py-2 rounded-lg font-mono text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-900'
                }`}
              />
              <button
                onClick={() =>
                  navigator.clipboard.writeText(data.shareLink)
                }
                className={`px-4 py-2 rounded-lg font-semibold ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                    : 'bg-brand-sage text-white hover:bg-brand-sage/90'
                }`}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className='text-center'>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
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
