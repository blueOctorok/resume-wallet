'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
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
import { validateDateOfBirth } from '@/lib/screening-validation'
import { clearInviteToken, peekInviteToken } from '@/lib/invite-resume'

interface ScreeningConsentBlockProps {
  userAddress: string
  onBack: () => void
}

interface OrderRetryState {
  requestId: string
  companyName: string
  storedDob: string | null
}

/**
 * Employer-requested bundled consent (FCRA + FMCSA + CDLIS + encrypted identity).
 * Driver-owned flow: consent saved, then driver-initiated MVR + PSP orders (P3.4-C).
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
  const [orderRetry, setOrderRetry] = useState<OrderRetryState | null>(null)
  const [retryLoading, setRetryLoading] = useState(true)
  const [retryDob, setRetryDob] = useState('')
  const [invalidStoredDob, setInvalidStoredDob] = useState<string | null>(null)
  const [retrySubmitting, setRetrySubmitting] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [claimingInvite, setClaimingInvite] = useState(false)

  useEffect(() => {
    if (pendingEmployerRequest && !capturedRequest) {
      setCapturedRequest(pendingEmployerRequest)
    }
  }, [pendingEmployerRequest, capturedRequest])

  // Google can dump the driver on the hub before /onboard claims the invite.
  // If the resume token is still here, claim it so the disclosure forms load.
  useEffect(() => {
    if (!userAddress || pendingEmployerRequest || complete) return
    const token = peekInviteToken()
    if (!token) return
    let cancelled = false
    setClaimingInvite(true)
    void fetch(`/api/invite/${token}`, { method: 'POST' })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          clearInviteToken()
          return refreshPendingRequest()
        }
      })
      .finally(() => {
        if (!cancelled) setClaimingInvite(false)
      })
    return () => {
      cancelled = true
    }
  }, [userAddress, pendingEmployerRequest, complete, refreshPendingRequest])

  useEffect(() => {
    if (pendingEmployerRequest || complete || claimingInvite) {
      setRetryLoading(false)
      return
    }
    let cancelled = false
    void fetch('/api/candidate/screening-order-retry')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.retryable) return
        setOrderRetry({
          requestId: data.requestId as string,
          companyName: data.companyName as string,
          storedDob: (data.storedDob as string | null) ?? null,
        })
        const stored = (data.storedDob as string | null) ?? ''
        if (stored && validateDateOfBirth(stored).ok) {
          setRetryDob(stored)
          setInvalidStoredDob(null)
        } else if (stored) {
          // Don't trap the user on a bad saved year (e.g. 1070 typo) — force a fresh pick.
          setRetryDob('')
          setInvalidStoredDob(stored)
        } else {
          setRetryDob('')
          setInvalidStoredDob(null)
        }
      })
      .finally(() => {
        if (!cancelled) setRetryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pendingEmployerRequest, complete, claimingInvite])

  const activeEmployerRequest = capturedRequest || pendingEmployerRequest

  const [bgFormProfile, setBgFormProfile] = useState<Record<string, string> | null>(null)

  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDarkTheme(theme) ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  }`

  const inputClass = isDarkTheme(theme)
    ? 'w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500'
    : 'w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500'

  const handleOrderRetry = async () => {
    if (!orderRetry) return
    setRetryError(null)
    const dobCheck = validateDateOfBirth(retryDob)
    if (!dobCheck.ok) {
      setRetryError(dobCheck.error)
      return
    }
    setRetrySubmitting(true)
    try {
      const res = await fetch('/api/candidate/screening-order-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: orderRetry.requestId,
          formDataPatch: { dob: retryDob.trim(), dateOfBirth: retryDob.trim() },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to submit orders')
      }
      setComplete(true)
      setOrderRetry(null)
      void refreshPendingRequest()
      const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
      void syncDriverHubFromApi(userAddress)
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : 'Failed to submit orders')
    } finally {
      setRetrySubmitting(false)
    }
  }

  if (!activeEmployerRequest && !complete) {
    if (retryLoading || claimingInvite) {
      return (
        <div className="w-full p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      )
    }

    if (orderRetry) {
      return (
        <div className="w-full p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-4">
              <BackToHubButton onClick={onBack} />
            </div>
            <div className={`${cardClass} p-8`}>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'}`}>
                Finish your MVR & PSP orders
              </h3>
              <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Your screening consent for {orderRetry.companyName} is saved, but the MVR and PSP orders did not
                submit. Pick your correct date of birth below and try again — no need to re-sign the disclosure forms.
              </p>
              {invalidStoredDob && (
                <p className={`text-sm mb-4 rounded-lg px-3 py-2 ${isDarkTheme(theme) ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-900'}`}>
                  The saved date ({invalidStoredDob}) was rejected. Use the date picker to choose your real birth date
                  — check the <strong>year</strong> (e.g. 1970, not 1070).
                </p>
              )}
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                Date of birth
              </label>
              <input
                type="date"
                value={retryDob}
                onChange={(e) => {
                  setRetryDob(e.target.value)
                  setRetryError(null)
                }}
                className={inputClass}
              />
              {retryError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{retryError}</p>
              )}
              <div className="mt-6 flex gap-3">
                <Button variant="primary" onClick={handleOrderRetry} isLoading={retrySubmitting}>
                  Submit MVR & PSP orders
                </Button>
                <Button variant="secondary" onClick={onBack}>
                  Back to Hub
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackToHubButton onClick={onBack} />
          </div>
          <div className={`${cardClass} p-8 text-center`}>
            <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
              No pending screening consent request. If an employer emailed you a consent link, open that email again
              — signing in from the link attaches the forms here. After you sign, track MVR and PSP from your career
              card or Build.
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
              MVR & PSP orders submitted
            </h3>
            <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
              Your consent is on file and your MVR and PSP orders are processing. These reports belong to you —
              track progress in My Files on your hub. Your employer can view results while evaluating your
              application.
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
            submitBehavior="consent-then-driver-orders"
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
