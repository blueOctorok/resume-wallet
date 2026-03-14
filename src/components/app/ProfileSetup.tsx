'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, ArrowLeft, Car, Code2, CheckCircle, AlertTriangle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DriverFields {
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  state: string
  cdlClass: string
  cdlState: string
}

interface DevFields {
  firstName: string
  lastName: string
  email: string
  headline: string
  githubUsername: string
  location: string
}

interface ProfileSetupProps {
  role: 'driver' | 'developer' | 'candidate'
  walletAddress: string
  onComplete: () => void
  onSkip?: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const CDL_CLASSES = ['CDL-A', 'CDL-B', 'CDL-C']

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  theme,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  theme: string
}) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-1.5 ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      }`}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = (theme: string) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  }`

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfileSetup({
  role,
  walletAddress,
  onComplete,
  onSkip,
}: ProfileSetupProps) {
  const { theme } = useTheme()
  const isDriver = role === 'driver'

  const [driverFields, setDriverFields] = useState<DriverFields>({
    firstName: '', lastName: '', email: '', phone: '',
    city: '', state: '', cdlClass: '', cdlState: '',
  })

  const [devFields, setDevFields] = useState<DevFields>({
    firstName: '', lastName: '', email: '',
    headline: '', githubUsername: '', location: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Cross-role conflict: e.g. driver setting up a dev hub (or vice versa)
  // when they already have a named profile in the other hub.
  const [crossRoleName, setCrossRoleName] = useState<string | null>(null)
  const [crossRoleHubLabel, setCrossRoleHubLabel] = useState<string>('')

  useEffect(() => {
    const checkExistingProfiles = async () => {
      try {
        const res = await fetch('/api/user/existing-profiles', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!res.ok) return
        const data = await res.json()

        if (isDriver && data.devProfile?.name) {
          setCrossRoleName(data.devProfile.name)
          setCrossRoleHubLabel('developer')
        } else if (!isDriver && data.driverProfile?.name) {
          setCrossRoleName(data.driverProfile.name)
          setCrossRoleHubLabel('driver')
        }
      } catch { /* non-critical */ }
    }
    checkExistingProfiles()
  }, [walletAddress, isDriver])

  const applyExistingName = () => {
    if (!crossRoleName) return
    const [first, ...rest] = crossRoleName.split(' ')
    const last = rest.join(' ')
    if (isDriver) {
      updateDriver('firstName', first || '')
      updateDriver('lastName', last || '')
    } else {
      updateDev('firstName', first || '')
      updateDev('lastName', last || '')
    }
    setCrossRoleName(null) // dismiss banner once applied
  }

  const updateDriver = (field: keyof DriverFields, value: string) =>
    setDriverFields(prev => ({ ...prev, [field]: value }))

  const updateDev = (field: keyof DevFields, value: string) =>
    setDevFields(prev => ({ ...prev, [field]: value }))

  const canSubmit = isDriver
    ? driverFields.firstName.trim() && driverFields.lastName.trim()
    : devFields.firstName.trim() && devFields.lastName.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    setError(null)
    try {
      const endpoint = isDriver
        ? '/api/driver/profile/quick-setup'
        : '/api/developer/profile/quick-setup'

      const body = isDriver ? driverFields : devFields

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save profile')

      setDone(true)
      // Brief success flash before navigating back to hub
      setTimeout(() => onComplete(), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ─── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
        }`}>
          <CheckCircle className="w-8 h-8 text-teal-500" />
        </div>
        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Profile created!
        </h2>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Taking you to your hub…
        </p>
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      {onSkip && (
        <button
          onClick={onSkip}
          className={`flex items-center gap-2 mb-6 text-sm transition-colors ${
            theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Skip for now
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
          isDriver
            ? theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
            : theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
        }`}>
          {isDriver
            ? <Car className={`w-6 h-6 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
            : <Code2 className={`w-6 h-6 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
          }
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Set up your profile
          </h1>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {isDriver
              ? 'Quick setup so employers can find you. Takes under a minute.'
              : 'Basic info so employers know who you are and can reach out.'
            }
          </p>
        </div>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl p-6 space-y-5 ${
          theme === 'dark'
            ? 'bg-gray-900 border border-gray-700'
            : 'bg-white shadow-sm border border-gray-100'
        }`}
      >

        {/* Cross-role identity banner */}
        {crossRoleName && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            theme === 'dark'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
                We see you already have a {crossRoleHubLabel} profile as <strong>{crossRoleName}</strong>.
              </p>
              <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-amber-400/80' : 'text-amber-700'}`}>
                Is that you?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={applyExistingName}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  Yes, use this name
                </button>
                <button
                  type="button"
                  onClick={() => setCrossRoleName(null)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  No, I&apos;m different
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Name (both roles) ── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" required theme={theme}>
            <input
              type="text"
              autoFocus
              value={isDriver ? driverFields.firstName : devFields.firstName}
              onChange={e => isDriver
                ? updateDriver('firstName', e.target.value)
                : updateDev('firstName', e.target.value)
              }
              placeholder="Leon"
              className={inputClass(theme)}
            />
          </Field>
          <Field label="Last Name" required theme={theme}>
            <input
              type="text"
              value={isDriver ? driverFields.lastName : devFields.lastName}
              onChange={e => isDriver
                ? updateDriver('lastName', e.target.value)
                : updateDev('lastName', e.target.value)
              }
              placeholder="Kennedy"
              className={inputClass(theme)}
            />
          </Field>
        </div>

        {/* ── Email (both roles) ── */}
        <Field label="Email" theme={theme}>
          <input
            type="email"
            value={isDriver ? driverFields.email : devFields.email}
            onChange={e => isDriver
              ? updateDriver('email', e.target.value)
              : updateDev('email', e.target.value)
            }
            placeholder="leon@example.com"
            className={inputClass(theme)}
          />
        </Field>

        {isDriver ? (
          <>
            {/* ── Driver: Phone + Location ── */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone" theme={theme}>
                <input
                  type="tel"
                  value={driverFields.phone}
                  onChange={e => updateDriver('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className={inputClass(theme)}
                />
              </Field>
              <Field label="City" theme={theme}>
                <input
                  type="text"
                  value={driverFields.city}
                  onChange={e => updateDriver('city', e.target.value)}
                  placeholder="Columbus"
                  className={inputClass(theme)}
                />
              </Field>
            </div>

            {/* ── Driver: CDL info ── */}
            <div className={`pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                CDL Information
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="CDL Class" theme={theme}>
                  <select
                    value={driverFields.cdlClass}
                    onChange={e => updateDriver('cdlClass', e.target.value)}
                    className={inputClass(theme)}
                  >
                    <option value="">Select…</option>
                    {CDL_CLASSES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="CDL State" theme={theme}>
                  <select
                    value={driverFields.cdlState}
                    onChange={e => updateDriver('cdlState', e.target.value)}
                    className={inputClass(theme)}
                  >
                    <option value="">State…</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Home State" theme={theme}>
                  <select
                    value={driverFields.state}
                    onChange={e => updateDriver('state', e.target.value)}
                    className={inputClass(theme)}
                  >
                    <option value="">State…</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── Dev: Headline ── */}
            <Field label="What do you do?" theme={theme}>
              <input
                type="text"
                value={devFields.headline}
                onChange={e => updateDev('headline', e.target.value)}
                placeholder="Full Stack Developer · React & Node.js"
                className={inputClass(theme)}
              />
            </Field>

            {/* ── Dev: GitHub + Location ── */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="GitHub Username" theme={theme}>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}>@</span>
                  <input
                    type="text"
                    value={devFields.githubUsername}
                    onChange={e => updateDev('githubUsername', e.target.value)}
                    placeholder="username"
                    className={`${inputClass(theme)} pl-7`}
                  />
                </div>
              </Field>
              <Field label="Location" theme={theme}>
                <input
                  type="text"
                  value={devFields.location}
                  onChange={e => updateDev('location', e.target.value)}
                  placeholder="Columbus, OH"
                  className={inputClass(theme)}
                />
              </Field>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 pt-1">{error}</p>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              canSubmit && !saving
                ? isDriver
                  ? 'bg-teal-600 hover:bg-teal-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
            }`}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              : 'Save & Go to Hub'
            }
          </button>
        </div>
      </form>

      <p className={`text-xs text-center mt-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
        You can always update this later from your hub settings.
      </p>
    </div>
  )
}
