'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import {
  CDLIS_DRIVER_SECTION_HEADING,
  CDLIS_FORM_SUBTITLE,
  CDLIS_FORM_TITLE,
  CDLIS_PAGE_BREADCRUMB,
  CDLIS_PAGE_STEP_LABEL,
} from '@/lib/employer-psp-mvr-page3-copy'

function mergeProfiles(
  bg: Record<string, string> | null,
  psp: Record<string, string> | null,
): Record<string, string> {
  return { ...(bg ?? {}), ...(psp ?? {}) }
}

function defaultConsentDateIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface EmployerPspMvrBundleAttestationStepProps {
  userAddress: string
  requestId: string
  companyName: string
  /** Row from Step 2 (`POST /api/psp/consent`) — CDLIS answers merge into `form_data` before Accio. */
  pspConsentId: string | null
  bgProfile: Record<string, string> | null
  pspProfile: Record<string, string> | null
  onBack: () => void
  onOrderComplete: () => void | Promise<void>
}

/**
 * Step 3 of the employer-requested PSP + MVR bundle: **CDLIS written consent**
 * (`docs/employer-screenings/cdlis-written-consent.md`), then vendor identity (SSN)
 * and `POST /api/candidate/fulfill-screening`. Steps 1–2 already wrote
 * `bgcheck_consents` and `psp_consents`; this step PATCHes CDLIS fields onto the
 * latter before placing the Accio bundle.
 */
