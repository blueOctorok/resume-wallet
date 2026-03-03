'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface MotorCarrierOnboardingProps {
  onComplete: () => void
}

interface FormData {
  companyName: string
  dotNumber: string
  mcNumber: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressZip: string
  phone: string
  email: string
}

const EMPTY_FORM: FormData = {
  companyName: '',
  dotNumber: '',
  mcNumber: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressZip: '',
  phone: '',
  email: '',
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

/**
 * Blocking full-screen onboarding gate shown to the company owner on first login.
 * Collects the Employing Motor Carrier information required for DOT applications.
 * This runs once — after submit the company is created and the flag is set permanently.
 */
export default function MotorCarrierOnboarding({ onComplete }: MotorCarrierOnboardingProps) {
  const { theme } = useTheme()
  const { walletAddress } = useAuthStore()

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isDark = theme === 'dark'

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Basic required field validation
    const required: (keyof FormData)[] = [
      'companyName', 'dotNumber', 'addressStreet',
      'addressCity', 'addressState', 'addressZip', 'phone', 'email',
    ]
    const missing = required.filter(f => !form[f].trim())
    if (missing.length > 0) {
      setError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/employer/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress ?? '',
        },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save company profile.')
      }

      setSuccess(true)
      // Brief success pause so the user sees the confirmation, then continue
      setTimeout(onComplete, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Shared input class ---
  const inputClass = `w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${
    isDark
      ? 'bg-gray-700/60 border-gray-600 text-white placeholder-gray-400 focus:border-teal-400 focus:outline-none'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'
  }`

  const labelClass = `block text-xs font-semibold uppercase tracking-wide mb-1 ${
    isDark ? 'text-gray-400' : 'text-gray-500'
  }`

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDark ? 'bg-gray-950' : 'bg-gray-50'
    }`}>
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl p-8 ${
        isDark
          ? 'bg-gray-900 border border-teal-500/20'
          : 'bg-white border border-gray-200'
      }`}>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`p-3 rounded-xl ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
            <Building2 className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Motor Carrier Profile
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              This information appears on all DOT applications sent through StormChain.
            </p>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="w-14 h-14 text-teal-500" />
            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Company profile saved!
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Taking you to your hub...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Company Info */}
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 ${
                isDark ? 'text-teal-400' : 'text-teal-600'
              }`}>
                Company Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Legal Company Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Acme Trucking LLC"
                    value={form.companyName}
                    onChange={e => handleChange('companyName', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    USDOT Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="1234567"
                    value={form.dotNumber}
                    onChange={e => handleChange('dotNumber', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>MC Number</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="MC-123456 (optional)"
                    value={form.mcNumber}
                    onChange={e => handleChange('mcNumber', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 ${
                isDark ? 'text-teal-400' : 'text-teal-600'
              }`}>
                Contact
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    className={inputClass}
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="dispatch@acmetrucking.com"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Address */}
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 ${
                isDark ? 'text-teal-400' : 'text-teal-600'
              }`}>
                Principal Address
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Street <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="123 Freight Ave"
                    value={form.addressStreet}
                    onChange={e => handleChange('addressStreet', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Dallas"
                    value={form.addressCity}
                    onChange={e => handleChange('addressCity', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      State <span className="text-red-400">*</span>
                    </label>
                    <select
                      className={inputClass}
                      value={form.addressState}
                      onChange={e => handleChange('addressState', e.target.value)}
                    >
                      <option value="">—</option>
                      {US_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Zip <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="75001"
                      value={form.addressZip}
                      onChange={e => handleChange('addressZip', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                isDark
                  ? 'bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50'
                  : 'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue to Hub'
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  )
}
