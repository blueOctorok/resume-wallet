'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import BackToHubButton from '@/components/ui/BackToHubButton'
import ProfileConflictModal from '@/components/ProfileConflictModal'
import SyncIndicator, { useSyncIndicator } from '@/components/SyncIndicator'
import { useTheme } from '@/contexts/ThemeContext'
import { useDotApplicationStore, useUIStore } from '@/stores'
import { profileToDotApplication } from '@/lib/profile-mapper'
import type { UnifiedDriverProfile } from '@/types/driver-profile'
import { normalizeForm3Data } from '@/lib/dot-application-hydrate'
import type {
  DotForm1FieldProvenance,
  DotForm2RowProvenance,
  Form1WithProvenance,
  Form2WithProvenance,
} from '@/lib/dot-field-provenance'
import { computeDotVerifiedCoverage } from '@/lib/dot-verified-coverage'
import DotVerifiedMeter from '@/components/driver-application/DotVerifiedMeter'
import type { AttestationBadgeSummary } from '@/lib/dot-attestation-badge'

// Dynamic imports for code-splitting
const PersonalInfoForm1 = dynamic(
  () => import('@/components/driver-application/PersonalInfoForm1').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading DOT application...' fullScreen={false} /> }
)

const PersonalInfoForm2 = dynamic(
  () => import('@/components/driver-application/PersonalInfoForm2').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading DOT application...' fullScreen={false} /> }
)

const PersonalInfoForm3 = dynamic(
  () => import('@/components/driver-application/PersonalInfoForm3').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading DOT application...' fullScreen={false} /> }
)

const ApplicationSubmitted = dynamic(
  () => import('@/components/driver-application/ApplicationSubmitted').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading application...' fullScreen={false} /> }
)

