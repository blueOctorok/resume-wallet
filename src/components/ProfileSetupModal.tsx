'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import { User, Mail, Phone, MapPin, Loader2, Sparkles } from 'lucide-react'

interface ProfileSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (firstName?: string, lastName?: string) => void
  sessionUserId: string
  userRole: 'driver' | 'developer' | 'candidate'
  userEmail?: string | null
}

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string // For developers: "City, State" or "Remote"
  city: string     // For drivers: separate city
  state: string    // For drivers: separate state
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

export default function ProfileSetupModal({
  isOpen,
  onClose,
  onComplete,
  sessionUserId,
  userRole,
  userEmail,
}: ProfileSetupModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

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

  useEffect(() => {
    if (userEmail && !form.email) {
      setForm(prev => ({ ...prev, email: userEmail }))
    }
  }, [userEmail])

  const handleChange = (field: keyof ProfileData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
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
      // Write identity to user_profiles — the single source of truth for name/email/phone/location.
      const profileSetupRes = await fetch('/api/user/profile-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-wallet-address': sessionUserId,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state || undefined,
        }),
      })

      if (!profileSetupRes.ok) {
        throw new Error('Failed to save profile')
      }

      onComplete(form.firstName.trim(), form.lastName.trim())
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
      maxWidth="max-w-md"
      zIndex={100}
      disableBackdropClose
      disableEscapeClose
    >
      {/* Header */}
        <div className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}>
              <Sparkles className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Welcome to ZKnight!
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Let&apos;s set up your profile
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                First Name *
              </label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="John"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                  } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Last Name *
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Smith"
                className={`w-full px-4 py-2.5 rounded-xl border transition-colors ${
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                } focus:outline-none focus:ring-1 focus:ring-teal-500`}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Email
            </label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="john@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                } focus:outline-none focus:ring-1 focus:ring-teal-500`}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Phone
            </label>
            <div className="relative">
              <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                } focus:outline-none focus:ring-1 focus:ring-teal-500`}
              />
            </div>
          </div>

          {/* Location - different UI for drivers vs developers */}
          {userRole === 'driver' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  City
                </label>
                <div className="relative">
                  <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="Dallas"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                    } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  State
                </label>
                <select
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-gray-800 border-gray-600 text-white focus:border-teal-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-teal-500'
                  } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                >
                  <option value="">Select</option>
                  {US_STATES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Location
              </label>
              <div className="relative">
                <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="San Francisco, CA or Remote"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
                  } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {/* Actions — no skip: incomplete profiles show as "Unknown" to employers */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`w-full px-4 py-2.5 rounded-xl font-medium transition-colors ${
                saving
                  ? 'bg-teal-600/50 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-500'
              } text-white`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>

          <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            You can update contact details anytime from your hub after saving
          </p>
        </form>
    </Modal>
  )
}
