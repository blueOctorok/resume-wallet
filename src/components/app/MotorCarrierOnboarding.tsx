'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'

interface MotorCarrierOnboardingProps {
  onComplete: () => void
  /** If true, shows a back button (edit mode). If false, it's a blocking gate. */
  showBackButton?: boolean
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
export default function MotorCarrierOnboarding({ onComplete, showBackButton = false }: MotorCarrierOnboardingProps) {
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
      'companyName', 'addressStreet',
      'addressCity', 'addressState', 'addressZip', 'phone', 'email',
    ]
    const missing = required.filter(f => !form[f].trim())
    if (missing.length > 0) {
      setError('Please fill in all required fields.')
      return
    }

    if (!walletAddress?.trim()) {
      setError('Wallet not connected. Please connect your wallet and try again.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/employer/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify(form),
      })

      let data: { error?: string; success?: boolean; companyId?: string } = {}
      try {
        data = await res.json()
      } catch {
        setError(res.status === 500 ? 'Server error. Please try again.' : 'Something went wrong.')
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Failed to save company profile.')
        return
      }

      setSuccess(true)
      setTimeout(onComplete, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cardClass = isDark
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white border-gray-200'

  const inputClass = `w-full px-4 py-3 rounded-xl border transition-colors ${
    isDark
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  } focus:outline-none focus:ring-1 focus:ring-teal-500`

  const labelClass = `block text-sm font-medium mb-2 ${
    isDark ? 'text-gray-300' : 'text-gray-700'
  }`

  if (success) {
    return (
      <div className='max-w-2xl mx-auto py-12 px-4'>
        <div className={`rounded-2xl border p-12 text-center ${cardClass}`}>
          <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-teal-500/20 flex items-center justify-center'>
            <CheckCircle2 className='w-8 h-8 text-teal-500' />
          </div>
          <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Company Profile Saved!
          </h2>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Taking you to your hub...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      {/* Back button (only in edit mode, not during initial onboarding) */}
      {showBackButton && (
        <div className='mb-6'>
          <BackToHubButton onClick={onComplete} />
        </div>
      )}

      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-3 mb-2'>
          <Building2 className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Motor Carrier Profile
          </h1>
        </div>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          This information appears on all DOT applications sent through StormChain.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Company Info */}
        <div className={`rounded-2xl border p-6 ${cardClass}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`}>
            Company Information
          </h2>
          <div className='space-y-4'>
            <div>
              <label className={labelClass}>Legal Company Name <span className='text-red-400'>*</span></label>
              <input
                type='text'
                className={inputClass}
                placeholder='Acme Trucking LLC'
                value={form.companyName}
                onChange={e => handleChange('companyName', e.target.value)}
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className={labelClass}>USDOT Number <span className='text-gray-400 font-normal'>(optional)</span></label>
                <input
                  type='text'
                  className={inputClass}
                  placeholder='1234567'
                  value={form.dotNumber}
                  onChange={e => handleChange('dotNumber', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>MC Number</label>
                <input
                  type='text'
                  className={inputClass}
                  placeholder='MC-123456 (optional)'
                  value={form.mcNumber}
                  onChange={e => handleChange('mcNumber', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className={`rounded-2xl border p-6 ${cardClass}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`}>
            Contact
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className={labelClass}>Phone <span className='text-red-400'>*</span></label>
              <input
                type='tel'
                className={inputClass}
                placeholder='(555) 000-0000'
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Email <span className='text-red-400'>*</span></label>
              <input
                type='email'
                className={inputClass}
                placeholder='dispatch@acmetrucking.com'
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className={`rounded-2xl border p-6 ${cardClass}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`}>
            Principal Address
          </h2>
          <div className='space-y-4'>
            <div>
              <label className={labelClass}>Street <span className='text-red-400'>*</span></label>
              <input
                type='text'
                className={inputClass}
                placeholder='123 Freight Ave'
                value={form.addressStreet}
                onChange={e => handleChange('addressStreet', e.target.value)}
              />
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
              <div className='col-span-2 sm:col-span-2'>
                <label className={labelClass}>City <span className='text-red-400'>*</span></label>
                <input
                  type='text'
                  className={inputClass}
                  placeholder='Dallas'
                  value={form.addressCity}
                  onChange={e => handleChange('addressCity', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>State <span className='text-red-400'>*</span></label>
                <select
                  className={inputClass}
                  value={form.addressState}
                  onChange={e => handleChange('addressState', e.target.value)}
                >
                  <option value=''>—</option>
                  {US_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Zip <span className='text-red-400'>*</span></label>
                <input
                  type='text'
                  className={inputClass}
                  placeholder='75001'
                  value={form.addressZip}
                  onChange={e => handleChange('addressZip', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className='flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm'>
            <AlertCircle className='w-4 h-4 shrink-0' />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type='submit'
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
            isDark
              ? 'bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50'
              : 'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className='w-4 h-4 animate-spin' />
              Saving...
            </>
          ) : (
            'Save & Continue to Hub'
          )}
        </button>
      </form>
    </div>
  )
}