const ResumeUploadWithPrefill = dynamic(
  () => import('@/components/ResumeUploadWithPrefill'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume upload...' fullScreen={false} /> }
)

const EmploymentVerificationForm = dynamic(
  () => import('@/components/driver-application/EmploymentVerificationForm').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading verification form...' fullScreen={false} /> }
)

interface DotApplicationFlowProps {
  sessionUserId: string
  /** Raw user object for form sessionUserId prop (may differ from normalized address) */
  userAddress: string | undefined
  onBack: () => void
}

/**
 * DotApplicationFlow - Self-contained DOT application feature.
 *
 * Owns:
 * - Form 1 / 2 / 3 rendering and step navigation
 * - AI prefill (resume upload)
 * - Profile prefill (from unified driver profile)
 * - Save progress to DB
 * - Final submission
 * - ApplicationSubmitted success screen
 * - EmploymentVerificationForm
 * - ProfileConflictModal
 * - SyncIndicator
 *
 * All state comes from useDotApplicationStore and useUIStore (Zustand).
 * No external state management props needed.
 */
export default function DotApplicationFlow({
  sessionUserId,
  userAddress,
  onBack,
}: DotApplicationFlowProps) {
  const { theme } = useTheme()
  const { startSync, syncSuccess, syncError, indicatorProps } = useSyncIndicator()

  // All DOT state from Zustand
  const dotApp = useDotApplicationStore()
  const { showEmploymentVerification, setShowEmploymentVerification } = useUIStore()

  /** False until we merge server application_data (form3 / employment live in DB, not only localStorage). */
  const [dotBootstrapReady, setDotBootstrapReady] = useState(() => !sessionUserId?.trim())
  const [mvrPrefillStatus, setMvrPrefillStatus] = useState<
    'idle' | 'loading' | 'applied' | 'unavailable' | 'error'
  >('idle')
  const mvrPrefillAttemptedRef = useRef(false)
  /** Attestation summaries for honesty-tier DOT field badges (no raw JWTs). */
  const [attestationSummaries, setAttestationSummaries] = useState<AttestationBadgeSummary[]>(
    [],
  )

  // Track save reference to detect unsaved changes
  const lastSavedDataRef = useRef<{ form1: unknown; form2: unknown; form3: unknown }>({
    form1: null, form2: null, form3: null,
  })
  // Prevent re-loading profile after first load attempt (reset when wallet changes)
  const profileLoadAttemptedRef = useRef(false)
  const profileWalletRef = useRef<string | null>(null)
  if (profileWalletRef.current !== (sessionUserId ?? null)) {
    profileWalletRef.current = sessionUserId ?? null
    profileLoadAttemptedRef.current = false
  }
  // When true, loads from profile even if forms have data (navigating from Resume Builder)
  const forceProfileLoadRef = useRef(false)
  const resetInProgressRef = useRef(false)

  // -------------------------------------------------------
  // Attestation summaries for field badge honesty tiers
  // -------------------------------------------------------
  useEffect(() => {
    const w = sessionUserId?.trim()
    if (!w) {
      setAttestationSummaries([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/attestation/mine')
        if (!res.ok || cancelled) return
        const json = (await res.json()) as { attestations?: AttestationBadgeSummary[] }
        if (!cancelled) setAttestationSummaries(json.attestations ?? [])
      } catch (err) {
        console.warn('[DOT] Failed to load attestation summaries:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionUserId])

  // -------------------------------------------------------
  // Server-first hydrate — DB is source of truth for all three forms (esp. form3 / employers)
  // -------------------------------------------------------
  useEffect(() => {
    const w = sessionUserId?.trim()
    if (!w) {
      setDotBootstrapReady(true)
      return
    }
    let cancelled = false
    setDotBootstrapReady(false)
    ;(async () => {
      try {
        await new Promise((r) => setTimeout(r, 80))
        if (cancelled) return
        const res = await fetch('/api/driver-applications/save-progress', {
          headers: { 'x-wallet-address': w },
        })
        if (!res.ok || cancelled) return
        const json = (await res.json()) as {
          application?: {
            id: string
            application_data?: { form1?: unknown; form2?: unknown; form3?: unknown }
            current_step?: number
            is_complete?: boolean
          } | null
        }
        const app = json.application
        const ad = app?.application_data
        if (!app || !ad || (!ad.form1 && !ad.form2 && !ad.form3)) return

        const f3 = normalizeForm3Data(ad.form3)
        const step = Number(app.current_step) || 1
        const formStep = step >= 1 && step <= 3 ? step : 3

        useDotApplicationStore.getState().loadFromDatabase({
          applicationId: app.id,
          form1: (ad.form1 as object) ?? null,
          form2: (ad.form2 as object) ?? null,
          form3: (f3 ?? (ad.form3 as object)) ?? null,
          currentStep: formStep,
          isComplete: Boolean(app.is_complete),
        })
        lastSavedDataRef.current = {
          form1: ad.form1 ?? null,
          form2: ad.form2 ?? null,
          form3: f3 ?? ad.form3 ?? null,
        }
        useDotApplicationStore.getState().incrementFormResetKey()
      } catch (e) {
        console.warn('[DOT] Server bootstrap failed', e)
      } finally {
        if (!cancelled) setDotBootstrapReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionUserId])

  // -------------------------------------------------------
  // P3.7 — Always re-project MVR → Form 1 + Form 2 after bootstrap.
  // Late-MVR path: even if the driver already typed matching values, we
  // overwrite lock paths / MVR rows and stamp badges. Skip only when no MVR.
  // -------------------------------------------------------
  useEffect(() => {
    if (!dotBootstrapReady || !sessionUserId?.trim()) return
    if (mvrPrefillAttemptedRef.current) return

    mvrPrefillAttemptedRef.current = true
    let cancelled = false
    setMvrPrefillStatus('loading')

    ;(async () => {
      try {
        const store = useDotApplicationStore.getState()
        const res = await fetch('/api/driver/prefill-from-mvr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingForm1: store.form1Data,
            existingForm2: store.form2Data,
            existingForm3: store.form3Data,
          }),
        })
        if (cancelled) return
        if (res.status === 404) {
          setMvrPrefillStatus('unavailable')
          return
        }
        if (!res.ok) {
          setMvrPrefillStatus('error')
          return
        }
        const json = (await res.json()) as {
          form1Data?: Record<string, unknown>
          form2Data?: Record<string, unknown>
          form3Data?: Record<string, unknown>
          lockedFieldCount?: number
          mvrAccidentCount?: number
          mvrConvictionCount?: number
          verifiedEmployerCount?: number
        }
        if (!json.form1Data && !json.form2Data && !json.form3Data) {
          setMvrPrefillStatus('unavailable')
          return
        }
        if (json.form1Data) store.setForm1Data(json.form1Data)
        if (json.form2Data) store.setForm2Data(json.form2Data)
        if (json.form3Data) store.setForm3Data(json.form3Data)
        store.incrementFormResetKey()
        setMvrPrefillStatus('applied')
        console.log(
          '[DOT] Screening projection applied:',
          json.lockedFieldCount ?? 0,
          'locked fields,',
          json.mvrAccidentCount ?? 0,
          'accidents,',
          json.mvrConvictionCount ?? 0,
          'convictions,',
          json.verifiedEmployerCount ?? 0,
          'verified employers',
        )
      } catch (e) {
        if (!cancelled) {
          console.warn('[DOT] MVR prefill failed (non-fatal)', e)
          setMvrPrefillStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Once after bootstrap — always re-apply so late MVR overwrites self-entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotBootstrapReady, sessionUserId])

  // -------------------------------------------------------
  // Profile prefill — load from unified profile into forms
  // Runs when user enters DOT app without existing form data
  // -------------------------------------------------------
  useEffect(() => {
    const loadFromProfile = async () => {
      if (!dotBootstrapReady) return
      if (profileLoadAttemptedRef.current) return
      if (!sessionUserId) return

      profileLoadAttemptedRef.current = true

      // Brief delay so Zustand + server hydrate settle
      await new Promise((r) => setTimeout(r, 50))

      if (!forceProfileLoadRef.current) {
        const hasMeaningfulForm1 =
          dotApp.form1Data &&
          (dotApp.form1Data.firstName ||
            dotApp.form1Data.lastName ||
            dotApp.form1Data.cdlNumber ||
            (dotApp.form1Data.currentLicenses?.length > 0 &&
              dotApp.form1Data.currentLicenses[0]?.licenseNumber))
        const hasMeaningfulForm3 =
          dotApp.form3Data &&
          dotApp.form3Data.employers?.length > 0 &&
          dotApp.form3Data.employers[0]?.name

        if (hasMeaningfulForm1 || hasMeaningfulForm3) return
      }

      if (resetInProgressRef.current) {
        profileLoadAttemptedRef.current = false
        return
      }

      forceProfileLoadRef.current = false

      try {
        const response = await fetch('/api/driver/profile')
        if (!response.ok) return

        const { profile } = await response.json()
        if (!profile) return

        const hasProfileData =
          profile.firstName || profile.lastName || profile.cdlNumber || profile.employmentHistory?.length > 0
        if (!hasProfileData) return

        // Only prefill from resume-sourced profile data
        const profileSource = profile.lastUpdatedFrom || 'unknown'
        const isFromResume =
          profileSource === 'resume_builder' ||
          profileSource === 'uploaded_resume' ||
          profileSource === 'resume'
        if (!isFromResume) return

        const dotData = profileToDotApplication(profile as UnifiedDriverProfile)

        if (dotData.personalInfo || dotData.cdlInfo) {
          dotApp.setForm1Data({
            firstName: dotData.personalInfo?.firstName || '',
            middleName: dotData.personalInfo?.middleName || '',
            lastName: dotData.personalInfo?.lastName || '',
            phone: dotData.personalInfo?.phone || '',
            email: dotData.personalInfo?.email || '',
            dateOfBirth: dotData.personalInfo?.dateOfBirth || '',
            currentMailing: {
              street: dotData.personalInfo?.address || '',
              city: dotData.personalInfo?.city || '',
              state: dotData.personalInfo?.state || '',
              zipCode: dotData.personalInfo?.zipCode || '',
              yearsAtAddress: '',
            },
            currentLicenses: dotData.cdlInfo
              ? [{
                  state: dotData.cdlInfo.cdlState || '',
                  licenseNumber: dotData.cdlInfo.cdlNumber || '',
                  typeClass: dotData.cdlInfo.cdlClass || '',
                  endorsements: dotData.cdlInfo.endorsements?.join(', ') || '',
                  expirationDate: dotData.cdlInfo.cdlExpiration || '',
                }]
              : [],
          })
        }

        if (dotData.employmentHistory?.length > 0) {
          dotApp.setForm3Data((prev: Record<string, unknown>) => ({
            ...prev,
            employers: dotData.employmentHistory.map((emp: Record<string, unknown>) => ({
              name: emp.company || emp.companyName || '',
              phone: emp.supervisorPhone || '',
              email: emp.supervisorEmail || '',
              address: (emp.location as string) || '',
              positionHeld: emp.position || '',
              fromDate: emp.startDate || '',
              toDate: emp.endDate || 'Present',
              reasonForLeaving: emp.reasonForLeaving || '',
              salary: '',
              gapsInEmployment: '',
              subjectToFMCSR: 'no',
              safetySensitiveFunction: 'no',
              isUnemployment: false,
            })),
          }))
        }

        if (dotData.drivingRecord?.violations?.length > 0 || dotData.drivingRecord?.accidents?.length > 0) {
          dotApp.setForm2Data((prev: Record<string, unknown>) => ({
            ...prev,
            accidents: dotData.drivingRecord.accidents?.map((acc: Record<string, unknown>) => ({
              date: acc.date || '', nature: acc.description || '',
              fatalities: acc.fatalities || '', injuries: acc.injuries || '', atFault: '',
            })) || [],
            hasNoAccidents: !dotData.drivingRecord.accidents?.length,
            convictions: dotData.drivingRecord.violations?.map((viol: Record<string, unknown>) => ({
              dateConvicted: viol.date || '', violation: viol.violation || '',
              stateOfViolation: viol.location || '', penalty: viol.fine || '',
            })) || [],
            hasNoConvictions: !dotData.drivingRecord.violations?.length,
          }))
        }

        dotApp.setProfileDataLoaded(true)
        dotApp.setProfileSource(profile.lastUpdatedFrom || 'profile')
        dotApp.setShowPrefillUpload(false)
      } catch (err) {
        console.error('❌ [DOT] Failed to load from profile:', err)
      }
    }

    loadFromProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, dotBootstrapReady])

  // -------------------------------------------------------
  // Dirty state tracking for unsaved-changes warning
  // -------------------------------------------------------
  useEffect(() => {
    if (resetInProgressRef.current) return
    const hasData = dotApp.form1Data || dotApp.form2Data || dotApp.form3Data
    if (!hasData) {
      dotApp.setHasUnsavedChanges(false)
      return
    }

    const isDifferent =
      JSON.stringify(dotApp.form1Data) !== JSON.stringify(lastSavedDataRef.current.form1) ||
      JSON.stringify(dotApp.form2Data) !== JSON.stringify(lastSavedDataRef.current.form2) ||
      JSON.stringify(dotApp.form3Data) !== JSON.stringify(lastSavedDataRef.current.form3)

    dotApp.setHasUnsavedChanges(isDifferent)
  }, [dotApp.form1Data, dotApp.form2Data, dotApp.form3Data])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dotApp.hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dotApp.hasUnsavedChanges])

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const saveAllFormsToProfile = useCallback(
    async (showIndicator = true) => {
      if (!sessionUserId) return
      try {
        if (showIndicator) startSync()
        const { form1ToProfile, form2ToProfile, form3ToProfile } = await import('@/lib/dot-form-mapper')
        const profileData = {
          ...(dotApp.form1Data ? form1ToProfile(dotApp.form1Data) : {}),
          ...(dotApp.form2Data ? form2ToProfile(dotApp.form2Data) : {}),
          ...(dotApp.form3Data ? form3ToProfile(dotApp.form3Data) : {}),
        }

        const profileResponse = await fetch('/api/driver/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ profileData, source: 'dot_application' }),
        })
        if (!profileResponse.ok) {
          const errorData = await profileResponse.json()
          throw new Error(errorData.error || 'Failed to save to profile')
        }

        // Save full form data to DB for cross-device persistence
        try {
          await fetch('/api/driver-applications/save-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': sessionUserId },
        body: JSON.stringify({
              form1Data: dotApp.form1Data,
              form2Data: dotApp.form2Data,
              form3Data: dotApp.form3Data,
              currentStep: dotApp.currentForm,
            }),
          })
        } catch (dbErr) {
          console.warn('⚠️ [DOT] DB save non-fatal:', dbErr)
        }

        if (showIndicator) syncSuccess()
        lastSavedDataRef.current = {
          form1: dotApp.form1Data,
          form2: dotApp.form2Data,
          form3: dotApp.form3Data,
        }
        dotApp.setHasUnsavedChanges(false)
        return true
      } catch (err) {
        console.error('❌ [DOT] Failed to save forms:', err)
        if (showIndicator) syncError()
        return false
      }
    },
    [sessionUserId, dotApp.form1Data, dotApp.form2Data, dotApp.form3Data, dotApp.currentForm, startSync, syncSuccess, syncError]
  )

  const handleFormNavigation = useCallback(
    async (formNumber: number) => {
      await saveAllFormsToProfile()
      dotApp.setCurrentForm(formNumber)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [saveAllFormsToProfile, dotApp.setCurrentForm]
  )

  const handleDriverApplicationCompleted = useCallback(async () => {
    if (dotApp.isSubmitting) return
    try {
      dotApp.setSubmissionError(null)
      dotApp.setIsSubmitting(true)

      if (!sessionUserId) {
        alert('Please sign in to submit your application.')
        dotApp.setIsSubmitting(false)
        return
      }
      if (!dotApp.form1Data || !dotApp.form2Data || !dotApp.form3Data) {
        alert('Please complete all forms before submitting.')
        dotApp.setIsSubmitting(false)
        return
      }

      const combinedData = { form1: dotApp.form1Data, form2: dotApp.form2Data, form3: dotApp.form3Data }
      const { hashJson } = await import('@/lib/hash-utils')
      const applicationHash = await hashJson(combinedData)

      const { checkDuplicateApplicationHash } = await import('@/lib/supabase-client-db')
      const dupCheck = await checkDuplicateApplicationHash(sessionUserId, applicationHash)
      if (dupCheck.exists) {
        dotApp.setSubmissionError(
          'This application has already been submitted. Please modify your data before resubmitting.'
        )
        dotApp.setCurrentForm(1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        dotApp.setIsSubmitting(false)
        return
      }

      // No IPFS — Phase 1 dropped Pinata; content hash is enough for duplicate detection.
      // Phase 3 Midnight attestations go through attestationService later, not this submit path.
      const { completeDriverApplicationClient } = await import('@/lib/supabase-client-db')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbResult = await completeDriverApplicationClient(
        sessionUserId,
        combinedData as any,
        undefined,
        applicationHash,
      )

      if (!dbResult.success) {
        dotApp.setSubmissionError('Failed to save application to database: ' + dbResult.error)
        dotApp.setIsSubmitting(false)
        return
      }

      // Sync DOT data to block tables (for career cards / talent search)
      // This is critical for the name to appear correctly in employer talent search
      try {
        const syncResponse = await fetch('/api/driver/sync-from-dot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionUserId }),
        })
        if (syncResponse.ok) {
          console.log('✅ [DOT] Profile synced from DOT application')
        } else {
          console.warn('⚠️ [DOT] sync-from-dot returned error (non-fatal)')
        }
      } catch (err) {
        console.warn('⚠️ [DOT] Profile sync error (non-fatal):', err)
      }

      // Clear in-progress DOT state from profile (fire-and-forget)
      fetch('/api/driver/profile/clear-dot-progress', {
        method: 'POST',
      }).catch((err) => console.warn('⚠️ [DOT] Clear progress non-fatal:', err))

      dotApp.completeApplication()
      setShowEmploymentVerification(false)
      const { syncDriverHubFromApi } = await import('@/lib/sync-driver-hub-store')
      void syncDriverHubFromApi(sessionUserId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit application'
      console.error('❌ [DOT] Submission failed:', err)
      dotApp.setSubmissionError(message)
    } finally {
      dotApp.setIsSubmitting(false)
    }
  }, [
    sessionUserId,
    dotApp.form1Data, dotApp.form2Data, dotApp.form3Data,
    dotApp.isSubmitting, dotApp.setIsSubmitting, dotApp.setSubmissionError,
    dotApp.setCurrentForm, dotApp.completeApplication,
    setShowEmploymentVerification,
  ])

  const handlePrefillSuccess = useCallback(
    async (prefillData: {
      form1Data?: unknown; form2Data?: unknown; form3Data?: unknown; stats?: unknown
    }) => {
      if (prefillData.form1Data) dotApp.setForm1Data(prefillData.form1Data)
      if (prefillData.form2Data) dotApp.setForm2Data(prefillData.form2Data)
      if (prefillData.form3Data) dotApp.setForm3Data(prefillData.form3Data)

      // Fire-and-forget profile sync
      if (sessionUserId) {
        try {
          const { form1ToProfile, form2ToProfile, form3ToProfile } = await import('@/lib/dot-form-mapper')
          const profileData = {
            ...(prefillData.form1Data ? form1ToProfile(prefillData.form1Data) : {}),
            ...(prefillData.form2Data ? form2ToProfile(prefillData.form2Data) : {}),
            ...(prefillData.form3Data ? form3ToProfile(prefillData.form3Data) : {}),
          }
          fetch('/api/driver/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ profileData, source: 'dot_prefill' }),
          }).catch((err) => console.warn('⚠️ [DOT] Prefill profile sync non-fatal:', err))
        } catch (err) {
          console.warn('⚠️ [DOT] Prefill profile sync error (non-fatal):', err)
        }
      }

      dotApp.setHasPrefilled(true)
      dotApp.setShowPrefillUpload(false)
      dotApp.setSubmissionError(null)
      dotApp.setCurrentForm(1)
      dotApp.incrementFormResetKey()
    },
    [sessionUserId]
  )

  const handleNavigateBack = useCallback(() => {
    if (dotApp.hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes in your DOT application. Are you sure you want to leave?\n\nYour changes will be lost.'
      )
      if (!confirmed) return
    }
    dotApp.setHasUnsavedChanges(false)
    onBack()
  }, [dotApp.hasUnsavedChanges, onBack])

  // Resume: live DOT packet on the career card (no second `resumes` row on submit).
  // Legacy auto-create via /api/resumes/create was removed — it duplicated the projection.

  // -------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------
  const renderSubmissionLoading = () => (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        isDarkTheme(theme) ? 'bg-gray-800/50 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        isDarkTheme(theme) ? 'border-indigo-500' : 'border-indigo-600'
      }`}
    >
      <div className='text-center py-12'>
        <div className='flex justify-center mb-4'>
          <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500' />
        </div>
        <h1 className={`text-3xl font-bold mb-4 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
          Saving Application...
        </h1>
        <p className={`text-lg mb-6 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}`}>
          Your driver application is being saved to your profile. This will only take a moment.
        </p>
        <div
          className={`inline-block px-6 py-2 rounded-full text-sm font-medium ${
            isDarkTheme(theme) ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
          }`}
        >
          Please wait...
        </div>
      </div>
    </div>
  )

  const renderFormStepTabs = () => {
    if (dotApp.isApplicationCompleted || showEmploymentVerification) return null
    const steps = [
      { id: 1, label: 'Form 1', sublabel: 'Personal Info' },
      { id: 2, label: 'Form 2', sublabel: 'Driving & Records' },
      { id: 3, label: 'Form 3', sublabel: 'Employment & Signature' },
    ]
    return (
      <div className='flex justify-center mb-8 px-4'>
        <div className='flex space-x-4'>
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => handleFormNavigation(step.id)}
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                dotApp.currentForm === step.id
                  ? 'bg-teal-600 text-white shadow-lg'
                  : isDarkTheme(theme)
                    ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
              }`}
            >
              <div className='text-center'>
                <div className='font-bold text-base'>{step.label}</div>
                <div className='text-sm opacity-90'>{step.sublabel}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderFormContent = () => {
    if (dotApp.isSubmitting) return renderSubmissionLoading()

    if (dotApp.isApplicationCompleted && !showEmploymentVerification) {
      return (
        <ApplicationSubmitted
          onNavigateToDashboard={() => {
            // Navigate off `dotapp` first. Clearing `isApplicationCompleted` while
            // this flow is still mounted remounts Form 3 for a frame — and because
            // UI store + DOT store updates aren't always batched together, that
            // flash has triggered "Rendered more hooks than during the previous render".
            onBack()
            queueMicrotask(() => {
              const store = useDotApplicationStore.getState()
              store.setHasUnsavedChanges(false)
              store.setIsApplicationCompleted(false)
            })
          }}
          blockchainData={dotApp.blockchainData}
        />
      )
    }

    if (dotApp.isApplicationCompleted && showEmploymentVerification) {
      return (
        <EmploymentVerificationForm
          userAddress={userAddress}
          onComplete={() => {
            setShowEmploymentVerification(false)
            onBack()
            queueMicrotask(() => {
              useDotApplicationStore.getState().setIsApplicationCompleted(false)
            })
          }}
        />
      )
    }

    // Note: key must be passed directly to JSX, not through spread
    const formKey = `form-${dotApp.formResetKey}`
    const form1Provenance =
      (dotApp.form1Data as { _fieldProvenance?: DotForm1FieldProvenance } | null)
        ?._fieldProvenance ?? null
    const form2RowProvenance =
      (dotApp.form2Data as { _rowProvenance?: DotForm2RowProvenance } | null)
        ?._rowProvenance ?? null
    const formProps = {
      onNavigateToForm: handleFormNavigation,
      sessionUserId: userAddress,
      onSaveProgress: saveAllFormsToProfile,
    }

    switch (dotApp.currentForm) {
      case 1:
        return (
          <PersonalInfoForm1
            key={formKey}
            {...formProps}
            onDataChange={dotApp.setForm1Data}
            initialData={dotApp.form1Data}
            fieldProvenance={form1Provenance}
            attestations={attestationSummaries}
          />
        )
      case 2:
        return (
          <PersonalInfoForm2
            key={formKey}
            {...formProps}
            onDataChange={dotApp.setForm2Data}
            initialData={dotApp.form2Data}
            rowProvenance={form2RowProvenance}
            attestations={attestationSummaries}
          />
        )
      case 3:
        return (
          <PersonalInfoForm3
            key={formKey}
            {...formProps}
            onComplete={handleDriverApplicationCompleted}
            onDataChange={dotApp.setForm3Data}
            initialData={dotApp.form3Data}
            attestations={attestationSummaries}
          />
        )
      default:
        return (
          <PersonalInfoForm1
            key={formKey}
            {...formProps}
            onDataChange={dotApp.setForm1Data}
            initialData={dotApp.form1Data}
            fieldProvenance={form1Provenance}
            attestations={attestationSummaries}
          />
        )
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  if (!dotBootstrapReady) {
    return (
      <>
        <div className='max-w-4xl mx-auto mb-4'>
          <BackToHubButton onClick={handleNavigateBack} />
        </div>
        <LoadingScreen message='Loading your application…' fullScreen={false} />
      </>
    )
  }

  return (
    <>
      {/* Sync status indicator */}
      {indicatorProps.status !== 'idle' && (
        <div className='fixed top-20 left-1/2 -translate-x-1/2 z-[70]'>
          <SyncIndicator {...indicatorProps} />
        </div>
      )}

      {/* Back button */}
      <div className='max-w-4xl mx-auto mb-4'>
        <BackToHubButton onClick={handleNavigateBack} />
      </div>

      {/* Submission error */}
      {dotApp.submissionError && (
        <div
          className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border ${
            isDarkTheme(theme)
              ? 'bg-red-900/20 border-red-500/50 text-red-300'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {dotApp.submissionError}
        </div>
      )}

      {/* AI prefill upload */}
      {dotApp.showPrefillUpload && !dotApp.isApplicationCompleted && (
        <div className='mb-8'>
          <ResumeUploadWithPrefill
            onPrefillSuccess={handlePrefillSuccess}
            onPrefillError={(error) => dotApp.setSubmissionError(`AI Prefill Error: ${error}`)}
            onIpfsHashReady={() => {
              // IPFS hash storage handled by DriverShell's resumeUploadEvent
            }}
          />
          <div className='text-center mt-6'>
            <button
              onClick={() => {
                dotApp.setShowPrefillUpload(false)
                dotApp.setCurrentForm(1)
              }}
              className={`text-sm underline transition-colors ${
                isDarkTheme(theme) ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Skip AI prefill and fill manually
            </button>
          </div>
        </div>
      )}

      {/* Forms */}
      {!dotApp.showPrefillUpload && (
        <>
          {mvrPrefillStatus === 'applied' && (
            <div
              className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border ${
                isDarkTheme(theme)
                  ? 'bg-teal-900/20 border-teal-500/40 text-teal-200'
                  : 'bg-teal-50 border-teal-200 text-teal-900'
              }`}
            >
              <p className='text-sm font-medium'>
                Screening data applied — identity, license, crashes, and inspections are
                locked with source badges.
              </p>
              <p className='mt-1 text-xs opacity-90'>
                Fields from your MVR/PSP overwrite what you typed (even if the values match)
                and show a verified badge. You can still add extra accident or conviction
                disclosures the reports do not list.
              </p>
            </div>
          )}
          {!dotApp.isApplicationCompleted && (
            <div className='max-w-4xl mx-auto mb-6'>
              <DotVerifiedMeter
                coverage={computeDotVerifiedCoverage(
                  dotApp.form1Data as Form1WithProvenance | null,
                  dotApp.form2Data as Form2WithProvenance | null,
                  dotApp.form3Data as Record<string, unknown> | null,
                )}
                isDark={isDarkTheme(theme)}
              />
            </div>
          )}
          {dotApp.hasPrefilled && !dotApp.isApplicationCompleted && (
            <div
              className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border flex items-center justify-between ${
                isDarkTheme(theme)
                  ? 'bg-green-900/20 border-green-500/50 text-green-300'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}
            >
              <span>✨ Forms prefilled with AI! Review and complete any missing fields.</span>
              <button
                onClick={() => dotApp.setShowPrefillUpload(true)}
                className={`text-xs underline ml-4 ${
                  isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
                }`}
              >
                Upload different resume
              </button>
            </div>
          )}
          {renderFormStepTabs()}
          {renderFormContent()}
        </>
      )}

      {/* Profile conflict modal */}
      <ProfileConflictModal
        isOpen={dotApp.showProfileConflictModal}
        conflict={dotApp.profileConflict}
        userAddress={sessionUserId ?? null}
        onKeepExisting={() => {
          dotApp.setShowProfileConflictModal(false)
          dotApp.setProfileConflict(null)
          dotApp.setHasPrefilled(true)
          dotApp.setShowPrefillUpload(false)
        }}
        onReplaceWithNew={() => {
          dotApp.setShowProfileConflictModal(false)
          dotApp.setProfileConflict(null)
          dotApp.setHasPrefilled(true)
          dotApp.setShowPrefillUpload(false)
        }}
      />
    </>
  )
}

// Export for use in action handlers that need to prefill forms
// page.tsx calls dotAppStore methods directly instead of going through this component
