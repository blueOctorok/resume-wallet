'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { CheckCircle, FileWarning, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import PspDisclosureForm from './PspDisclosureForm'
import BackgroundCheckDisclosure from './BackgroundCheckDisclosure'
import EmployerPspMvrBundleAttestationStep, {
  type DeferredBgConsentData,
  type DeferredPspConsentData,
} from '@/components/employer/EmployerPspMvrBundleAttestationStep'
import BackToHubButton from './ui/BackToHubButton'
import Button from './ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import { usePendingScreeningRequest } from '@/hooks/use-pending-screening-request'
import { useScreeningOrderLock } from '@/hooks/use-screening-order-lock'
import ScreeningReportOnFileCard from '@/components/screening/ScreeningReportOnFileCard'
import { CDLIS_PAGE_BREADCRUMB } from '@/lib/employer-psp-mvr-page3-copy'

interface PspOrderFormProps {
  userAddress: string
  onBack: () => void
}

/**
 * PSP block page. PSP is employer-ordered only (DEC-2026-10-001): a driver
 * reaches this page either from an employer's screening request (three-step
 * consent wizard below) or by opening the hub tile, where they see status or
 * an explanation — never a self-order form.
 */
export default function PspOrderForm({ userAddress, onBack }: PspOrderFormProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  // The bell notification deep-links to `?onboard=psp`, which lands here. We must surface
  // the company-scoped FMCSA PSP disclosure so the employer's order endpoint can proceed.
  const { pendingRequest: pendingEmployerRequest, refresh: refreshPendingRequest } =
    usePendingScreeningRequest('psp', userAddress)

  // One active PSP per driver — show status when a report is already on file.
  const { lock: pspLock, isLoading: pspLockLoading } = useScreeningOrderLock('psp', userAddress)

  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  }`

  // Employer-initiated PSP requires TWO legally separate disclosures, then a
  // carrier-specific Page 3 attestation before Accio is called:
  //   Step 1: General Background Check Disclosure (FCRA)
  //   Step 2: PSP FMCSA Disclosure & Authorization (stand-alone; no SSN here)
  //   Step 3: CDLIS written consent (`EmployerPspMvrBundleAttestationStep`) + SSN → POST /api/candidate/fulfill-screening
  const [pspEmployerStep, setPspEmployerStep] = useState<
    'bg-disclosure' | 'psp-disclosure' | 'attestation'
  >('bg-disclosure')
  // PSP Step 2 profile snapshot (merged with Step 1 in Step 3 for Accio payload)
  const [pspProfileSnapshot, setPspProfileSnapshot] = useState<Record<string, string> | null>(null)

  // Deferred consent payloads — nothing is POSTed until step 3 "Submit" is clicked.
  const [deferredBgConsent, setDeferredBgConsent] = useState<DeferredBgConsentData | null>(null)
  const [deferredPspConsent, setDeferredPspConsent] = useState<DeferredPspConsentData | null>(null)
  // Tracks whether the employer-initiated order was placed so we don't fall through to the status card
  const [employerOrderComplete, setEmployerOrderComplete] = useState(false)

  // Capture the request the moment we see it. The PSP consent endpoint marks the
  // candidate_request 'completed' as soon as Step 2 is signed, which would unmount
  // this wizard before the order is placed. Capturing keeps the wizard alive.
  const [capturedRequest, setCapturedRequest] = useState(pendingEmployerRequest)
  useEffect(() => {
    if (pendingEmployerRequest && !capturedRequest) {
      setCapturedRequest(pendingEmployerRequest)
    }
  }, [pendingEmployerRequest, capturedRequest])

  // Profile data captured from the BG disclosure (Step 1) — used to prefill the
  // PSP FMCSA form (Step 2) so the candidate doesn't re-type identical fields.
  // Pre-fill of shared data fields is FCRA-compliant; only the SIGNATURE per
  // document must be unique. (Standard practice across Sterling/HireRight/etc.)
  const [bgFormProfile, setBgFormProfile] = useState<Record<string, string> | null>(null)

  const activeEmployerRequest = capturedRequest || pendingEmployerRequest

  // Employer screening requests all resolve to the driver-screening-consent block
  // (see /api/employer/talent/[userId]/request), which is what opens the wizard.
  const needsConsentBundle =
    activeEmployerRequest?.targetBlockType === 'driver-screening-consent'

  // Employer-initiated flow: three-step consent wizard OR success screen
  if ((needsConsentBundle && activeEmployerRequest) || employerOrderComplete) {
    if (employerOrderComplete) {
      return (
        <div className='w-full p-4 sm:p-6 lg:p-8'>
          <div className='max-w-2xl mx-auto'>
            <div className={`${cardClass} p-8 text-center`}>
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDark ? 'bg-green-500/20' : 'bg-green-50'
              }`}>
                <CheckCircle className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                MVR & PSP orders submitted
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Your consent is on file and your MVR and PSP orders are processing. These reports belong to you —
                track progress in My Files. Your employer can view results while evaluating your application.
              </p>
              <Button variant='primary' onClick={onBack}>
                Back to Hub
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='w-full p-4 sm:p-6 lg:p-8'>
        <div className='max-w-3xl mx-auto'>
          <div className="mb-4">
            <BackToHubButton onClick={onBack} />
          </div>

          {/* Step indicator — three stand-alone legal / attestation gates */}
          <div className={`mb-4 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            isDark
              ? 'bg-gray-800/50 border border-gray-700 text-gray-300'
              : 'bg-white/70 border border-gray-200 text-gray-600'
          }`}>
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                pspEmployerStep === 'bg-disclosure'
                  ? 'bg-teal-600 text-white'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              }`}
            >
              {pspEmployerStep === 'bg-disclosure' ? '1' : '✓'}
            </span>
            <span className={pspEmployerStep === 'bg-disclosure' ? 'font-medium' : 'text-green-700 dark:text-green-400'}>
              Background Check Disclosure
            </span>
            <span className="text-gray-400">→</span>
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                pspEmployerStep === 'psp-disclosure'
                  ? 'bg-amber-600 text-white'
                  : pspEmployerStep === 'attestation'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {pspEmployerStep === 'psp-disclosure' ? '2' : pspEmployerStep === 'attestation' ? '✓' : '2'}
            </span>
            <span className={pspEmployerStep === 'psp-disclosure' ? 'font-medium' : ''}>
              FMCSA PSP Authorization
            </span>
            <span className="text-gray-400">→</span>
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                pspEmployerStep === 'attestation'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              3
            </span>
            <span className={pspEmployerStep === 'attestation' ? 'font-medium' : ''}>{CDLIS_PAGE_BREADCRUMB}</span>
          </div>

          {pspEmployerStep === 'bg-disclosure' && (
            <BackgroundCheckDisclosure
              requestId={activeEmployerRequest!.id}
              companyName={activeEmployerRequest!.companyName}
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
                setPspEmployerStep('psp-disclosure')
              }}
            />
          )}

          {pspEmployerStep === 'psp-disclosure' && (
            <PspDisclosureForm
              userAddress={userAddress}
              companyName={activeEmployerRequest!.companyName}
              requestId={activeEmployerRequest!.id}
              renderInline
              fulfillOrder={false}
              deferSubmit
              initialProfile={bgFormProfile}
              onClose={() => setPspEmployerStep('bg-disclosure')}
              onConsentSigned={({ profileSnapshot, deferredConsentPayload }) => {
                setPspProfileSnapshot(profileSnapshot ?? null)
                if (deferredConsentPayload) {
                  setDeferredPspConsent(deferredConsentPayload)
                }
                setPspEmployerStep('attestation')
              }}
            />
          )}

          {pspEmployerStep === 'attestation' && (
            <EmployerPspMvrBundleAttestationStep
              userAddress={userAddress}
              requestId={activeEmployerRequest!.id}
              companyName={activeEmployerRequest!.companyName}
              bgProfile={bgFormProfile}
              pspProfile={pspProfileSnapshot}
              deferredBgConsent={deferredBgConsent}
              deferredPspConsent={deferredPspConsent}
              submitBehavior="consent-then-driver-orders"
              onPrevious={() => setPspEmployerStep('psp-disclosure')}
              onOrderComplete={async () => {
                setEmployerOrderComplete(true)
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

  // No employer request: show status if a PSP exists, otherwise explain who orders it.
  if (pspLockLoading) {
    return (
      <div className='w-full p-4 sm:p-6 lg:p-8 flex justify-center'>
        <Loader2 className='w-6 h-6 animate-spin text-gray-400 mt-12' />
      </div>
    )
  }
  if (pspLock.locked) {
    return <ScreeningReportOnFileCard kind='psp' lock={pspLock} onBack={onBack} />
  }

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-2xl mx-auto'>
        <BackToHubButton onClick={onBack} />
        <HubSectionPanel isDark={isDark} accent='amber'>
          <BlockCard
            variant='embed'
            icon={FileWarning}
            title='PSP Report'
            description='FMCSA crash and inspection history. Ordered by employers, owned by you.'
          >
            <div className='space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400'>
              <p>
                A PSP is a pre-employment screening tool — carriers pull it when they are considering you. When an
                employer on Provven requests one, you&apos;ll get a notification here and the report is placed at no
                cost to you after you sign the consent forms.
              </p>
              <p>
                Once it&apos;s on file, the report belongs to you. Track it in My Files, and it stays visible on every
                employer&apos;s DQ monitor you share with.
              </p>
            </div>
          </BlockCard>
        </HubSectionPanel>
      </div>
    </div>
  )
}
