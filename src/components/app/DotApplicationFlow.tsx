'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft } from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import ProfileConflictModal from '@/components/ProfileConflictModal'
import SyncIndicator, { useSyncIndicator } from '@/components/SyncIndicator'
import { useTheme } from '@/contexts/ThemeContext'
import { useDotApplicationStore, useUIStore, useDriverHubStore } from '@/stores'
import {
  profileToDotApplication,
  profileToResumeBuilder,
} from '@/lib/profile-mapper'
import type { UnifiedDriverProfile } from '@/types/driver-profile'

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
  walletAddress: string
  /** Raw user object for form walletAddress prop (may differ from normalized address) */
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
  walletAddress,
  userAddress,
  onBack,
}: DotApplicationFlowProps) {
  const { theme } = useTheme()
  const { startSync, syncSuccess, syncError, indicatorProps } = useSyncIndicator()

  // All DOT state from Zustand
  const dotApp = useDotApplicationStore()
  const { showEmploymentVerification, setShowEmploymentVerification } = useUIStore()

  // Resume auto-creation state
  // 'idle' | 'creating' | 'created' | 'skipped' (already had a resume) | 'failed'
  const [resumeAutoCreateStatus, setResumeAutoCreateStatus] = useState<
    'idle' | 'creating' | 'created' | 'skipped' | 'failed'
  >('idle')
  const hubStore = useDriverHubStore()

  // Track save reference to detect unsaved changes
  const lastSavedDataRef = useRef<{ form1: unknown; form2: unknown; form3: unknown }>({
    form1: null, form2: null, form3: null,
  })
  // Prevent re-loading profile after first load attempt  
  const profileLoadAttemptedRef = useRef(false)
  // When true, loads from profile even if forms have data (navigating from Resume Builder)
  const forceProfileLoadRef = useRef(false)
  const resetInProgressRef = useRef(false)
  const [profileLoadTrigger, setProfileLoadTrigger] = [
    dotApp.applicationId, // repurpose as trigger key — actually use local state
    // NOTE: we use a dedicated trigger counter instead
    () => {},
  ]

  // -------------------------------------------------------
  // Profile prefill — load from unified profile into forms
  // Runs when user enters DOT app without existing form data
  // -------------------------------------------------------
  useEffect(() => {
    const loadFromProfile = async () => {
      if (profileLoadAttemptedRef.current) return
      if (!walletAddress) return

      profileLoadAttemptedRef.current = true

      // Wait for localStorage hydration
      await new Promise((r) => setTimeout(r, 100))

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
        const response = await fetch('/api/driver/profile', {
          headers: { 'x-wallet-address': walletAddress },
        })
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
  }, [walletAddress])

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
      if (!walletAddress) return
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
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
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
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
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
    [walletAddress, dotApp.form1Data, dotApp.form2Data, dotApp.form3Data, dotApp.currentForm, startSync, syncSuccess, syncError]
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

      if (!walletAddress) {
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
      const dupCheck = await checkDuplicateApplicationHash(walletAddress, applicationHash)
      if (dupCheck.exists) {
        dotApp.setSubmissionError(
          'This application has already been submitted. Please modify your data before resubmitting.'
        )
        dotApp.setCurrentForm(1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        dotApp.setIsSubmitting(false)
        return
      }

      const ipfsHash = 'placeholder_ipfs_hash_' + Date.now()
      const { completeDriverApplicationClient } = await import('@/lib/supabase-client-db')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbResult = await completeDriverApplicationClient(walletAddress, combinedData as any, ipfsHash, applicationHash)

      if (!dbResult.success) {
        dotApp.setSubmissionError('Failed to save application to database: ' + dbResult.error)
        dotApp.setIsSubmitting(false)
        return
      }

      // Sync DOT data to driver_profiles (for career cards / talent search)
      // This is critical for the name to appear correctly in employer talent search
      try {
        const syncResponse = await fetch('/api/driver/sync-from-dot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
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
        headers: { 'x-wallet-address': walletAddress },
      }).catch((err) => console.warn('⚠️ [DOT] Clear progress non-fatal:', err))

      dotApp.completeApplication()
      setShowEmploymentVerification(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit application'
      console.error('❌ [DOT] Submission failed:', err)
      dotApp.setSubmissionError(message)
    } finally {
      dotApp.setIsSubmitting(false)
    }
  }, [
    walletAddress,
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
      if (walletAddress) {
        try {
          const { form1ToProfile, form2ToProfile, form3ToProfile } = await import('@/lib/dot-form-mapper')
          const profileData = {
            ...(prefillData.form1Data ? form1ToProfile(prefillData.form1Data) : {}),
            ...(prefillData.form2Data ? form2ToProfile(prefillData.form2Data) : {}),
            ...(prefillData.form3Data ? form3ToProfile(prefillData.form3Data) : {}),
          }
          fetch('/api/driver/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
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
    [walletAddress]
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

  // -------------------------------------------------------
  // Resume auto-creation (when DOT app completes with no resume on file)
  // Many drivers don't have resumes - we silently create one from their DOT data
  // so it's already waiting for them in the hub when they navigate back.
  //
  // AbortController pattern: React 18 Strict Mode double-fires effects. An abort
  // signal is passed to all fetches so the first run's in-flight requests are
  // cancelled when the effect re-runs, preventing duplicate resumes.
  // -------------------------------------------------------
  useEffect(() => {
    if (!dotApp.isApplicationCompleted || !walletAddress) return

    const controller = new AbortController()
    const { signal } = controller

    const autoCreateResume = async () => {
      // Step 1: check whether the driver already has a resume
      let hasResumes = false
      try {
        const res = await fetch('/api/resumes', {
          headers: { 'x-wallet-address': walletAddress },
          signal,
        })
        if (res.ok) {
          const resumes = await res.json()
          hasResumes = Array.isArray(resumes) && resumes.length > 0
        }
      } catch (err) {
        if (signal.aborted) return
        console.warn('⚠️ [DOT] Failed to check for resumes:', err)
        return
      }

      if (signal.aborted) return

      if (hasResumes) {
        setResumeAutoCreateStatus('skipped')
        return
      }

      // Step 2: auto-create a resume from the driver profile
      setResumeAutoCreateStatus('creating')
      try {
        const profileRes = await fetch('/api/driver/profile', {
          headers: { 'x-wallet-address': walletAddress },
          signal,
        })
        if (!profileRes.ok) throw new Error('Failed to fetch profile')

        const { profile } = await profileRes.json()
        if (!profile) throw new Error('No profile data found')

        if (signal.aborted) return

        const resumeData = profileToResumeBuilder(profile as UnifiedDriverProfile)

        const structuredData = {
          personalInfo: resumeData.personalInfo,
          cdlInfo: resumeData.cdlInfo,
          employments: resumeData.employments,
          educations: resumeData.educations,
          skills: resumeData.skills,
          references: resumeData.references,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          autoGenerated: true,
          source: 'dot_application',
        }

        const firstName = resumeData.personalInfo?.firstName ?? ''
        const lastName = resumeData.personalInfo?.lastName ?? ''
        const title = [firstName, lastName].filter(Boolean).join(' ')

        const createRes = await fetch('/api/resumes/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify({
            title: title ? `${title} - Resume` : 'My Resume',
            structuredData,
            resumeType: 'built',
          }),
          signal,
        })

        if (signal.aborted) return

        if (!createRes.ok) {
          const err = await createRes.json()
          throw new Error(err.error || 'Failed to create resume')
        }

        const { resume } = await createRes.json()

        console.log('✅ [DOT] Resume auto-created from DOT application data')
        setResumeAutoCreateStatus('created')

        // Update hub store immediately so the resume appears when driver navigates back
        if (resume) {
          hubStore.addResume(resume)
        }
        hubStore.setHasResume(true)
      } catch (err) {
        if (signal.aborted) return
        console.error('❌ [DOT] Failed to auto-create resume:', err)
        setResumeAutoCreateStatus('failed')
      }
    }

    autoCreateResume()

    // Cancel all in-flight fetches if this effect re-runs (Strict Mode double-invoke)
    return () => controller.abort()
  }, [dotApp.isApplicationCompleted, walletAddress])

  // -------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------
  const renderSubmissionLoading = () => (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark' ? 'bg-gray-800/50 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'
      }`}
    >
      <div className='text-center py-12'>
        <div className='flex justify-center mb-4'>
          <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500' />
        </div>
        <h1 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Saving Application...
        </h1>
        <p className={`text-lg mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Your driver application is being saved to your profile. This will only take a moment.
        </p>
        <div
          className={`inline-block px-6 py-2 rounded-full text-sm font-medium ${
            theme === 'dark' ? 'bg-brand-mint/20 text-brand-mint' : 'bg-brand-sage/20 text-brand-sage'
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
                  ? theme === 'dark'
                    ? 'bg-brand-mint text-white shadow-lg'
                    : 'bg-brand-sage text-white shadow-lg'
                  : theme === 'dark'
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
          onNavigateToSafetyForm={() => setShowEmploymentVerification(true)}
          onNavigateToDashboard={() => {
            dotApp.setHasUnsavedChanges(false)
            dotApp.setIsApplicationCompleted(false)
            onBack()
          }}
          blockchainData={dotApp.blockchainData}
          resumeAutoCreateStatus={resumeAutoCreateStatus}
        />
      )
    }

    if (dotApp.isApplicationCompleted && showEmploymentVerification) {
      return (
        <EmploymentVerificationForm
          userAddress={userAddress}
          onComplete={() => {
            setShowEmploymentVerification(false)
            dotApp.setIsApplicationCompleted(false)
            onBack()
          }}
        />
      )
    }

    // Note: key must be passed directly to JSX, not through spread
    const formKey = `form-${dotApp.formResetKey}`
    const formProps = {
      onNavigateToForm: handleFormNavigation,
      walletAddress: userAddress,
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
          />
        )
      case 2:
        return (
          <PersonalInfoForm2
            key={formKey}
            {...formProps}
            onDataChange={dotApp.setForm2Data}
            initialData={dotApp.form2Data}
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
          />
        )
      default:
        return (
          <PersonalInfoForm1
            key={formKey}
            {...formProps}
            onDataChange={dotApp.setForm1Data}
            initialData={dotApp.form1Data}
          />
        )
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
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
        <button
          onClick={handleNavigateBack}
          className='inline-flex items-center gap-2 px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer'
        >
          <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
          Back
        </button>
      </div>

      {/* Submission error */}
      {dotApp.submissionError && (
        <div
          className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border ${
            theme === 'dark'
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
                theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
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
          {dotApp.hasPrefilled && !dotApp.isApplicationCompleted && (
            <div
              className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border flex items-center justify-between ${
                theme === 'dark'
                  ? 'bg-green-900/20 border-green-500/50 text-green-300'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}
            >
              <span>✨ Forms prefilled with AI! Review and complete any missing fields.</span>
              <button
                onClick={() => dotApp.setShowPrefillUpload(true)}
                className={`text-xs underline ml-4 ${
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
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
        userAddress={walletAddress ?? null}
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
