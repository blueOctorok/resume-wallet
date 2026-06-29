'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import Button from '@/components/ui/Button'
import DriverScreeningOwnershipAcknowledgment from '@/components/screening/DriverScreeningOwnershipAcknowledgment'
import { saveConsentAndPlaceDriverOwnedOrders } from '@/lib/place-driver-owned-screening-orders-client'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import {
  CDLIS_DRIVER_SECTION_HEADING,
  CDLIS_FORM_SUBTITLE,
  CDLIS_FORM_TITLE,
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

/** Deferred consent payload from BackgroundCheckDisclosure (step 1). */
export interface DeferredBgConsentData {
  signedName: string
  formData: Record<string, string>
}

/** Deferred consent payload from PspDisclosureForm (step 2). */
export interface DeferredPspConsentData {
  signedName: string
  formData: Record<string, string>
}

export interface EmployerPspMvrBundleAttestationStepProps {
  userAddress: string
  requestId: string
  companyName: string
  bgProfile: Record<string, string> | null
  pspProfile: Record<string, string> | null
  /** Step 1 deferred consent payload — POSTed here during batch submit. */
  deferredBgConsent: DeferredBgConsentData | null
  /** Step 2 deferred consent payload — POSTed here during batch submit. */
  deferredPspConsent: DeferredPspConsentData | null
  onPrevious: () => void
  onOrderComplete: () => void | Promise<void>
  /**
   * `accio-bundle` (default): legacy POST bg + psp + PATCH CDLIS + fulfill-screening.
   * `consent-bundle-only`: one POST to /api/candidate/screening-consent — no vendor order.
   * `consent-then-driver-orders`: save consent bundle, then driver-owned MVR + PSP (P3.4-C).
   */
  submitBehavior?: 'accio-bundle' | 'consent-bundle-only' | 'consent-then-driver-orders'
}

/**
 * Step 3 of the employer-requested PSP + MVR bundle: **CDLIS written consent**
 * (`docs/employer-screenings/cdlis-written-consent.md`), then vendor identity (SSN).
 *
 * On submit: either batch consent + Accio (`accio-bundle`) or consent-only bundle
 * (`consent-bundle-only`) for the driver-screening-consent block.
 */
export default function EmployerPspMvrBundleAttestationStep({
  userAddress,
  requestId,
  companyName,
  bgProfile,
  pspProfile,
  deferredBgConsent,
  deferredPspConsent,
  onPrevious,
  onOrderComplete,
  submitBehavior = 'accio-bundle',
}: EmployerPspMvrBundleAttestationStepProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const merged = mergeProfiles(bgProfile, pspProfile)

  const [consentDateIso, setConsentDateIso] = useState(defaultConsentDateIso)
  const [typedSignature, setTypedSignature] = useState('')
  const [printFirstName, setPrintFirstName] = useState(() => merged.firstName?.trim() ?? '')
  const [printLastName, setPrintLastName] = useState(() => merged.lastName?.trim() ?? '')
  // Pre-fill from step 2 (FMCSA form) if it captured SSN — avoids double-entry.
  const [ssn, setSsn] = useState(() => normalizeSsnDigits(merged.ssn ?? ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driverOwnershipAcknowledged, setDriverOwnershipAcknowledged] = useState(false)

  const usesDriverOwnedFlow = submitBehavior === 'consent-then-driver-orders'

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

    if (!deferredBgConsent || !deferredPspConsent) {
      setError('Prior consent data is missing. Go back and complete the earlier steps.')
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
    if (usesDriverOwnedFlow && !driverOwnershipAcknowledged) {
      setError('Check the box confirming you understand you are ordering these reports for your Storm file.')
      return
    }

    if (!isValidSsn(normalizeSsnDigits(ssn))) {
      setError(
        submitBehavior === 'consent-bundle-only'
          ? 'Enter your full 9-digit Social Security Number so your identity can be verified when your employer places a screening order.'
          : usesDriverOwnedFlow
            ? 'Enter your full 9-digit Social Security Number so the vendor can run your MVR and PSP orders.'
            : 'Enter your full 9-digit Social Security Number so the vendor can run the PSP + MVR bundle.',
      )
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
      const fullDigits = normalizeSsnDigits(ssn)
      const consentFormData = {
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        middleName: merged.middleName?.trim() || '',
        dob: dob ?? '',
        dateOfBirth: dob ?? '',
        ssn: fullDigits,
        dlNumber: dlNumber ?? '',
        dlState: dlState ?? '',
        address: address ?? '',
        city: city ?? '',
        state: state ?? '',
        zip: zip ?? '',
        email: email ?? '',
        phone: merged.phone?.trim() || '',
      }
      const orderFormData = {
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        middleName: merged.middleName?.trim() || '',
        dob: dob ?? '',
        ssn: fullDigits,
        dlNumber: dlNumber ?? '',
        dlState: dlState ?? '',
        address: address ?? '',
        city: city ?? '',
        state: state ?? '',
        zip: zip ?? '',
        email: email || undefined,
        phone: merged.phone?.trim() || '',
      }

      if (submitBehavior === 'consent-bundle-only' || usesDriverOwnedFlow) {
        const consentPayload = {
          requestId,
          companyName: companyName.trim(),
          deferredBgConsent,
          deferredPspConsent,
          cdlisWrittenConsent: cdlisPayload,
          formData: consentFormData,
          skipEmployerNotify: usesDriverOwnedFlow,
        }

        if (usesDriverOwnedFlow) {
          await saveConsentAndPlaceDriverOwnedOrders(consentPayload, orderFormData)
        } else {
          const res = await fetch('/api/candidate/screening-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(consentPayload),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(typeof d.error === 'string' ? d.error : 'Failed to save screening consent')
          }
        }
        await onOrderComplete()
        return
      }

      // ── 1. POST background check consent (step 1) ──────────────────────
      const bgRes = await fetch('/api/candidate/bgcheck-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          requestId,
          companyName,
          signedName: deferredBgConsent.signedName,
          formData: deferredBgConsent.formData,
        }),
      })
      if (!bgRes.ok) {
        const d = await bgRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to save background check consent')
      }

      // ── 2. POST FMCSA PSP consent (step 2) ────────────────────────────
      const pspRes = await fetch('/api/psp/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          requestId,
          companyName,
          signedName: deferredPspConsent.signedName,
          formData: deferredPspConsent.formData,
        }),
      })
      if (!pspRes.ok) {
        const d = await pspRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to save PSP consent')
      }
      const pspData = await pspRes.json()
      const pspConsentId = pspData.consentId as string

      // ── 3. PATCH CDLIS written consent onto psp_consents row ───────────
      const patchRes = await fetch(`/api/psp/consent/${pspConsentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ mergeFormData: { cdlisWrittenConsent: cdlisPayload } }),
      })
      if (!patchRes.ok) {
        const d = await patchRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to save CDLIS consent')
      }

      // ── 4. Place the Accio order ──────────────────────────────────────
      const orderRes = await fetch('/api/candidate/fulfill-screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
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
        const d = await orderRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to submit order')
      }

      await onOrderComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit order')
    } finally {
      setSubmitting(false)
    }
  }

  // No BackToHubButton or step indicator here — the parent wizard renders those.
  return (
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
            {CDLIS_PAGE_STEP_LABEL} — fill the blanks below.
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
        {usesDriverOwnedFlow && (
          <DriverScreeningOwnershipAcknowledgment
            companyName={companyName}
            checked={driverOwnershipAcknowledged}
            onCheckedChange={setDriverOwnershipAcknowledged}
            disabled={submitting}
          />
        )}

        <p className={`text-sm ${textSecondary}`}>
          The CDLIS instrument above does not ask for your SSN. The line below is for{' '}
          <strong className={textPrimary}>Key Background Screening / Accio</strong> only —{' '}
          {submitBehavior === 'consent-bundle-only'
            ? 'so your employer can run MVR or PSP later without asking you again. It is encrypted in Storm’s database.'
            : usesDriverOwnedFlow
              ? 'so the vendor can match your identity when you order your MVR and PSP. It is encrypted in Storm’s database.'
              : 'so the vendor can match your identity when ordering PSP + MVR.'}
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
          <Button type="button" variant="secondary" onClick={onPrevious} disabled={submitting}>
            Previous
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || (usesDriverOwnedFlow && !driverOwnershipAcknowledged)}
            isLoading={submitting}
          >
            {submitBehavior === 'consent-bundle-only'
              ? 'Save screening consent'
              : usesDriverOwnedFlow
                ? 'Submit consent & order MVR + PSP'
                : 'Submit PSP + MVR order'}
          </Button>
        </div>
      </div>
    </div>
  )
}
