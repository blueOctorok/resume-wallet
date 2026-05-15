'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import PspDisclosureForm from '@/components/PspDisclosureForm'
import BackgroundCheckDisclosure from '@/components/BackgroundCheckDisclosure'
import EmployerPspMvrBundleAttestationStep, {
  type DeferredBgConsentData,
  type DeferredPspConsentData,
} from '@/components/employer/EmployerPspMvrBundleAttestationStep'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import { usePendingScreeningRequest } from '@/hooks/use-pending-screening-request'
import { CDLIS_PAGE_BREADCRUMB } from '@/lib/employer-psp-mvr-page3-copy'

interface ScreeningConsentBlockProps {
  userAddress: string
  onBack: () => void
}

/**
 * Employer-requested bundled consent (FCRA + FMCSA + CDLIS + encrypted identity).
 * Persists via POST /api/candidate/screening-consent — no Accio order from this flow.
 */
export default function ScreeningConsentBlock({ userAddress, onBack }: ScreeningConsentBlockProps) {
  const { theme } = useTheme()
  const { pendingRequest: pendingEmployerRequest, refresh: refreshPendingRequest } =
    usePendingScreeningRequest('psp', userAddress)

  const [step, setStep] = useState<'bg-disclosure' | 'psp-disclosure' | 'attestation'>('bg-disclosure')
  const [pspProfileSnapshot, setPspProfileSnapshot] = useState<Record<string, string> | null>(null)
  const [deferredBgConsent, setDeferredBgConsent] = useState<DeferredBgConsentData | null>(null)
  const [deferredPspConsent, setDeferredPspConsent] = useState<DeferredPspConsentData | null>(null)
  const [complete, setComplete] = useState(false)
  const [capturedRequest, setCapturedRequest] = useState(pendingEmployerRequest)

  useEffect(() => {
    if (pendingEmployerRequest && !capturedRequest) {
      setCapturedRequest(pendingEmployerRequest)
    }
  }, [pendingEmployerRequest, capturedRequest])

  const activeEmployerRequest = capturedRequest || pendingEmployerRequest

  const [bgFormProfile, setBgFormProfile] = useState<Record<string, string> | null>(null)

  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDarkTheme(theme) ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  }`

  if (!activeEmployerRequest && !complete) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackToHubButton onClick={onBack} />
          </div>
          <div className={`${cardClass} p-8 text-center`}>
            <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
              No pending screening consent request. When an employer requests screening consent, it will appear here.
            </p>
            <div className="mt-6">
              <Button variant="primary" onClick={onBack}>
                Back to Hub
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className={`${cardClass} p-8 text-center`}>
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkTheme(theme) ? 'bg-green-500/20' : 'bg-green-50'
              }`}
            >
              <CheckCircle className={`w-8 h-8 ${isDarkTheme(theme) ? 'text-green-400' : 'text-green-500'}`} />
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'}`}>
              Screening consent complete
            </h3>
            <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
              Your employer has your signed package on file. They will place MVR or PSP orders from their side when
              ready.
            </p>
            <Button variant="primary" onClick={onBack}>
              Back to Hub
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <BackToHubButton onClick={onBack} />
        </div>

        <div
          className={`mb-4 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            isDarkTheme(theme)
              ? 'bg-gray-800/50 border border-gray-700 text-gray-300'
              : 'bg-white/70 border border-gray-200 text-gray-600'
          }`}
        >
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              step === 'bg-disclosure'
                ? 'bg-teal-600 text-white'
                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            }`}
          >
            {step === 'bg-disclosure' ? '1' : '✓'}
          </span>
          <span className={step === 'bg-disclosure' ? 'font-medium' : 'text-green-700 dark:text-green-400'}>
            Background Check Disclosure
          </span>
          <span className="text-gray-400">→</span>
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              step === 'psp-disclosure'
                ? 'bg-amber-600 text-white'
                : step === 'attestation'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {step === 'psp-disclosure' ? '2' : step === 'attestation' ? '✓' : '2'}
          </span>
          <span className={step === 'psp-disclosure' ? 'font-medium' : ''}>FMCSA PSP Authorization</span>
          <span className="text-gray-400">→</span>
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              step === 'attestation'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            3
          </span>
          <span className={step === 'attestation' ? 'font-medium' : ''}>{CDLIS_PAGE_BREADCRUMB}</span>
        </div>

        {step === 'bg-disclosure' && activeEmployerRequest && (
          <BackgroundCheckDisclosure
            requestId={activeEmployerRequest.id}
            companyName={activeEmployerRequest.companyName}
            userAddress={userAddress}
            renderInline
            deferSubmit
            initialFormData={bgFormProfile}
            onClose={onBack}
            onConsentSigned={(profile) => {
              if (profile) {
                const { signedName: sn, ...rest } = profile
                setBgFormProfile(profile)
                setDeferredBgConsent({ signedName: sn ?? '', formData: rest })
              }
              setStep('psp-disclosure')
            }}
          />
        )}

        {step === 'psp-disclosure' && activeEmployerRequest && (
          <PspDisclosureForm
            userAddress={userAddress}
            companyName={activeEmployerRequest.companyName}
            requestId={activeEmployerRequest.id}
            renderInline
            fulfillOrder={false}
            deferSubmit
            initialProfile={bgFormProfile}
            onClose={() => setStep('bg-disclosure')}
            onConsentSigned={({ profileSnapshot, deferredConsentPayload }) => {
              setPspProfileSnapshot(profileSnapshot ?? null)
              if (deferredConsentPayload) {
                setDeferredPspConsent(deferredConsentPayload)
              }
              setStep('attestation')
            }}
          />
        )}

        {step === 'attestation' && activeEmployerRequest && (
          <EmployerPspMvrBundleAttestationStep
            userAddress={userAddress}
            requestId={activeEmployerRequest.id}
            companyName={activeEmployerRequest.companyName}
            bgProfile={bgFormProfile}
            pspProfile={pspProfileSnapshot}
            deferredBgConsent={deferredBgConsent}
            deferredPspConsent={deferredPspConsent}
            submitBehavior="consent-bundle-only"
            onPrevious={() => setStep('psp-disclosure')}
            onOrderComplete={async () => {
              setComplete(true)
              void refreshPendingRequest()
              const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
              void syncDriverHubFromApi(userAddress)
            }}
          />
        )}
      </div>
    </div>
  )
}
