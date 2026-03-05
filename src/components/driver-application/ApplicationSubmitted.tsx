'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Shield, CheckCircle, FileText, Sparkles, Loader2, AlertCircle } from 'lucide-react'

interface ApplicationSubmittedProps {
  onNavigateToSafetyForm: () => void
  onNavigateToDashboard?: () => void
  blockchainData?: {
    transactionHash: string
    blockNumber: number
    applicationId: number | null
  } | null
  /** Status of the automatic resume creation that runs in the background */
  resumeAutoCreateStatus?: 'idle' | 'creating' | 'created' | 'skipped' | 'failed'
}

const ApplicationSubmitted = ({
  onNavigateToSafetyForm,
  onNavigateToDashboard,
  blockchainData,
  resumeAutoCreateStatus = 'idle',
}: ApplicationSubmittedProps) => {
  const { theme } = useTheme()
  // Since we now save first and verify manually, we always show success (saved)
  // blockchainData will only be present if manually verified before showing this screen
  const verificationStatus = blockchainData ? 'verified' : 'saved'

  return (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-gray-800/80 backdrop-blur-xl border border-gray-700'
          : 'bg-white/90 backdrop-blur-xl border border-gray-200'
      } rounded-2xl shadow-2xl relative z-10`}
    >
      {/* Header */}
      <div className='text-center mb-8'>
        <div className='mb-6'>
          <div className='flex justify-center mb-4'>
            <div className='rounded-full h-16 w-16 bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30'>
              <CheckCircle className='h-8 w-8 text-white' strokeWidth={2.5} />
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
            className={`p-6 rounded-xl border ${
              theme === 'dark'
                ? 'bg-green-900/20 border-green-500/30'
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
                      theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
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
                    theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
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
                      theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
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

      {/* Auto Resume Creation Status - shown while/after we silently build the resume */}
      {resumeAutoCreateStatus !== 'idle' && resumeAutoCreateStatus !== 'skipped' && (
        <div className='mb-8'>
          <div
            className={`p-5 rounded-xl border flex items-start gap-4 ${
              resumeAutoCreateStatus === 'created'
                ? theme === 'dark'
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-green-50 border-green-200'
                : resumeAutoCreateStatus === 'failed'
                  ? theme === 'dark'
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  : theme === 'dark'
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : 'bg-teal-50 border-teal-200'
            }`}
          >
            <div className={`flex-shrink-0 rounded-xl p-2.5 ${
              resumeAutoCreateStatus === 'created'
                ? 'bg-green-500'
                : resumeAutoCreateStatus === 'failed'
                  ? theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                  : theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}>
              {resumeAutoCreateStatus === 'creating' && (
                <Loader2 className={`h-5 w-5 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
              )}
              {resumeAutoCreateStatus === 'created' && (
                <CheckCircle className='h-5 w-5 text-white' />
              )}
              {resumeAutoCreateStatus === 'failed' && (
                <AlertCircle className={`h-5 w-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
              )}
            </div>
            <div>
              <h3 className={`font-semibold flex items-center gap-2 mb-1 ${
                resumeAutoCreateStatus === 'created'
                  ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                  : resumeAutoCreateStatus === 'failed'
                    ? theme === 'dark' ? 'text-red-400' : 'text-red-700'
                    : theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
              }`}>
                {resumeAutoCreateStatus === 'creating' && (
                  <><Sparkles className='h-4 w-4' /> Building your resume from DOT data…</>
                )}
                {resumeAutoCreateStatus === 'created' && (
                  <><FileText className='h-4 w-4' /> Resume Created!</>
                )}
                {resumeAutoCreateStatus === 'failed' && 'Resume creation skipped'}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                {resumeAutoCreateStatus === 'creating' &&
                  "We're creating a professional resume from the information you entered. It'll be ready in your Hub."}
                {resumeAutoCreateStatus === 'created' &&
                  'A professional resume has been added to your Hub using your DOT application data. You can view and edit it anytime.'}
                {resumeAutoCreateStatus === 'failed' &&
                  'We couldn\'t auto-create a resume this time. You can build one from your Hub whenever you\'re ready.'}
              </p>
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
              className={`p-4 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-indigo-500/10 border-indigo-500/30'
                  : 'bg-indigo-50 border-indigo-200'
              }`}
            >
              <h3
                className={`font-semibold mb-2 flex items-center gap-2 ${
                  theme === 'dark' ? 'text-indigo-400' : 'text-indigo-700'
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
              className={`p-4 rounded-xl border ${
                theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
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
            className={`p-4 rounded-xl border ${
              theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <h3
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              2. Employment Verification
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
          <div className='relative group'>
            {/* Glowing border effect */}
            <div className='absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-xl blur-md opacity-70 group-hover:opacity-100 transition-opacity duration-300 animate-pulse' />
            <button
              onClick={onNavigateToDashboard}
              className='relative px-8 py-3 rounded-xl font-semibold transition-all duration-200 bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
            >
              {verificationStatus === 'saved' ? 'Complete & Return to Hub' : 'View Dashboard'}
            </button>
          </div>
        )}

        {verificationStatus === 'verified' && (
          <button
            onClick={onNavigateToSafetyForm}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200'
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
