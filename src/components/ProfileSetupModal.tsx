'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import { DOT_PAPER_INPUT, DOT_PAPER_LABEL } from '@/lib/dot-form-paper'
import { User, Mail, Phone, MapPin, Sparkles } from 'lucide-react'

interface ProfileSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (saved: {
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    city: string | null
    state: string | null
  }) => void
  sessionUserId: string
  userRole: 'driver' | 'developer' | 'candidate'
  userEmail?: string | null
}

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string // For developers/candidates: "City, State" or "Remote"
  city: string // For drivers: separate city
  state: string // For drivers: separate state
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

/** Pull "City, ST" (or free-text) into city/state for the profile-setup API. */
function locationToCityState(location: string): { city?: string; state?: string } {
  const trimmed = location.trim()
  if (!trimmed) return {}
  const match = trimmed.match(/^(.+?),\s*([A-Za-z]{2})$/)
  if (match) {
    const st = match[2].toUpperCase()
    if (US_STATES.includes(st)) return { city: match[1].trim(), state: st }
  }
  // Free-text / "Remote" — store in city so identity location isn't lost
  return { city: trimmed }
}

export default function ProfileSetupModal({
  isOpen,
  onClose,
  onComplete,
  sessionUserId,
  userRole,
  userEmail,
}: ProfileSetupModalProps) {
  const userProfile = useHubBlocksStore((s) => s.userProfile)

  const [form, setForm] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: userEmail || '',
    phone: '',
    location: '',
    city: '',
    state: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill from hub store whenever the modal opens (edit path from Build tile).
  useEffect(() => {
    if (!isOpen) return
    const city = userProfile?.city?.trim() ?? ''
    const state = userProfile?.state?.trim() ?? ''
    setForm({
      firstName: userProfile?.firstName ?? '',
      lastName: userProfile?.lastName ?? '',
      email: userProfile?.email?.trim() || userEmail || '',
      phone: userProfile?.phone ?? '',
      location: city && state ? `${city}, ${state}` : city || '',
      city,
      state,
    })
    setError(null)
  }, [isOpen, userProfile, userEmail])

  const handleChange = (field: keyof ProfileData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Please enter your first and last name')
      return
    }

    setSaving(true)

    try {
      // Candidates/developers use the single Location field; drivers use city+state.
      const fromLocation =
        userRole === 'driver' ? {} : locationToCityState(form.location)
      const city =
        userRole === 'driver' ? form.city.trim() || undefined : fromLocation.city
      const state =
        userRole === 'driver' ? form.state || undefined : fromLocation.state

      const profileSetupRes = await fetch('/api/user/profile-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': sessionUserId,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          city,
          state,
        }),
      })

      if (!profileSetupRes.ok) {
        throw new Error('Failed to save profile')
      }

      onComplete({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: city ?? null,
        state: state ?? null,
      })
    } catch (err) {
      console.error('Profile save error:', err)
      setError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      onClose={onClose}
      maxWidth='max-w-md'
      zIndex={100}
      disableBackdropClose
      disableEscapeClose
      paper
    >
      <div className='border-b border-ironside/20 px-6 pb-4 pt-6'>
        <div className='mb-2 flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-ember/10'>
            <Sparkles className='h-5 w-5 text-ember' />
          </div>
          <div>
            <h2 className='text-lg font-semibold text-[#173150]'>Welcome to Provven!</h2>
            <p className='text-sm text-ironside'>Let&apos;s set up your profile</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4 p-6'>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>
              First Name *
            </label>
            <div className='relative'>
              <User className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside' />
              <input
                type='text'
                name='given-name'
                autoComplete='given-name'
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder='John'
                className={`w-full rounded-xl border py-2.5 pl-10 pr-4 ${DOT_PAPER_INPUT}`}
              />
            </div>
          </div>
          <div>
            <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>
              Last Name *
            </label>
            <input
              type='text'
              name='family-name'
              autoComplete='family-name'
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder='Smith'
              className={`w-full rounded-xl border px-4 py-2.5 ${DOT_PAPER_INPUT}`}
            />
          </div>
        </div>

        <div>
          <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>Email</label>
          <div className='relative'>
            <Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside' />
            <input
              type='email'
              name='email'
              autoComplete='email'
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder='john@example.com'
              className={`w-full rounded-xl border py-2.5 pl-10 pr-4 ${DOT_PAPER_INPUT}`}
            />
          </div>
        </div>

        <div>
          <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>Phone</label>
          <div className='relative'>
            <Phone className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside' />
            <PhoneInput
              value={form.phone}
              onChange={(val) => handleChange('phone', val)}
              placeholder='(555) 123-4567'
              className={`w-full rounded-xl border py-2.5 pl-10 pr-4 ${DOT_PAPER_INPUT}`}
            />
          </div>
        </div>

        {userRole === 'driver' ? (
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>City</label>
              <div className='relative'>
                <MapPin className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside' />
                <input
                  type='text'
                  name='address-level2'
                  autoComplete='address-level2'
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder='Dallas'
                  className={`w-full rounded-xl border py-2.5 pl-10 pr-4 ${DOT_PAPER_INPUT}`}
                />
              </div>
            </div>
            <div>
              <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>State</label>
              <select
                name='address-level1'
                autoComplete='address-level1'
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 ${DOT_PAPER_INPUT}`}
              >
                <option value=''>Select</option>
                {US_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>
              Location
            </label>
            <div className='relative'>
              <MapPin className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside' />
              <input
                type='text'
                name='address-level2'
                autoComplete='address-level2'
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder='San Francisco, CA or Remote'
                className={`w-full rounded-xl border py-2.5 pl-10 pr-4 ${DOT_PAPER_INPUT}`}
              />
            </div>
          </div>
        )}

        {error && <p className='text-sm text-red-600'>{error}</p>}

        <div className='pt-2'>
          <Button type='submit' isLoading={saving} className='w-full'>
            Save Profile
          </Button>
        </div>

        <p className='text-center text-xs text-ironside'>
          You can update contact details anytime from your hub after saving
        </p>
      </form>
    </Modal>
  )
}
