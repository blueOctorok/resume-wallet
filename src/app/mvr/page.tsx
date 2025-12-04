'use client'

/**
 * MVR Order Page
 * 
 * Dedicated page for drivers to order Motor Vehicle Records through Accio
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@account-kit/react'
import { useTheme } from '@/contexts/ThemeContext'

// Client-only wrapper to prevent SSR issues with Alchemy hooks
function MvrOrderForm() {
  const user = useUser()
  const router = useRouter()
  const { theme } = useTheme()
  // Personal Information
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [ssn, setSsn] = useState('') // Last 4 digits
  const [dob, setDob] = useState('') // YYYY-MM-DD
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'U'>('U')
  
  // License Information
  const [dlNumber, setDlNumber] = useState('')
  const [dlState, setDlState] = useState('')
  const [jobState, setJobState] = useState('')
  const [mvrSearchType, setMvrSearchType] = useState<'standard' | 'comprehensive'>('standard')
  const [includeFmcsa, setIncludeFmcsa] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!user?.address) {
      router.push('/')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setOrderResult(null)

    try {
      const response = await fetch('/api/mvr/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: user?.address,
          // Personal information
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          middleName: middleName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          ssn: ssn.trim() || undefined,
          dob: dob.trim() || undefined,
          gender: gender || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim().toUpperCase() || undefined,
          zip: zip.trim() || undefined,
          // License information
          dlNumber: dlNumber.trim(),
          dlState: dlState.trim().toUpperCase(),
          jobState: jobState.trim().toUpperCase() || undefined,
          mvrSearchType,
          includeFmcsaCrashInspection: includeFmcsa,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Enhanced error with helpful message
        const errorMessage = data.error || 'Failed to order MVR'
        const requiresPersonalInfo = data.requiresPersonalInfo
        
        if (requiresPersonalInfo) {
          throw new Error(`${errorMessage}\n\nYou can provide this information by completing your DOT application, or we can add fields to this form.`)
        }
        
        throw new Error(errorMessage)
      }

      setSuccess(true)
      setOrderResult(data.order)
    } catch (err: any) {
      setError(err.message || 'Failed to order MVR')
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render if not authenticated
  if (!user?.address) {
    return null
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className={`mb-8 p-6 rounded-2xl ${
          theme === 'light'
            ? 'bg-white/80 backdrop-blur-xl border border-brand-sage/40'
            : 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint/30'
        }`}>
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
          }`}>
            Order Motor Vehicle Record
          </h1>
          <p className={`text-sm ${
            theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
          }`}>
            Order an MVR through Accio to verify your driving record and license status.
          </p>
        </div>


        {/* Success Message */}
        {success && orderResult && (
          <div className={`mb-6 p-6 rounded-2xl ${
            theme === 'light'
              ? 'bg-green-50 border border-green-200'
              : 'bg-green-900/20 border border-green-500/30'
          }`}>
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'light' ? 'text-green-800' : 'text-green-400'
            }`}>
              ✅ MVR Order Placed Successfully!
            </h3>
            <div className={`text-sm space-y-1 ${
              theme === 'light' ? 'text-green-700' : 'text-green-300'
            }`}>
              <p><strong>Order ID:</strong> {orderResult.id}</p>
              <p><strong>Order Number:</strong> {orderResult.orderNumber}</p>
              <p><strong>Status:</strong> {orderResult.status}</p>
              {orderResult.applicantPortalUrl && (
                <div className="mt-4 pt-4 border-t border-green-200/30">
                  <p className="mb-2"><strong>Additional Information Portal:</strong></p>
                  <a
                    href={orderResult.applicantPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-4 py-2 rounded-lg font-medium transition-all ${
                      theme === 'light'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-green-600/80 text-white hover:bg-green-600'
                    }`}
                  >
                    Open Portal (if needed)
                  </a>
                  <p className="mt-2 text-xs opacity-75">
                    Most MVRs complete without needing this. Only use if Accio requests additional info.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setSuccess(false)
                setOrderResult(null)
                setFirstName('')
                setLastName('')
                setMiddleName('')
                setEmail('')
                setPhone('')
                setSsn('')
                setDob('')
                setAddress('')
                setCity('')
                setState('')
                setZip('')
                setGender('U')
                setDlNumber('')
                setDlState('')
                setJobState('')
              }}
              className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium ${
                theme === 'light'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-green-600/80 text-white hover:bg-green-600'
              }`}
            >
              Order Another MVR
            </button>
          </div>
        )}

        {/* Order Form */}
        {!success && (
          <form onSubmit={handleSubmit} className={`p-6 rounded-2xl space-y-6 ${
            theme === 'light'
              ? 'bg-white/80 backdrop-blur-xl border border-brand-sage/40'
              : 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint/30'
          }`}>
            {/* Personal Information Section */}
            <div className={`pb-4 border-b ${
              theme === 'light' ? 'border-gray-200' : 'border-brand-cream/20'
            }`}>
              <h3 className={`text-lg font-semibold mb-3 ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}>
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="John"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Doe"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="john@example.com"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="555-555-5555"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* SSN Last 4 */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    SSN (Last 4 digits) *
                  </label>
                  <input
                    type="text"
                    value={ssn}
                    onChange={(e) => setSsn(e.target.value.slice(0, 4))}
                    required
                    placeholder="1234"
                    maxLength={4}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Address *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    placeholder="123 Main St"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* City */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    placeholder="Austin"
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* State */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    State *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    required
                    placeholder="TX"
                    maxLength={2}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>

                {/* Zip */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                  }`}>
                    Zip Code *
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    required
                    placeholder="78701"
                    maxLength={10}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                        : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* License Information Section */}
            <div className={`pb-4 border-b ${
              theme === 'light' ? 'border-gray-200' : 'border-brand-cream/20'
            }`}>
              <h3 className={`text-lg font-semibold mb-3 ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}>
                Driver License Information
              </h3>

            {/* Driver License Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
                }`}>
                  Driver License Number *
                </label>
              <input
                type="text"
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                required
                placeholder="Enter your DL number"
                className={`w-full px-4 py-3 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                    : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                }`}
              />
              </div>

              {/* Driver License State */}
              <div>
              <label className={`block text-sm font-semibold mb-2 ${
                theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
              }`}>
                Driver License State *
              </label>
              <input
                type="text"
                value={dlState}
                onChange={(e) => setDlState(e.target.value.toUpperCase())}
                required
                placeholder="TX"
                maxLength={2}
                className={`w-full px-4 py-3 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                    : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                }`}
              />
              <p className={`mt-1 text-xs ${
                theme === 'light' ? 'text-gray-500' : 'text-brand-cream/60'
              }`}>
                  2-letter state code (e.g., TX, CA, NY)
                </p>
              </div>
            </div>
            </div>

            {/* Additional Options Section */}
            <div>
              <h3 className={`text-lg font-semibold mb-3 ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}>
                Additional Options
              </h3>

            {/* Job State (Optional) */}
            <div className="space-y-4">
              <label className={`block text-sm font-semibold mb-2 ${
                theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
              }`}>
                Job State (Optional)
              </label>
              <input
                type="text"
                value={jobState}
                onChange={(e) => setJobState(e.target.value.toUpperCase())}
                placeholder="NY"
                maxLength={2}
                className={`w-full px-4 py-3 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                    : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                }`}
              />
              <p className={`mt-1 text-xs ${
                theme === 'light' ? 'text-gray-500' : 'text-brand-cream/60'
              }`}>
                State where job will be performed (if different from license state)
              </p>
            </div>

            {/* MVR Search Type */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
              }`}>
                MVR Search Type
              </label>
              <select
                value={mvrSearchType}
                onChange={(e) => setMvrSearchType(e.target.value as 'standard' | 'comprehensive')}
                className={`w-full px-4 py-3 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                    : 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20'
                }`}
              >
                <option value="standard">Standard</option>
                <option value="comprehensive">Comprehensive</option>
              </select>
            </div>

            {/* FMCSA Checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="fmcsa"
                checked={includeFmcsa}
                onChange={(e) => setIncludeFmcsa(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-brand-sage focus:ring-brand-sage"
              />
              <label htmlFor="fmcsa" className={`text-sm ${
                theme === 'light' ? 'text-gray-700' : 'text-brand-cream'
              }`}>
                <span className="font-semibold">Include FMCSA Crash/Inspection Report</span>
                <p className={`mt-1 text-xs ${
                  theme === 'light' ? 'text-gray-500' : 'text-brand-cream/60'
                }`}>
                  Federal Motor Carrier Safety Administration records (commercial drivers only)
                </p>
              </label>
            </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`p-4 rounded-xl ${
                theme === 'light'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-red-900/20 border border-red-500/30 text-red-400'
              }`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !dlNumber || !dlState || !firstName || !lastName || !email || !ssn || !dob || !address || !city || !state || !zip}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-base transition-all ${
                isLoading || !dlNumber || !dlState || !firstName || !lastName || !email || !ssn || !dob || !address || !city || !state || !zip
                  ? theme === 'light'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-brand-sage-light/10 text-brand-cream/40 cursor-not-allowed'
                  : theme === 'light'
                    ? 'bg-brand-sage text-white hover:bg-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-brand-sage-light/20 text-brand-cream hover:bg-brand-sage-light/30 border border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
              }`}
            >
              {isLoading ? 'Ordering MVR...' : 'Order MVR'}
            </button>

            <p className={`text-xs text-center ${
              theme === 'light' ? 'text-gray-500' : 'text-brand-cream/60'
            }`}>
              * Required fields
            </p>
          </form>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className={`mt-6 px-6 py-3 rounded-xl font-medium transition-all ${
            theme === 'light'
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-brand-sage-light/10 text-brand-cream hover:bg-brand-sage-light/20'
          }`}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}

// Main page component - only renders form on client
export default function MvrOrderPage() {
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-brand-cream/60'}`}>
          Loading...
        </div>
      </div>
    )
  }

  return <MvrOrderForm />
}

