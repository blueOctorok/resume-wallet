'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, FileText, User, CreditCard, MapPin } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import PspPaymentButton from './PspPaymentButton'
import PspDisclosureForm from './PspDisclosureForm'
import BackgroundCheckDisclosure from './BackgroundCheckDisclosure'
import BackToHubButton from './ui/BackToHubButton'
import Button from './ui/Button'
import { usePendingScreeningRequest } from '@/hooks/use-pending-screening-request'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'

interface PspOrderFormProps {
  userAddress: string
  onBack: () => void
}

export default function PspOrderForm({ userAddress, onBack }: PspOrderFormProps) {
  const { theme } = useTheme()

  // Personal Information
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [ssn, setSsn] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')

  // License Information
  const [dlNumber, setDlNumber] = useState('')
  const [dlState, setDlState] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  // Payment state
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null)
  const [isPaymentComplete, setIsPaymentComplete] = useState(false)
  /** Self-order: FMCSA PSP Disclosure must be signed before pay; `pspConsentId` is consumed when the order is placed. */
  const [pspConsentId, setPspConsentId] = useState<string | null>(null)
  const [showPspDisclosure, setShowPspDisclosure] = useState(false)

  // Employer-requested PSP (FMCSA gate): same defense-in-depth pattern as MvrOrderForm.
  // The bell notification deep-links to `?onboard=psp`, which lands here. We must surface
  // the company-scoped FMCSA PSP disclosure so the employer's order endpoint can proceed.
  const { pendingRequest: pendingEmployerRequest, refresh: refreshPendingRequest } =
    usePendingScreeningRequest('psp', userAddress)

  // Check if required form fields are filled
  const isFormValid = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      email.trim() &&
      isValidSsn(ssn) &&
      dob.trim() &&
      address.trim() &&
      city.trim() &&
      state.trim() &&
      zip.trim() &&
      dlNumber.trim() &&
      dlState.trim()
  )

  const canPay = isFormValid && Boolean(pspConsentId)

  const refreshSelfPspConsent = useCallback(async () => {
    if (!userAddress) return
    try {
      const res = await fetch('/api/psp/consent?self=1', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.hasUnconsumedSelfConsent && data.consentId) {
          setPspConsentId(data.consentId)
        } else {
          setPspConsentId(null)
        }
      }
    } catch {
      // non-fatal
    }
  }, [userAddress])

  // Check for pending payment on mount + restore unconsumed FMCSA self-consent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingPayment = localStorage.getItem('pendingPspPayment')
      if (pendingPayment) {
        setPaymentTxHash(pendingPayment)
        setIsPaymentComplete(true)
        localStorage.removeItem('pendingPspPayment')
      }
    }
  }, [])

  useEffect(() => {
    void refreshSelfPspConsent()
  }, [refreshSelfPspConsent])

  const handlePaymentSuccess = (txHash: string) => {
    setPaymentTxHash(txHash)
    setIsPaymentComplete(true)
    setError(null)
  }

  const handlePaymentError = (errorMsg: string) => {
    setError(`Payment failed: ${errorMsg}`)
    setIsPaymentComplete(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isPaymentComplete || !paymentTxHash) {
      setError('Please complete payment before submitting order')
      return
    }

    if (!pspConsentId) {
      setError('Sign the FMCSA PSP Disclosure & Authorization before submitting.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setOrderResult(null)

    try {
      const response = await fetch('/api/psp/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          paymentTxHash,
          pspConsentId,
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          ssn: normalizeSsnDigits(ssn),
          dob: dob.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip: zip.trim(),
          dlNumber: dlNumber.trim(),
          dlState: dlState.trim().toUpperCase(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to order PSP report')
      }

      setSuccess(true)
      setOrderResult(data.order)
      setPspConsentId(null)
      void refreshSelfPspConsent()
      const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
      void syncDriverHubFromApi(userAddress)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to order PSP report')
    } finally {
      setIsLoading(false)
    }
  }

  // Consistent styling (matches hub)
  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
  }`

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm transition-colors ${
    isDarkTheme(theme)
      ? 'bg-gray-900/50 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-indigo-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`

  const labelClass = `block text-xs font-medium mb-1.5 ${
    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  }`

  const sectionHeaderClass = `flex items-center gap-2 text-sm font-semibold mb-4 ${
    isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
  }`

  // Employer-initiated PSP requires TWO legally separate disclosures:
  //   Step 1: General Background Check Disclosure (FCRA)
  //   Step 2: PSP FMCSA Disclosure & Authorization (which also submits the order)
  const [pspEmployerStep, setPspEmployerStep] = useState<'bg-disclosure' | 'psp-disclosure'>('bg-disclosure')
  // Tracks whether the employer-initiated order was placed so we don't fall through to the self-order form
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

  // Employer-initiated flow: two-step disclosure wizard OR success screen
  if (activeEmployerRequest || employerOrderComplete) {
    if (employerOrderComplete) {
      return (
        <div className='w-full p-4 sm:p-6 lg:p-8'>
          <div className='max-w-2xl mx-auto'>
            <div className={`${cardClass} p-8 text-center`}>
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkTheme(theme) ? 'bg-green-500/20' : 'bg-green-50'
              }`}>
                <CheckCircle className={`w-8 h-8 ${isDarkTheme(theme) ? 'text-green-400' : 'text-green-500'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'}`}>
                PSP + MVR Order Submitted
              </h3>
              <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                Both disclosures have been signed and your order has been submitted to Accio. Results typically arrive within 24–48 hours.
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

          {/* Step indicator */}
          <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            isDarkTheme(theme)
              ? 'bg-gray-800/50 border border-gray-700 text-gray-300'
              : 'bg-white/70 border border-gray-200 text-gray-600'
          }`}>
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              pspEmployerStep === 'bg-disclosure'
                ? 'bg-teal-600 text-white'
                : 'bg-green-100 text-green-700'
            }`}>
              {pspEmployerStep === 'bg-disclosure' ? '1' : '✓'}
            </span>
            <span className={pspEmployerStep === 'bg-disclosure' ? 'font-medium' : 'text-green-700'}>
              Background Check Disclosure
            </span>
            <span className="text-gray-400">→</span>
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              pspEmployerStep === 'psp-disclosure'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              2
            </span>
            <span className={pspEmployerStep === 'psp-disclosure' ? 'font-medium' : ''}>
              FMCSA PSP Authorization
            </span>
          </div>

          {pspEmployerStep === 'bg-disclosure' && (
            <BackgroundCheckDisclosure
              requestId={activeEmployerRequest!.id}
              companyName={activeEmployerRequest!.companyName}
              userAddress={userAddress}
              renderInline
              onClose={onBack}
              // Capture profile so Step 2 prefills, then advance the wizard.
              onConsentSigned={(profile) => {
                if (profile) setBgFormProfile(profile)
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
              fulfillOrder
              initialProfile={bgFormProfile}
              onClose={onBack}
              // Don't refresh pendingRequest here — the consent endpoint marks
              // it 'completed' immediately, which would unmount this wizard
              // before onOrderPlaced fires. The wizard owns its lifecycle.
              onConsentSigned={() => {}}
              onOrderPlaced={async () => {
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

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-2xl mx-auto space-y-6'>
        {/* Header */}
        <div className={`${cardClass} p-5`}>
          <div className="mb-4">
            <BackToHubButton onClick={onBack} />
          </div>
          <div className='flex items-center gap-3'>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500/20 border border-indigo-500/30'
                  : 'bg-indigo-50 border border-indigo-200'
              }`}
            >
              <FileText
                className={`w-6 h-6 ${
                  isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                }`}
              />
            </div>
            <div>
              <h1
                className={`text-xl font-semibold ${
                  isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                Order PSP Report
              </h1>
              <p
                className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                FMCSA crash & inspection history via Accio
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && orderResult && (
          <div className={`${cardClass} p-8 text-center`}>
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkTheme(theme) ? 'bg-green-500/20' : 'bg-green-50'
              }`}
            >
              <CheckCircle
                className={`w-8 h-8 ${
                  isDarkTheme(theme) ? 'text-green-400' : 'text-green-500'
                }`}
              />
            </div>
            <h3
              className={`text-xl font-semibold mb-2 ${
                isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              PSP Order Placed!
            </h3>
            <p
              className={`text-sm mb-6 ${
                isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Order Number:{' '}
              <span className='font-mono font-semibold'>
                {orderResult.orderNumber}
              </span>
            </p>
            <button
              onClick={onBack}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              Done
            </button>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* Personal Information */}
            <div className={`${cardClass} p-5`}>
              <div className={sectionHeaderClass}>
                <User
                  className={`w-4 h-4 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                />
                Personal Information
              </div>
              <p
                className={`text-xs mb-4 ${
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Enter your name exactly as it appears on your driver&apos;s
                license
              </p>

              {/* Name fields */}
              <div className='grid grid-cols-3 gap-3 mb-3'>
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input
                    type='text'
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder='John'
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Middle</label>
                  <input
                    type='text'
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder='M'
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input
                    type='text'
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder='Doe'
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Other personal info */}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder='john@example.com'
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input
                    type='date'
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>SSN *</label>
                  <input
                    type='text'
                    inputMode='numeric'
                    autoComplete='off'
                    value={formatSsnDisplay(ssn)}
                    onChange={(e) => setSsn(normalizeSsnDigits(e.target.value))}
                    required
                    placeholder='123-45-6789'
                    maxLength={11}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Driver License */}
            <div className={`${cardClass} p-5`}>
              <div className={sectionHeaderClass}>
                <CreditCard
                  className={`w-4 h-4 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                />
                Driver License
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelClass}>License Number *</label>
                  <input
                    type='text'
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value)}
                    required
                    placeholder='12345678'
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <input
                    type='text'
                    value={dlState}
                    onChange={(e) => setDlState(e.target.value.toUpperCase())}
                    required
                    placeholder='TX'
                    maxLength={2}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className={`${cardClass} p-5`}>
              <div className={sectionHeaderClass}>
                <MapPin
                  className={`w-4 h-4 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                />
                Address
              </div>
              <div className='space-y-3'>
                <div>
                  <label className={labelClass}>Street Address *</label>
                  <input
                    type='text'
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    placeholder='123 Main St'
                    className={inputClass}
                  />
                </div>
                <div className='grid grid-cols-3 gap-3'>
                  <div>
                    <label className={labelClass}>City *</label>
                    <input
                      type='text'
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      placeholder='Houston'
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State *</label>
                    <input
                      type='text'
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      required
                      placeholder='TX'
                      maxLength={2}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ZIP *</label>
                    <input
                      type='text'
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      required
                      placeholder='77001'
                      maxLength={10}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* FMCSA-mandated PSP Disclosure — standalone; must be signed before payment (live FMCSA order). */}
            <div
              className={`rounded-2xl border p-5 ${
                isDarkTheme(theme)
                  ? 'bg-amber-500/10 border-amber-500/25'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <p
                className={`text-sm font-medium mb-2 ${
                  isDarkTheme(theme) ? 'text-amber-100' : 'text-amber-900'
                }`}
              >
                FMCSA PSP Disclosure & Authorization
              </p>
              <p
                className={`text-xs leading-relaxed mb-4 ${
                  isDarkTheme(theme) ? 'text-amber-100/85' : 'text-amber-900/85'
                }`}
              >
                PSP orders are live with FMCSA — there is no test environment. You must complete the
                federal stand-alone disclosure and authorization before paying or submitting this order.
              </p>
              {pspConsentId ? (
                <p
                  className={`text-sm font-medium ${
                    isDarkTheme(theme) ? 'text-green-400' : 'text-green-700'
                  }`}
                >
                  FMCSA authorization on file — you can proceed to payment.
                </p>
              ) : (
                <Button type='button' variant='primary' size='md' onClick={() => setShowPspDisclosure(true)}>
                  Review & sign FMCSA PSP form
                </Button>
              )}
            </div>

            {showPspDisclosure && (
              <PspDisclosureForm
                userAddress={userAddress}
                companyName='Self-Request'
                onClose={() => setShowPspDisclosure(false)}
                onConsentSigned={({ consentId }) => {
                  setPspConsentId(consentId)
                  setShowPspDisclosure(false)
                }}
              />
            )}

            {/* Payment Section */}
            <div className={`${cardClass} p-5`}>
              <div className={sectionHeaderClass}>
                <CreditCard
                  className={`w-4 h-4 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                />
                Payment
              </div>

              {!isPaymentComplete ? (
                <div className='space-y-3'>
                  <p
                    className={`text-sm ${
                      isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {!isFormValid
                      ? 'Fill out all required fields above before paying.'
                      : !pspConsentId
                        ? 'Sign the FMCSA PSP Disclosure & Authorization, then pay.'
                        : 'Complete payment to proceed with your PSP order.'}
                  </p>
                  <PspPaymentButton
                    userAddress={userAddress}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    disabled={isLoading || !canPay}
                  />
                </div>
              ) : (
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    isDarkTheme(theme)
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <CheckCircle
                    className={`w-5 h-5 ${
                      isDarkTheme(theme) ? 'text-green-400' : 'text-green-500'
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        isDarkTheme(theme) ? 'text-green-300' : 'text-green-700'
                      }`}
                    >
                      Payment confirmed
                    </p>
                    <p
                      className={`text-xs font-mono ${
                        isDarkTheme(theme) ? 'text-green-400/70' : 'text-green-600'
                      }`}
                    >
                      {paymentTxHash?.slice(0, 20)}...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div
                className={`flex items-start gap-2 p-4 rounded-xl ${
                  isDarkTheme(theme)
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    isDarkTheme(theme) ? 'text-red-400' : 'text-red-500'
                  }`}
                />
                <p
                  className={`text-sm ${
                    isDarkTheme(theme) ? 'text-red-300' : 'text-red-700'
                  }`}
                >
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type='submit'
              disabled={isLoading || !isPaymentComplete || !pspConsentId}
              className={`w-full px-6 py-4 rounded-xl font-semibold transition-all duration-200 ${
                isLoading || !isPaymentComplete || !pspConsentId
                  ? isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isDarkTheme(theme)
                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isLoading
                ? 'Ordering PSP...'
                : !pspConsentId
                  ? 'Sign FMCSA disclosure first'
                  : !isPaymentComplete
                    ? 'Complete Payment First'
                    : 'Submit PSP Order'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
