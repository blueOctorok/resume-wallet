'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { Shield, CheckCircle, FileText, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ApplicationSubmittedProps {
  onNavigateToSafetyForm: () => void
  onNavigateToDashboard?: () => void
  /**
   * @deprecated Legacy Base-era payload. Ignored for display (DEC-2026-07-001).
   * Self-reported DOT apps are never "Verified on Blockchain."
   */
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
  resumeAutoCreateStatus = 'idle',
}: ApplicationSubmittedProps) => {
  const { theme } = useTheme()
  const dark = isDarkTheme(theme)

  return (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        dark
          ? 'bg-gray-800/80 backdrop-blur-xl border border-gray-700'
          : 'bg-white/90 backdrop-blur-xl border border-gray-200'
      } rounded-2xl shadow-2xl relative z-10`}
    >
      <div className='text-center mb-8'>
        <div className='mb-6'>
          <div className='flex justify-center mb-4'>
            <div className='rounded-full h-16 w-16 bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30'>
              <CheckCircle className='h-8 w-8 text-white' strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <h1 className={`text-3xl font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
          Application Submitted
        </h1>

        <p className={`text-lg ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
          Your DOT pre-screen is saved. Issuer-backed fields (MVR, PSP, prior-employer
          confirmations) raise your verified coverage — self-reported answers stay
          self-certified.
        </p>
      </div>

      {resumeAutoCreateStatus !== 'idle' && resumeAutoCreateStatus !== 'skipped' && (
        <div className='mb-8'>
          <div
            className={`p-5 rounded-xl border flex items-start gap-4 ${
              resumeAutoCreateStatus === 'created'
                ? dark
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-green-50 border-green-200'
                : resumeAutoCreateStatus === 'failed'
                  ? dark
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  : dark
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : 'bg-teal-50 border-teal-200'
            }`}
          >
            <div
              className={`flex-shrink-0 rounded-xl p-2.5 ${
                resumeAutoCreateStatus === 'created'
                  ? 'bg-green-500'
                  : resumeAutoCreateStatus === 'failed'
                    ? dark
                      ? 'bg-red-500/20'
                      : 'bg-red-100'
                    : dark
                      ? 'bg-teal-500/20'
                      : 'bg-teal-100'
              }`}
            >
              {resumeAutoCreateStatus === 'creating' && (
                <Loader2
                  className={`h-5 w-5 animate-spin ${dark ? 'text-teal-400' : 'text-teal-600'}`}
                />
              )}
              {resumeAutoCreateStatus === 'created' && (
                <CheckCircle className='h-5 w-5 text-white' />
              )}
              {resumeAutoCreateStatus === 'failed' && (
                <AlertCircle className={`h-5 w-5 ${dark ? 'text-red-400' : 'text-red-500'}`} />
              )}
            </div>
            <div>
              <h3
                className={`font-semibold flex items-center gap-2 mb-1 ${
                  resumeAutoCreateStatus === 'created'
                    ? dark
                      ? 'text-green-400'
                      : 'text-green-700'
                    : resumeAutoCreateStatus === 'failed'
                      ? dark
                        ? 'text-red-400'
                        : 'text-red-700'
                      : dark
                        ? 'text-teal-400'
                        : 'text-teal-600'
                }`}
              >
                {resumeAutoCreateStatus === 'creating' && (
                  <>
                    <Sparkles className='h-4 w-4' /> Building your resume from DOT data…
                  </>
                )}
                {resumeAutoCreateStatus === 'created' && (
                  <>
                    <FileText className='h-4 w-4' /> Resume Created!
                  </>
                )}
                {resumeAutoCreateStatus === 'failed' && 'Resume creation skipped'}
              </h3>
              <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                {resumeAutoCreateStatus === 'creating' &&
                  "We're creating a professional resume from the information you entered. It'll be ready in your Hub."}
                {resumeAutoCreateStatus === 'created' &&
                  'A professional resume has been added to your Hub using your DOT application data. You can view and edit it anytime.'}
                {resumeAutoCreateStatus === 'failed' &&
                  "We couldn't auto-create a resume this time. You can build one from your Hub whenever you're ready."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className='mb-8'>
        <h2 className={`text-xl font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
          Next Steps
        </h2>

        <div className='space-y-4'>
          <div
            className={`p-4 rounded-xl border ${
              dark ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'
            }`}
          >
            <h3
              className={`font-semibold mb-2 flex items-center gap-2 ${
                dark ? 'text-teal-400' : 'text-teal-700'
              }`}
            >
              <Shield className='w-5 h-5' />
              1. Raise verified coverage
            </h3>
            <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              Add a driver-owned MVR/PSP or get prior employers to confirm work history. Those
              fields lock with honest source badges. A packet headlines &quot;Verified&quot; only
              when a majority of risk-bearing fields are issuer-backed — not because the form was
              submitted.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <h3 className={`font-semibold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
              2. Employment verification
            </h3>
            <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              Ask previous employers to confirm your work history. Confirmed rows lock on Form 3
              and count toward verified coverage.
            </p>
          </div>
        </div>
      </div>

      <div className='flex flex-col sm:flex-row gap-4 justify-center'>
        {onNavigateToDashboard && (
          <Button variant='primary' onClick={onNavigateToDashboard}>
            Return to Hub
          </Button>
        )}
        <Button variant='secondary' onClick={onNavigateToSafetyForm}>
          Complete Employment Verification
        </Button>
      </div>

      <div className='text-center mt-8'>
        <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Self-reported answers are never marked verified. Only Accio MVR/PSP and prior-employer
          confirmations raise your verified %.
        </p>
      </div>
    </div>
  )
}

export default ApplicationSubmitted
