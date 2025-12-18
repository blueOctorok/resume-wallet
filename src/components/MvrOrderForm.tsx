'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import MvrPaymentButton from './MvrPaymentButton'

interface MvrOrderFormProps {
  userAddress: string
  onBack: () => void
}

export default function MvrOrderForm({ userAddress, onBack }: MvrOrderFormProps) {
  const { theme } = useTheme()

  // Personal Information
  const [firstName, setFirstName] = useState('')
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

  // Check for pending payment on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingPayment = localStorage.getItem('pendingMvrPayment')
      if (pendingPayment) {
        setPaymentTxHash(pendingPayment)
        setIsPaymentComplete(true)
        // Clear it from localStorage
        localStorage.removeItem('pendingMvrPayment')
      }
    }
  }, [])

  const handlePaymentSuccess = (txHash: string) => {
    setPaymentTxHash(txHash)
    setIsPaymentComplete(true)
    setError(null) // Clear any previous errors
  }

  const handlePaymentError = (errorMsg: string) => {
    setError(`Payment failed: ${errorMsg}`)
    setIsPaymentComplete(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Require payment before submission
    if (!isPaymentComplete || !paymentTxHash) {
      setError('Please complete payment before submitting order')
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
          paymentTxHash, // Include payment transaction hash
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          ssn: ssn.trim(),
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
    } catch (err: any) {
      setError(err.message || 'Failed to order MVR')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border transition-all ${
    theme === 'light'
      ? 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
      : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream placeholder:text-brand-cream/50 focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
  }`

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className={`p-6 rounded-2xl ${
            theme === 'light'
              ? 'bg-white/80 backdrop-blur-xl border border-brand-sage/40'
              : 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint/30'
          }`}>
            <div>
              <h1 className={`text-3xl font-light tracking-wide mb-2 ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}>
                Order MVR
              </h1>
              <p className={`text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
              }`}>
                Motor Vehicle Record through Accio
              </p>
            </div>
          </div>
        </div>

      {/* Success Message */}
      {success && orderResult && (
        <div className={`p-8 rounded-2xl text-center ${
          theme === 'light'
            ? 'bg-white/80 backdrop-blur-xl border border-green-300'
            : 'bg-brand-sage-light/20 backdrop-blur-xl border border-green-500/30'
        }`}>
          <div className="mb-6">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
              theme === 'light' ? 'bg-green-100' : 'bg-green-900/30'
            }`}>
              <svg className={`w-10 h-10 ${
                theme === 'light' ? 'text-green-600' : 'text-green-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className={`text-2xl font-semibold mb-3 ${
            theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
          }`}>
            MVR Order Placed Successfully!
          </h3>
          <p className={`text-sm mb-8 ${
            theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
          }`}>
            Order Number: <span className="font-mono font-semibold">{orderResult.orderNumber}</span>
          </p>
          <button
            onClick={onBack}
            className={`px-8 py-3 rounded-xl font-semibold transition-all ${
              theme === 'light'
                ? 'bg-brand-sage text-white hover:bg-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                : 'bg-brand-sage-light/20 text-brand-cream hover:bg-brand-sage-light/30 border border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
            }`}
          >
            Done
          </button>
        </div>
      )}

      {/* Form */}
      {!success && (
        <form onSubmit={handleSubmit} className={`p-8 rounded-2xl space-y-6 ${
          theme === 'light'
            ? 'bg-white/80 backdrop-blur-xl border border-brand-sage/40'
            : 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint/30'
        }`}>
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-wide ${
              theme === 'light' ? 'text-gray-700' : 'text-brand-cream/80'
            }`}>
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="First Name"
                className={inputClass}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Last Name"
                className={inputClass}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className={inputClass}
              />
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="text"
                value={ssn}
                onChange={(e) => setSsn(e.target.value.slice(0, 4))}
                required
                placeholder="SSN (Last 4)"
                maxLength={4}
                className={inputClass}
              />
            </div>
          </div>

          {/* Driver License */}
          <div className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-wide ${
              theme === 'light' ? 'text-gray-700' : 'text-brand-cream/80'
            }`}>
              Driver License
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                required
                placeholder="DL Number"
                className={inputClass}
              />
              <input
                type="text"
                value={dlState}
                onChange={(e) => setDlState(e.target.value.toUpperCase())}
                required
                placeholder="DL State (TX)"
                maxLength={2}
                className={inputClass}
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-wide ${
              theme === 'light' ? 'text-gray-700' : 'text-brand-cream/80'
            }`}>
              Address
            </h3>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="Street Address"
              className={inputClass}
            />
            <div className="grid grid-cols-3 gap-4">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="City"
                className={inputClass}
              />
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                required
                placeholder="State"
                maxLength={2}
                className={inputClass}
              />
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                placeholder="Zip"
                maxLength={10}
                className={inputClass}
              />
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-wide ${
              theme === 'light' ? 'text-gray-700' : 'text-brand-cream/80'
            }`}>
              Payment
            </h3>
            
            {!isPaymentComplete ? (
              <div className="space-y-2">
                <p className={`text-sm ${
                  theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
                }`}>
                  Complete payment to proceed with your MVR order.
                </p>
                <MvrPaymentButton 
                  userAddress={userAddress}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div className={`p-4 rounded-xl ${
                theme === 'light'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-green-900/20 border border-green-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  <svg className={`w-5 h-5 ${
                    theme === 'light' ? 'text-green-600' : 'text-green-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className={`text-sm font-medium ${
                    theme === 'light' ? 'text-green-700' : 'text-green-400'
                  }`}>
                    Payment confirmed
                  </p>
                </div>
                <p className={`text-xs mt-1 font-mono ${
                  theme === 'light' ? 'text-green-600' : 'text-green-400/80'
                }`}>
                  {paymentTxHash?.slice(0, 20)}...
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className={`p-4 rounded-xl ${
              theme === 'light'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-red-900/20 border border-red-500/30 text-red-400'
            }`}>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isPaymentComplete}
            className={`w-full px-6 py-4 rounded-xl font-semibold text-base transition-all ${
              isLoading || !isPaymentComplete
                ? theme === 'light'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-brand-sage-light/10 text-brand-cream/40 cursor-not-allowed'
                : theme === 'light'
                  ? 'bg-brand-sage text-white hover:bg-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                  : 'bg-brand-sage-light/20 text-brand-cream hover:bg-brand-sage-light/30 border border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
            }`}
          >
            {isLoading ? 'Ordering MVR...' : !isPaymentComplete ? 'Complete Payment First' : 'Submit MVR Order'}
          </button>
        </form>
      )}
      </div>
    </div>
  )
}