export default function EmployerPspMvrBundleAttestationStep({
  userAddress,
  requestId,
  companyName,
  pspConsentId,
  bgProfile,
  pspProfile,
  onBack,
  onOrderComplete,
}: EmployerPspMvrBundleAttestationStepProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const merged = mergeProfiles(bgProfile, pspProfile)

  const [consentDateIso, setConsentDateIso] = useState(defaultConsentDateIso)
  const [typedSignature, setTypedSignature] = useState('')
  const [printFirstName, setPrintFirstName] = useState(() => merged.firstName?.trim() ?? '')
  const [printLastName, setPrintLastName] = useState(() => merged.lastName?.trim() ?? '')
  const [ssn, setSsn] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cardClass = isDark
    ? 'rounded-2xl border border-gray-700 bg-gray-900/80 shadow-lg'
    : 'rounded-2xl border border-gray-200 bg-white shadow-sm'

  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'
  const inputClass = isDark
    ? 'w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500'
    : 'w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500'

  const handleSubmit = async () => {
    setError(null)

    if (!pspConsentId) {
      setError('Consent record is missing. Go back, complete the FMCSA PSP step again, then return here.')
      return
    }
    if (!consentDateIso.trim()) {
      setError('Choose the date you are giving this consent.')
      return
    }
    if (!typedSignature.trim()) {
      setError('Type your signature as shown on the form.')
      return
    }
    if (!printFirstName.trim() || !printLastName.trim()) {
      setError('Print first name and print last name are required.')
      return
    }
    if (!isValidSsn(normalizeSsnDigits(ssn))) {
      setError('Enter your full 9-digit Social Security Number so the vendor can run the PSP + MVR bundle.')
      return
    }

    const firstName = merged.firstName?.trim()
    const lastName = merged.lastName?.trim()
    const dob = merged.dateOfBirth?.trim()
    const dlNumber = merged.dlNumber?.trim()
    const dlState = merged.dlState?.trim()
    const address = merged.address?.trim()
    const city = merged.city?.trim()
    const state = merged.state?.trim()
    const zip = merged.zip?.trim()
    const email = merged.email?.trim()

    if (!firstName || !lastName || !dob || !dlNumber || !dlState || !address || !city || !state || !zip) {
      setError(
        'Some required fields from the previous steps are missing. Go back and complete both disclosure forms.',
      )
      return
    }

    setSubmitting(true)
    try {
      const cdlisPayload = {
        disclosureRecipientName: companyName.trim(),
        consentDateIso: consentDateIso.trim(),
        typedSignature: typedSignature.trim(),
        printFirstName: printFirstName.trim(),
        printLastName: printLastName.trim(),
        submittedAtUtc: new Date().toISOString(),
      }

      const patchRes = await fetch(`/api/psp/consent/${pspConsentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          mergeFormData: { cdlisWrittenConsent: cdlisPayload },
        }),
      })

      if (!patchRes.ok) {
        const patchData = await patchRes.json().catch(() => ({}))
        throw new Error(typeof patchData.error === 'string' ? patchData.error : 'Failed to save CDLIS consent')
      }

      const orderRes = await fetch('/api/candidate/fulfill-screening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          requestId,
          type: 'psp',
          formData: {
            firstName,
            lastName,
            middleName: merged.middleName?.trim() || '',
            dob,
            ssn: normalizeSsnDigits(ssn),
            dlNumber,
            dlState,
            address,
            city,
            state,
            zip,
            email: email || undefined,
            phone: merged.phone?.trim() || '',
          },
        }),
      })

      if (!orderRes.ok) {
        const orderData = await orderRes.json().catch(() => ({}))
        throw new Error(typeof orderData.error === 'string' ? orderData.error : 'Failed to submit order')
      }

      await onOrderComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <BackToHubButton onClick={onBack} />
        </div>

        <div
          className={`mb-4 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            isDark ? 'bg-gray-800/50 border border-gray-700 text-gray-300' : 'bg-white/70 border border-gray-200 text-gray-600'
          }`}
        >
          <span className="text-green-600 dark:text-green-400 font-medium">✓ Background Check Disclosure</span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 dark:text-green-400 font-medium">✓ FMCSA PSP Authorization</span>
          <span className="text-gray-400">→</span>
          <span className={`font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            3 {CDLIS_PAGE_BREADCRUMB}
          </span>
        </div>

        <div className={`${cardClass} p-6 sm:p-8`}>
          <div className="flex items-start gap-3 mb-6">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>{CDLIS_FORM_TITLE}</h2>
              <p className={`text-sm mt-0.5 font-medium ${isDark ? 'text-amber-200/90' : 'text-amber-900'}`}>
                {CDLIS_FORM_SUBTITLE}
              </p>
              <p className={`text-xs mt-2 ${textSecondary}`}>
                {CDLIS_PAGE_STEP_LABEL} — language follows counsel-provided CDLIS instrument; fill the blanks below.
              </p>
            </div>
          </div>

          <div className={`space-y-4 text-sm leading-relaxed mb-8 ${textSecondary}`}>
            <p>
              I, the undersigned commercial driver, hereby authorize{' '}
              <strong className={textPrimary}>Key Background Screening Inc.</strong> to request or access data
              pertaining to me within the CDLIS Central Site, to obtain all CDLIS Master Pointer Record data relating to
              me (CDLIS Data), and/or to request and obtain my driver record from the jurisdiction identified in the
              CDLIS Data in accordance with applicable state law and the Driver Privacy Protection Act. I hereby further
              authorize the disclosure of my CDLIS Data and driver record to{' '}
              <strong className={textPrimary}>{companyName.trim() || '—'}</strong>.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <span>I hereby give this consent this day of</span>
              <input
                type="date"
                className={`${inputClass} sm:max-w-[11rem]`}
                value={consentDateIso}
                onChange={(e) => setConsentDateIso(e.target.value)}
                aria-label="Consent date"
              />
              <span className="hidden sm:inline">.</span>
            </div>
          </div>

          <div className={`border-t pt-6 space-y-4 mb-8 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-bold tracking-wide ${textPrimary}`}>{CDLIS_DRIVER_SECTION_HEADING}</h3>

            <div>
              <label className={`block text-sm font-medium mb-1 ${textPrimary}`}>Signature (type full name) *</label>
              <input
                type="text"
                className={`${inputClass} font-serif`}
                style={{ fontFamily: 'cursive' }}
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={`block text-sm font-medium mb-1 ${textPrimary}`}>Print first name *</label>
                <input
                  type="text"
                  className={inputClass}
                  value={printFirstName}
                  onChange={(e) => setPrintFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${textPrimary}`}>Print last name *</label>
                <input
                  type="text"
                  className={inputClass}
                  value={printLastName}
                  onChange={(e) => setPrintLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>

          <div className={`border-t pt-6 space-y-5 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-sm ${textSecondary}`}>
              The CDLIS instrument above does not ask for your SSN. The line below is for{' '}
              <strong className={textPrimary}>Key Background Screening / Accio</strong> only — same bundle as the
              prior two-step flow — so the vendor can match your identity when ordering PSP + MVR.
            </p>

            <div>
              <label className={`block text-sm font-medium mb-1 ${textPrimary}`}>Social Security Number *</label>
              <input
                type="text"
                className={inputClass}
                value={formatSsnDisplay(ssn)}
                onChange={(e) => setSsn(normalizeSsnDigits(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="123-45-6789"
                maxLength={11}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={submitting} isLoading={submitting}>
                Submit PSP + MVR order
              </Button>
              <Button type="button" variant="secondary" onClick={onBack} disabled={submitting}>
                Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
