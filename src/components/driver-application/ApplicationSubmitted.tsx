'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Shield } from 'lucide-react'

interface ApplicationSubmittedProps {
  onNavigateToSafetyForm: () => void
  onNavigateToDashboard?: () => void
  blockchainData?: {
    transactionHash: string
    blockNumber: number
    applicationId: number | null
  } | null
}

const ApplicationSubmitted = ({
  onNavigateToSafetyForm,
  onNavigateToDashboard,
  blockchainData,
}: ApplicationSubmittedProps) => {
  const { theme } = useTheme()
  // Since we now save first and verify manually, we always show success (saved)
  // blockchainData will only be present if manually verified before showing this screen
  const verificationStatus = blockchainData ? 'verified' : 'saved'

  return (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
      }`}
    >
      {/* Header */}
      <div className='text-center mb-8'>
        <div className='mb-6'>
          <div className='flex justify-center mb-4'>
            <div className='rounded-full h-16 w-16 bg-green-500 flex items-center justify-center'>
              <svg
                className='h-8 w-8 text-white'
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
          </div>
        </div>

        <h1
          className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          {verificationStatus === 'verified'
            ? 'Application Verified on Blockchain!'
            : 'Application Saved Successfully!'}
        </h1>

        <p
          className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {verificationStatus === 'verified'
            ? 'Your application has been recorded on the blockchain and is ready for DOT verification.'
            : 'Your application has been saved. Verify it on the blockchain from your Hub to make it permanent and tamper-proof.'}
        </p>
      </div>

      {/* Verification Status */}
      {verificationStatus === 'verified' && (
        <div className='mb-8'>
          <div
            className={`p-6 rounded-lg border-2 ${
              theme === 'dark'
                ? 'bg-green-900/20 border-green-500/50'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <h2
              className={`text-xl font-semibold mb-4 ${
                theme === 'dark' ? 'text-green-400' : 'text-green-800'
              }`}
            >
              ✅ Blockchain Verification Complete
            </h2>

            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <span
                  className={`font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Transaction Hash:
                </span>
                {blockchainData?.transactionHash ? (
                  <a
                    href={`https://sepolia.basescan.org/tx/${blockchainData.transactionHash}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={`font-mono text-sm hover:underline ${
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    }`}
                  >
                    {blockchainData.transactionHash.slice(0, 10)}...
                    {blockchainData.transactionHash.slice(-8)}
                  </a>
                ) : (
                  <span
                    className={`font-mono text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Pending...
                  </span>
                )}
              </div>

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
                  {blockchainData?.blockNumber
                    ? blockchainData.blockNumber.toLocaleString()
                    : 'Pending...'}
                </span>
              </div>

              {blockchainData?.applicationId && (
                <div className='flex justify-between items-center'>
                  <span
                    className={`font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Application ID:
                  </span>
                  <span
                    className={`font-mono text-sm ${
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    }`}
                  >
                    #{blockchainData.applicationId}
                  </span>
                </div>
              )}

              <div className='flex justify-between items-center'>
                <span
                  className={`font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Status:
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    theme === 'dark'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  Pending DOT Verification
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Next Steps
        </h2>

        <div className='space-y-4'>
          {verificationStatus === 'saved' && (
            <div
              className={`p-4 rounded-lg border-2 ${
                theme === 'dark'
                  ? 'bg-brand-mint/10 border-brand-mint/30'
                  : 'bg-brand-sage/10 border-brand-sage/30'
              }`}
            >
              <h3
                className={`font-semibold mb-2 flex items-center gap-2 ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`}
              >
                <Shield className="w-5 h-5" />
                1. Verify on Blockchain
              </h3>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Go to your Hub and click "Verify on Blockchain" to submit your application to the blockchain. This makes it permanent and tamper-proof.
              </p>
            </div>
          )}

          {verificationStatus === 'verified' && (
            <div
              className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
              }`}
            >
              <h3
                className={`font-semibold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                1. DOT Verification
              </h3>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Your application will be reviewed by DOT inspectors. This
                process typically takes 3-5 business days.
              </p>
            </div>
          )}

          <div
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <h3
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {verificationStatus === 'saved' ? '2' : '2'}. Employment Verification
            </h3>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Complete the employment verification form to have your previous
              employers verify your work history.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex flex-col sm:flex-row gap-4 justify-center'>
        {onNavigateToDashboard && (
          <button
            onClick={onNavigateToDashboard}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
          >
            {verificationStatus === 'saved' ? 'Go to Hub to Verify' : 'View Dashboard'}
          </button>
        )}

        {verificationStatus === 'verified' && (
          <button
            onClick={onNavigateToSafetyForm}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}
          >
            Complete Employment Verification
          </button>
        )}
      </div>

      {/* Footer */}
      <div className='text-center mt-8'>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {verificationStatus === 'verified'
            ? 'Your application data is securely stored on the blockchain and cannot be tampered with.'
            : 'Your application is saved. Verify it on the blockchain to make it permanent and tamper-proof.'}
        </p>
      </div>
    </div>
  )
}

export default ApplicationSubmitted
