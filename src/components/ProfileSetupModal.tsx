'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { User, Mail, Phone, MapPin, Loader2, X, Sparkles } from 'lucide-react'

interface ProfileSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  walletAddress: string
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
  walletAddress,
  userRole,
  userEmail,
}: ProfileSetupModalProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      if (userRole === 'driver') {
        // Update driver profile
        const res = await fetch('/api/driver/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify({
            profileData: {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              email: form.email.trim() || undefined,
              phone: form.phone.trim() || undefined,
              city: form.city.trim() || undefined,
              state: form.state || undefined,
            },
            source: 'manual',
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to save profile')
        }
      } else {
        // Update developer profile
        const res = await fetch('/api/developer/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            location: form.location.trim() || undefined,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to save profile')
        }
      }

      // Also update users.name for display purposes
      await fetch('/api/user/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        }),
      }).catch(() => {})

      onComplete()
    } catch (err) {
      console.error('Profile save error:', err)
      setError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl border ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

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
                Welcome to StormChain!
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

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
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
            You can always update this later from your hub
          </p>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
