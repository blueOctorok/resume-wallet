'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { DOT_PAPER_CARD, DOT_PAPER_INPUT, DOT_PAPER_LABEL } from '@/lib/dot-form-paper'
import { Car, Code2, CheckCircle, AlertTriangle } from 'lucide-react'

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
  sessionUserId: string
  onComplete: () => void
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
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={`mb-1.5 block text-sm font-medium ${DOT_PAPER_LABEL}`}>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = `w-full rounded-xl border px-3 py-2.5 text-sm ${DOT_PAPER_INPUT}`

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfileSetup({
  role,
  sessionUserId,
  onComplete,
}: ProfileSetupProps) {
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
        const res = await fetch('/api/user/existing-profiles')
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
  }, [sessionUserId, isDriver])

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
        headers: { 'Content-Type': 'application/json',
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ember/10">
          <CheckCircle className="h-8 w-8 text-ember" />
        </div>
        <h2 className="text-xl font-bold text-[#173150]">Profile created!</h2>
        <p className="text-sm text-ironside">Taking you to your hub…</p>
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ember/10">
          {isDriver
            ? <Car className="h-6 w-6 text-ember" />
            : <Code2 className="h-6 w-6 text-ember" />
          }
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#173150]">Set up your profile</h1>
          <p className="mt-1 text-sm text-ironside">
            {isDriver
              ? 'Quick setup so employers can find you. Takes under a minute.'
              : 'Basic info so employers know who you are and can reach out.'
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`${DOT_PAPER_CARD} space-y-5 p-6`}>
        {crossRoleName && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">
                We see you already have a {crossRoleHubLabel} profile as <strong>{crossRoleName}</strong>.
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Is that you?
              </p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={applyExistingName}>
                  Yes, use this name
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setCrossRoleName(null)}>
                  No, I&apos;m different
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" required>
            <input
              type="text"
              autoFocus
              value={isDriver ? driverFields.firstName : devFields.firstName}
              onChange={e => isDriver
                ? updateDriver('firstName', e.target.value)
                : updateDev('firstName', e.target.value)
              }
              placeholder="Leon"
              className={inputClass}
            />
          </Field>
          <Field label="Last Name" required>
            <input
              type="text"
              value={isDriver ? driverFields.lastName : devFields.lastName}
              onChange={e => isDriver
                ? updateDriver('lastName', e.target.value)
                : updateDev('lastName', e.target.value)
              }
              placeholder="Kennedy"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={isDriver ? driverFields.email : devFields.email}
            onChange={e => isDriver
              ? updateDriver('email', e.target.value)
              : updateDev('email', e.target.value)
            }
            placeholder="leon@example.com"
            className={inputClass}
          />
        </Field>

        {isDriver ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input
                  type="tel"
                  value={driverFields.phone}
                  onChange={e => updateDriver('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  type="text"
                  value={driverFields.city}
                  onChange={e => updateDriver('city', e.target.value)}
                  placeholder="Columbus"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="border-t border-ironside/20 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ironside">
                CDL Information
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="CDL Class">
                  <select
                    value={driverFields.cdlClass}
                    onChange={e => updateDriver('cdlClass', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {CDL_CLASSES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="CDL State">
                  <select
                    value={driverFields.cdlState}
                    onChange={e => updateDriver('cdlState', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">State…</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Home State">
                  <select
                    value={driverFields.state}
                    onChange={e => updateDriver('state', e.target.value)}
                    className={inputClass}
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
            <Field label="What do you do?">
              <input
                type="text"
                value={devFields.headline}
                onChange={e => updateDev('headline', e.target.value)}
                placeholder="Full Stack Developer · React & Node.js"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="GitHub Username">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ironside">@</span>
                  <input
                    type="text"
                    value={devFields.githubUsername}
                    onChange={e => updateDev('githubUsername', e.target.value)}
                    placeholder="username"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={devFields.location}
                  onChange={e => updateDev('location', e.target.value)}
                  placeholder="Columbus, OH"
                  className={inputClass}
                />
              </Field>
            </div>
          </>
        )}

        {error && (
          <p className="pt-1 text-sm text-red-600">{error}</p>
        )}

        <div className="pt-2">
          <Button type="submit" disabled={!canSubmit} isLoading={saving} className="w-full">
            Save & Go to Hub
          </Button>
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-ironside">
        You can always update this later from your hub settings.
      </p>
    </div>
  )
}
