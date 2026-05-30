'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { Building2, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'

interface CompanyOnboardingProps {
  onComplete: () => void
  /** If true, shows a back button (edit mode). If false, it's a blocking gate. */
  showBackButton?: boolean
}

interface FormData {
  firstName: string
  lastName: string
  companyName: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressZip: string
  phone: string
  email: string
}

const EMPTY_FORM: FormData = {
  firstName: '',
  lastName: '',
  companyName: '',
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
 * Company onboarding gate shown to the company owner on first login.
 * Collects company info, contact, and address.
 * Industry-specific context comes from employer blocks — not from this form.
 */
export default function CompanyOnboarding({ onComplete, showBackButton = false }: CompanyOnboardingProps) {
  const { theme } = useTheme()
  const { walletAddress } = useAuthStore()

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  /** Duplicate company name: row created for central admin; hub shows pending state */
  const [submittedForReview, setSubmittedForReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)

  const isDark = isDarkTheme(theme)

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const requiredText: (keyof FormData)[] = [
      'firstName', 'lastName', 'companyName', 'addressStreet',
      'addressCity', 'addressState', 'addressZip', 'phone', 'email',
    ]
    const missing = requiredText.filter(f => !(form[f] as string).trim())
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
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      let data: {
        error?: string
        success?: boolean
        companyId?: string
        joinedExisting?: boolean
        reviewRequired?: boolean
        message?: string
      } = {}
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

      if (data.reviewRequired) {
        setReviewMessage(typeof data.message === 'string' ? data.message : null)
        setSubmittedForReview(true)
        return
      }

      setSuccess(true)
      setTimeout(onComplete, data.joinedExisting ? 800 : 1200)
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

  if (submittedForReview) {
    return (
      <div className='max-w-2xl mx-auto py-12 px-4'>
        <div className={`rounded-2xl border p-12 text-center ${cardClass}`}>
          <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center'>
            <Clock className='w-8 h-8 text-amber-500' />
          </div>
          <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Request submitted
          </h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {reviewMessage ||
              'Storm admin will review your request. You do not need your company owner to invite you for this step.'}
          </p>
          <Button variant='primary' onClick={onComplete}>
            Continue to hub
          </Button>
        </div>
      </div>
    )
  }

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
            Company Profile
          </h1>
        </div>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Complete your company setup. Add industry-specific tools from your hub after setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Your Info */}
        <div className={`rounded-2xl border p-6 ${cardClass}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`}>
            Your Information
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className={labelClass}>First Name <span className='text-red-400'>*</span></label>
              <input
                type='text'
                className={inputClass}
                placeholder='John'
                value={form.firstName}
                onChange={e => handleChange('firstName', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Last Name <span className='text-red-400'>*</span></label>
              <input
                type='text'
                className={inputClass}
                placeholder='Smith'
                value={form.lastName}
                onChange={e => handleChange('lastName', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className={`rounded-2xl border p-6 ${cardClass}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`}>
            Company Information
          </h2>
          <div>
            <label className={labelClass}>Legal Company Name <span className='text-red-400'>*</span></label>
            <input
              type='text'
              className={inputClass}
              placeholder='Acme LLC'
              value={form.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
            />
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
                placeholder='contact@yourcompany.com'
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
                placeholder='123 Main St'
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
                  <option value=''>--</option>
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
