'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, FileText, User, CreditCard, MapPin } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import MvrPaymentButton from './MvrPaymentButton'
import BackToHubButton from './ui/BackToHubButton'
import Button from './ui/Button'
import BackgroundCheckDisclosure from './BackgroundCheckDisclosure'
import { usePendingScreeningRequest } from '@/hooks/use-pending-screening-request'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'

interface MvrOrderFormProps {
  userAddress: string
  onBack: () => void
}

export default function MvrOrderForm({ userAddress, onBack }: MvrOrderFormProps) {
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
  /** Self-order: CRA disclosure + express consent before pay (Key Background / FCRA transparency) */
  const [vendorProcessingAck, setVendorProcessingAck] = useState(false)

  // Employer-requested MVR (FCRA gate): if a pending mvr_order request exists for this candidate,
  // we MUST surface the company-scoped FCRA disclosure before any self-service flow.
  // This is defense in depth — the inbox flow handles it too, but candidates can deep-link
  // here straight from the bell notification (`?onboard=mvr`), bypassing the inbox entirely.
  const { pendingRequest: pendingEmployerRequest, refresh: refreshPendingRequest } =
    usePendingScreeningRequest('mvr', userAddress)

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

  const canPay = isFormValid && vendorProcessingAck

  // Check for pending payment on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingPayment = localStorage.getItem('pendingMvrPayment')
      if (pendingPayment) {
        setPaymentTxHash(pendingPayment)
        setIsPaymentComplete(true)
        localStorage.removeItem('pendingMvrPayment')
      }
    }
  }, [])

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

    if (!vendorProcessingAck) {
      setError('Please read the disclosure and check the consent box before submitting.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setOrderResult(null)

    try {
      const response = await fetch('/api/mvr/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          paymentTxHash,
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
          mvrSearchType: 'standard',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to order MVR')
      }

      setSuccess(true)
      setOrderResult(data.order)
      const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
      void syncDriverHubFromApi(userAddress)
    } catch (err: any) {
      setError(err.message || 'Failed to order MVR')
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

  // Tracks whether the employer-initiated order was placed so we don't fall through to the self-order form
  const [employerOrderComplete, setEmployerOrderComplete] = useState(false)

  // Capture the request the moment we see it, so the wizard owns its lifecycle.
  // Without this: signing the disclosure marks the candidate_request as 'completed',
  // refreshPendingRequest() returns null, and the component briefly renders the
  // self-order form between the sign callback and onOrderPlaced firing.
  const [capturedRequest, setCapturedRequest] = useState(pendingEmployerRequest)
  useEffect(() => {
    if (pendingEmployerRequest && !capturedRequest) {
      setCapturedRequest(pendingEmployerRequest)
    }
  }, [pendingEmployerRequest, capturedRequest])

  const activeEmployerRequest = capturedRequest || pendingEmployerRequest

  // Employer-initiated flow: render the combined disclosure + order form as the full page
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
                MVR Order Submitted
              </h3>
              <p className={`text-sm mb-6 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                Your disclosure has been signed and the MVR order has been submitted to Accio. Results typically arrive within 24–48 hours.
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
          <BackgroundCheckDisclosure
            requestId={activeEmployerRequest!.id}
            companyName={activeEmployerRequest!.companyName}
            userAddress={userAddress}
            renderInline
            fulfillOrder
            onClose={onBack}
            // Don't refresh pendingRequest here — the consent endpoint marks the
            // request 'completed' immediately, which would unmount this wizard
            // before onOrderPlaced fires. The wizard owns its lifecycle via
            // capturedRequest + employerOrderComplete.
            onConsentSigned={() => {}}
            onOrderPlaced={async () => {
              setEmployerOrderComplete(true)
              void refreshPendingRequest()
              const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
              void syncDriverHubFromApi(userAddress)
            }}
          />
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
                Order MVR
              </h1>
              <p
                className={`text-sm ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Motor Vehicle Record via Accio
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
              MVR Order Placed!
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

            {/* Vendor / CRA disclosure — self-order; express consent required before pay */}
            <div
              className={`rounded-2xl border p-5 ${
                isDarkTheme(theme)
                  ? 'bg-gray-800/40 border-gray-600'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p
                className={`text-sm font-medium mb-2 ${
                  isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Your MVR and consumer reporting
              </p>
              <p
                className={`text-xs leading-relaxed mb-3 ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {
                  'Your motor vehicle record ("MVR") is obtained through Key Background Screening, Inc. ("Key Background"), a consumer reporting agency ("CRA"), via its secure ordering system, and not directly by Storm. The information you provide will be transmitted to Key Background for the purpose of retrieving your official state driving record. Storm does not independently conduct motor vehicle record searches.'
                }
              </p>
              <p
                className={`text-xs leading-relaxed mb-4 ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Learn more:{' '}
                <a
                  href='https://keybackground.com'
                  target='_blank'
                  rel='noopener noreferrer'
                  className={`font-medium underline underline-offset-2 ${
                    isDarkTheme(theme) ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800'
                  }`}
                >
                  keybackground.com
                </a>
              </p>
              <label
                className={`flex items-start gap-3 cursor-pointer text-sm ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <input
                  type='checkbox'
                  checked={vendorProcessingAck}
                  onChange={(e) => setVendorProcessingAck(e.target.checked)}
                  className='mt-1 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 dark:bg-gray-900'
                />
                <span className='leading-snug'>
                  By checking this box and continuing, I acknowledge and provide my express consent to
                  the transmission of my information to Key Background Screening, Inc., a consumer
                  reporting agency, for the purpose of processing this MVR request.
                </span>
              </label>
            </div>

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
                      : !vendorProcessingAck
                        ? 'Read the disclosure and check the consent box, then pay.'
                        : 'Complete payment to proceed with your MVR order.'}
                  </p>
                  <MvrPaymentButton
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
              disabled={isLoading || !isPaymentComplete || !vendorProcessingAck}
              className={`w-full px-6 py-4 rounded-xl font-semibold transition-all duration-200 ${
                isLoading || !isPaymentComplete || !vendorProcessingAck
                  ? isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isDarkTheme(theme)
                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isLoading
                ? 'Ordering MVR...'
                : !vendorProcessingAck
                  ? 'Confirm consent above'
                  : !isPaymentComplete
                    ? 'Complete Payment First'
                    : 'Submit MVR Order'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
