'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { CheckCircle, FileText, Shield } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ApplicationSubmittedProps {
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
}

const ApplicationSubmitted = ({
  onNavigateToDashboard,
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

      <div className='mb-8'>
        <div
          className={`p-5 rounded-xl border flex items-start gap-4 ${
            dark ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'
          }`}
        >
          <div
            className={`flex-shrink-0 rounded-xl p-2.5 ${
              dark ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}
          >
            <FileText className={`h-5 w-5 ${dark ? 'text-teal-300' : 'text-teal-700'}`} />
          </div>
          <div>
            <h3
              className={`font-semibold mb-1 ${dark ? 'text-teal-300' : 'text-teal-800'}`}
            >
              Your resume packet is ready
            </h3>
            <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              No separate resume file was created — your career card Resume chip builds a
              live packet from this DOT application (plus CDL / MVR). Open it anytime to
              preview or download a PDF.
            </p>
          </div>
        </div>
      </div>

      <div className='mb-8'>
        <h2 className={`text-xl font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
          Next Steps
        </h2>

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
            Raise verified coverage
          </h3>
          <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            Add a driver-owned MVR/PSP or get prior employers to confirm work history. Those
            fields lock with honest source badges. A packet headlines &quot;Verified&quot; only
            when a majority of risk-bearing fields are issuer-backed — not because the form was
            submitted.
          </p>
        </div>
      </div>

      {onNavigateToDashboard && (
        <div className='flex justify-center'>
          <Button variant='primary' onClick={onNavigateToDashboard}>
            Return to Hub
          </Button>
        </div>
      )}

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
