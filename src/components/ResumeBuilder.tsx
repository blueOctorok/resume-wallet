'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Plus, 
  X, 
  Check,
  User,
  Truck,
  Briefcase,
  GraduationCap,
  Settings,
  Phone,
  FileCheck,
  FileEdit,
  Sparkles,
  RotateCcw,
  Loader2
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import { profileToResumeBuilder, resumeBuilderToProfile } from '@/lib/profile-mapper'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { UnifiedDriverProfile } from '@/types/driver-profile'

interface PersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  professionalSummary: string
}

interface CDLInfo {
  cdlNumber: string
  cdlState: string
  cdlClass: string
  endorsements: string[]
  expirationDate: string
  restrictions: string[]
}

interface Employment {
  id: string
  companyName: string
  position: string
  startDate: string
  endDate: string
  isCurrent: boolean
  location: string
  responsibilities: string[]
  equipment: string[]
  milesDriven?: string
  safetyRecord?: string
}

interface Education {
  id: string
  school: string
  degree: string
  field: string
  year: string
  certifications: string[]
}

interface Skill {
  id: string
  name: string
  category: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

interface Reference {
  id: string
  name: string
  title: string
  company: string
  phone: string
  email: string
  relationship: string
}

interface ResumeBuilderProps {
  user?: {
    address?: string
  } | null
  onBack?: () => void
  onSave?: (resumeId: string) => void
  existingResumeId?: string
}

const STEPS = [
  { id: 'personal', name: 'Personal Info', Icon: User },
  { id: 'cdl', name: 'CDL & License', Icon: Truck },
  { id: 'employment', name: 'Employment History', Icon: Briefcase },
  { id: 'education', name: 'Education & Training', Icon: GraduationCap },
  { id: 'skills', name: 'Skills & Equipment', Icon: Settings },
  { id: 'references', name: 'References', Icon: Phone },
  { id: 'review', name: 'Review & Export', Icon: FileCheck },
]

// CDL endorsement options (common ones) - available to all step components
const ENDORSEMENT_OPTIONS = [
  'H - Hazardous Materials',
  'N - Tank Vehicle',
  'P - Passenger',
  'S - School Bus',
  'T - Double/Triple Trailers',
  'X - Tank & Hazmat',
]

const CDL_CLASS_OPTIONS = ['Class A', 'Class B', 'Class C']

const SKILL_CATEGORIES: { value: 'equipment' | 'route' | 'technology' | 'safety' | 'other'; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'route', label: 'Route Type' },
  { value: 'technology', label: 'Technology' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
]

export default function ResumeBuilder({
  user,
  onBack,
  onSave,
  existingResumeId,
}: ResumeBuilderProps) {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Track resume ID internally - starts with prop value, updated after first save
  // This prevents duplicate resumes when exporting/saving multiple times
  const [internalResumeId, setInternalResumeId] = useState<string | undefined>(existingResumeId)

  // Form state
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    professionalSummary: '',
  })

  const [cdlInfo, setCDLInfo] = useState<CDLInfo>({
    cdlNumber: '',
    cdlState: '',
    cdlClass: '',
    endorsements: [],
    expirationDate: '',
    restrictions: [],
  })

  const [employments, setEmployments] = useState<Employment[]>([])
  const [educations, setEducations] = useState<Education[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [references, setReferences] = useState<Reference[]>([])
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileSource, setProfileSource] = useState<string | null>(null)
  
  // Track if form has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedRef = useRef<string>('')
  
  // Track changes - compare current form data to last saved
  useEffect(() => {
    const currentData = JSON.stringify({ personalInfo, cdlInfo, employments, educations, skills, references })
    if (lastSavedRef.current && currentData !== lastSavedRef.current) {
      setHasUnsavedChanges(true)
    }
  }, [personalInfo, cdlInfo, employments, educations, skills, references])
  
  // Handler for back button with unsaved changes warning
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?\n\nYour changes will be lost.'
      )
      if (!confirmed) return
    }
    onBack?.()
  }, [hasUnsavedChanges, onBack])
  
  // Warn user before closing browser with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Fill test data function - smart fill that only fills empty fields
  const fillTestData = () => {
    // Personal Info - only fill if empty
    setPersonalInfo((prev) => ({
      firstName: prev.firstName || 'John',
      lastName: prev.lastName || 'Doe',
      email: prev.email || 'john.doe@email.com',
      phone: prev.phone || '(555) 123-4567',
      address: prev.address || '123 Main Street',
      city: prev.city || 'Columbus',
      state: prev.state || 'OH',
      zipCode: prev.zipCode || '43215',
      professionalSummary:
        prev.professionalSummary ||
        'Experienced commercial driver with 10+ years of safe driving record. Specialized in long-haul freight transportation with expertise in handling hazardous materials and oversized loads. Proven track record of on-time deliveries and excellent customer service.',
    }))

    // CDL Info - only fill if empty
    setCDLInfo((prev) => ({
      cdlNumber: prev.cdlNumber || 'DL123456789',
      cdlState: prev.cdlState || 'OH',
      cdlClass: prev.cdlClass || 'Class A',
      endorsements: prev.endorsements.length > 0 ? prev.endorsements : ['H - Hazardous Materials', 'N - Tank Vehicle', 'T - Double/Triple Trailers'],
      expirationDate: prev.expirationDate || '2026-12-31',
      restrictions: prev.restrictions.length > 0 ? prev.restrictions : [],
    }))

    // Employment - add test employment only if none exist
    if (employments.length === 0) {
      setEmployments([
        {
          id: '1',
          companyName: 'Swift Transportation',
          position: 'Commercial Driver',
          startDate: '2020-01-15',
          endDate: '2023-12-31',
          isCurrent: false,
          location: 'Columbus, OH',
          responsibilities: [
            'Long-haul freight transportation across multiple states',
            'Maintained excellent safety record with zero accidents',
            'On-time delivery performance above 98%',
            'Handled hazardous materials and oversized loads',
            'Completed daily vehicle inspections and maintenance logs',
          ],
          equipment: ['Semi-Truck', '53ft Dry Van', 'Flatbed Trailer'],
          milesDriven: '450,000',
          safetyRecord: 'Zero accidents, zero violations',
        },
        {
          id: '2',
          companyName: 'FedEx Ground',
          position: 'Package Delivery Driver',
          startDate: '2018-03-01',
          endDate: '2019-12-15',
          isCurrent: false,
          location: 'Columbus, OH',
          responsibilities: [
            'Local package delivery and pickup services',
            'Customer service and route optimization',
            'Maintained delivery vehicle in excellent condition',
          ],
          equipment: ['Delivery Van', 'Box Truck'],
        },
      ])
    }

    // Education - add test education only if none exist
    if (educations.length === 0) {
      setEducations([
        {
          id: '1',
          school: 'Ohio State CDL Training School',
          degree: 'CDL Training Certificate',
          field: 'Commercial Driving',
          year: '2018',
          certifications: ['CDL Class A', 'Hazmat Endorsement', 'Tanker Endorsement'],
        },
        {
          id: '2',
          school: 'Columbus High School',
          degree: 'High School Diploma',
          field: 'General Studies',
          year: '2010',
          certifications: [],
        },
      ])
    }

    // Skills - add test skills only if none exist
    if (skills.length === 0) {
      setSkills([
        { id: '1', name: 'Double/Triple Trailers', category: 'equipment' },
        { id: '2', name: 'Hazmat Transportation', category: 'safety' },
        { id: '3', name: 'ELD Systems', category: 'technology' },
        { id: '4', name: 'Long-Haul Routes', category: 'route' },
        { id: '5', name: 'Oversized Loads', category: 'equipment' },
        { id: '6', name: 'Defensive Driving', category: 'safety' },
        { id: '7', name: 'GPS Navigation', category: 'technology' },
        { id: '8', name: 'Regional Routes', category: 'route' },
      ])
    }

    // References - add test references only if none exist
    if (references.length === 0) {
      setReferences([
        {
          id: '1',
          name: 'Mike Johnson',
          title: 'Fleet Manager',
          company: 'Swift Transportation',
          phone: '(555) 234-5678',
          email: 'mike.johnson@swift.com',
          relationship: 'Former Supervisor',
        },
        {
          id: '2',
          name: 'Sarah Davis',
          title: 'Operations Manager',
          company: 'FedEx Ground',
          phone: '(555) 345-6789',
          email: 'sarah.davis@fedex.com',
          relationship: 'Former Supervisor',
        },
      ])
    }
  }

  // Clear all form data (prefill or manual) and start over
  const clearResume = () => {
    if (typeof window !== 'undefined' && !window.confirm('Clear all form data and start over? Your form will be reset to empty.')) return
    const emptyPersonal: PersonalInfo = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      professionalSummary: '',
    }
    const emptyCDL: CDLInfo = {
      cdlNumber: '',
      cdlState: '',
      cdlClass: '',
      endorsements: [],
      expirationDate: '',
      restrictions: [],
    }
    setPersonalInfo(emptyPersonal)
    setCDLInfo(emptyCDL)
    setEmployments([])
    setEducations([])
    setSkills([])
    setReferences([])
    setProfileLoaded(false)
    setProfileSource(null)
    setCurrentStep(0)
    setSaveError(null)
    setSaveSuccess(false)
  }

  const hasFormData =
    !!personalInfo.firstName ||
    !!personalInfo.lastName ||
    !!personalInfo.email ||
    !!personalInfo.phone ||
    cdlInfo.cdlNumber ||
    employments.length > 0 ||
    educations.length > 0 ||
    skills.length > 0 ||
    references.length > 0

  // Load data on mount.
  // Priority: existing resume's structured_data > unified profile > empty form.
  // When editing (existingResumeId is set), we ALWAYS load from that specific
  // resume — the profile is a derived copy and may be incomplete or stale.
  // Profile prefill only runs when creating a brand new resume.
  useEffect(() => {
    const loadData = async () => {
      if (!user?.address) return

      try {
        // ── Editing an existing resume ──────────────────────────────────────
        if (existingResumeId) {
          console.log('📄 [RESUME BUILDER] Loading existing resume:', existingResumeId)
          const response = await fetch(`/api/resumes/${existingResumeId}`, {
            headers: { 'x-wallet-address': user.address },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.structured_data) {
              const sd = data.structured_data
              if (sd.personalInfo) setPersonalInfo(sd.personalInfo)
              if (sd.cdlInfo) setCDLInfo(sd.cdlInfo)
              if (sd.employments) setEmployments(sd.employments)
              if (sd.educations) setEducations(sd.educations)
              if (sd.skills) setSkills(sd.skills)
              if (sd.references) setReferences(sd.references)
              setProfileLoaded(true)
              setProfileSource('resume')
              console.log('✅ [RESUME BUILDER] Loaded from existing resume')
            }
          }
          return // Never overwrite existing resume data with profile data
        }

        // ── New resume — prefill from unified profile if available ──────────
        console.log('📦 [RESUME BUILDER] New resume — fetching profile for prefill...')
        const profileResponse = await fetch('/api/driver/profile', {
          headers: { 'x-wallet-address': user.address },
        })

        if (profileResponse.ok) {
          const { profile } = await profileResponse.json()
          const hasProfileData = profile && (
            profile.firstName || profile.lastName ||
            profile.cdlNumber || profile.employmentHistory?.length > 0
          )

          if (hasProfileData) {
            const resumeData = profileToResumeBuilder(profile as UnifiedDriverProfile)
            setPersonalInfo(resumeData.personalInfo)
            setCDLInfo(resumeData.cdlInfo)
            setEmployments(resumeData.employments)
            setEducations(resumeData.educations)
            setSkills(resumeData.skills)
            setReferences(resumeData.references)
            setProfileLoaded(true)
            setProfileSource(profile.lastUpdatedFrom || 'profile')
            console.log('✅ [RESUME BUILDER] New resume prefilled from profile')
          }
        }
      } catch (error) {
        console.error('❌ [RESUME BUILDER] Failed to load data:', error)
      }
    }

    loadData()
  }, [existingResumeId, user?.address])

  const handleSave = async () => {
    if (!user?.address) {
      setSaveError('Please connect your wallet first')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const structuredData = {
        personalInfo,
        cdlInfo,
        employments,
        educations,
        skills,
        references,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save to resumes table (use internal ID to prevent duplicates)
      const response = await fetch('/api/resumes/create', {
        method: internalResumeId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': user.address,
        },
        body: JSON.stringify({
          resumeId: internalResumeId,
          title: `${personalInfo.firstName} ${personalInfo.lastName} - Resume`,
          structuredData,
          resumeType: 'built',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save resume')
      }

      const result = await response.json()
      
      // Update internal ID so subsequent saves update instead of creating duplicates
      if (result.resumeId && !internalResumeId) {
        setInternalResumeId(result.resumeId)
      }

      // Sync to unified profile - WAIT for this to complete so DOT app can read it immediately
      // This enables bidirectional data flow: Resume Builder → Profile → DOT Application
      const profileData = resumeBuilderToProfile({
        personalInfo,
        cdlInfo,
        employments,
        educations,
        skills,
        references,
      })

      try {
        const profileResponse = await fetch('/api/driver/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': user.address,
          },
          body: JSON.stringify({
            profileData,
            source: 'resume_builder',
          }),
        })
        if (profileResponse.ok) {
          console.log('✅ [RESUME BUILDER] Profile synced - DOT app will auto-populate from this')
        } else {
          console.warn('⚠️ [RESUME BUILDER] Profile sync returned error (non-fatal)')
        }
      } catch (err) {
        console.warn('⚠️ [RESUME BUILDER] Profile sync failed (non-fatal):', err)
      }

      setSaveSuccess(true)
      onSave?.(result.resumeId)
      
      // Mark data as saved (no longer dirty)
      lastSavedRef.current = JSON.stringify({ personalInfo, cdlInfo, employments, educations, skills, references })
      setHasUnsavedChanges(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Resume save error:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save resume')
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex)
  }

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'personal':
        return <PersonalInfoStep data={personalInfo} onChange={setPersonalInfo} theme={theme} />
      case 'cdl':
        return <CDLInfoStep data={cdlInfo} onChange={setCDLInfo} theme={theme} />
      case 'employment':
        return <EmploymentStep employments={employments} onChange={setEmployments} theme={theme} />
      case 'education':
        return <EducationStep educations={educations} onChange={setEducations} theme={theme} />
      case 'skills':
        return <SkillsStep skills={skills} onChange={setSkills} theme={theme} />
      case 'references':
        return <ReferencesStep references={references} onChange={setReferences} theme={theme} />
      case 'review':
        return (
          <ReviewStep
            personalInfo={personalInfo}
            cdlInfo={cdlInfo}
            employments={employments}
            educations={educations}
            skills={skills}
            references={references}
            theme={theme}
          />
        )
      default:
        return null
    }
  }

  // Match developer resume builder layout and styling
  return (
    <div
      className={`h-full flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      {/* Header - fixed at top */}
      <div
        className={`flex-shrink-0 z-10 border-b ${
          theme === 'dark'
            ? 'bg-gray-900/95 border-gray-800'
            : 'bg-white/95 border-gray-200'
        } backdrop-blur-sm`}
      >
        <div className='max-w-4xl mx-auto px-4 py-4'>
          <div className='flex items-center justify-between flex-wrap gap-2'>
            <BackToHubButton
              onClick={handleBack}
              label={onBack ? 'Back to Hub' : 'Back'}
            />

            <div className='flex items-center gap-2 flex-wrap'>
              {profileLoaded && profileSource && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-brand-mint/10 text-brand-mint border border-brand-mint/30'
                      : 'bg-brand-mint/10 text-gray-700 border border-brand-mint/30'
                  }`}
                >
                  <Sparkles className='w-3 h-3' />
                  Prefilled from {profileSource === 'dot_application' ? 'DOT Application' : profileSource === 'uploaded_resume' ? 'uploaded resume' : profileSource === 'mvr' ? 'MVR data' : 'profile'}
                </span>
              )}
              {(saveError || saveSuccess) && (
                <span
                  className={`text-sm ${
                    saveError ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {saveError || 'Saved & synced'}
                </span>
              )}
              {hasFormData && (
                <button
                  type='button'
                  onClick={clearResume}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl font-medium transition-all ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title='Clear all form data'
                >
                  <RotateCcw className='w-4 h-4' />
                  Clear form
                </button>
              )}
              <button
                type='button'
                onClick={fillTestData}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
                title='Fill test data'
              >
                <Sparkles className='w-4 h-4' />
                Fill Test Data
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='flex items-center gap-2 px-4 py-2 bg-brand-mint text-gray-900 rounded-xl font-medium hover:bg-brand-mint/90 disabled:opacity-50'
              >
                {isSaving ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Save className='w-4 h-4' />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable form area */}
      <div className='flex-1 min-h-0 overflow-y-auto'>
        <div className='max-w-4xl mx-auto px-4 py-6'>
          {/* Step indicator - circles like developer builder */}
          <div className='flex items-center justify-between mb-8 overflow-x-auto pb-2'>
            {STEPS.map((step, idx) => {
              const Icon = step.Icon
              const isActive = idx === currentStep
              const isCompleted = idx < currentStep
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(idx)}
                  className={`flex flex-col items-center min-w-[72px] ${
                    isActive
                      ? 'text-brand-mint'
                      : isCompleted
                        ? theme === 'dark'
                          ? 'text-gray-400'
                          : 'text-gray-600'
                        : theme === 'dark'
                          ? 'text-gray-600'
                          : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isActive
                        ? 'bg-brand-mint/20 border-2 border-brand-mint'
                        : isCompleted
                          ? 'bg-brand-mint/10 border border-brand-mint/50'
                          : theme === 'dark'
                            ? 'bg-gray-800 border border-gray-700'
                            : 'bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className='w-5 h-5' />
                    ) : (
                      <Icon className='w-5 h-5' />
                    )}
                  </div>
                  <span className='text-xs text-center whitespace-nowrap'>
                    {step.name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Step content card */}
          <div
            className={`rounded-2xl border p-6 ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            <h2
              className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {STEPS[currentStep].name}
            </h2>
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className='flex justify-between mt-6'>
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                currentStep === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              <ArrowLeft className='w-5 h-5' />
              Previous
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className='flex items-center gap-2 px-6 py-3 bg-brand-mint text-gray-900 rounded-xl font-medium hover:bg-brand-mint/90'
              >
                Next
                <ArrowRight className='w-5 h-5' />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='flex items-center gap-2 px-6 py-3 bg-brand-mint text-gray-900 rounded-xl font-medium hover:bg-brand-mint/90 disabled:opacity-50'
              >
                {isSaving ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Save className='w-5 h-5' />
                )}
                Save Resume
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Step Components
interface PersonalInfoStepProps {
  data: PersonalInfo
  onChange: (data: PersonalInfo) => void
  theme: string
}

function PersonalInfoStep({ data, onChange, theme }: PersonalInfoStepProps) {
  const updateField = (field: keyof PersonalInfo, value: string) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className='space-y-4'>
      <h4
        className={`text-base sm:text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Personal Information
      </h4>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
        <InputField
          label='First Name'
          value={data.firstName}
          onChange={(v) => updateField('firstName', v)}
          theme={theme}
          required
        />
        <InputField
          label='Last Name'
          value={data.lastName}
          onChange={(v) => updateField('lastName', v)}
          theme={theme}
          required
        />
        <InputField
          label='Email'
          type='email'
          value={data.email}
          onChange={(v) => updateField('email', v)}
          theme={theme}
          required
        />
        <PhoneField
          label='Phone'
          value={data.phone}
          onChange={(v) => updateField('phone', v)}
          theme={theme}
          required
        />
        <InputField
          label='Address'
          value={data.address}
          onChange={(v) => updateField('address', v)}
          theme={theme}
          className='md:col-span-2'
        />
        <InputField
          label='City'
          value={data.city}
          onChange={(v) => updateField('city', v)}
          theme={theme}
        />
        <InputField
          label='State'
          value={data.state}
          onChange={(v) => updateField('state', v)}
          theme={theme}
        />
        <InputField
          label='ZIP Code'
          value={data.zipCode}
          onChange={(v) => updateField('zipCode', v)}
          theme={theme}
        />
      </div>
      <TextareaField
        label='Professional Summary'
        value={data.professionalSummary}
        onChange={(v) => updateField('professionalSummary', v)}
        theme={theme}
        placeholder='Brief summary of your experience and qualifications...'
        rows={4}
      />
    </div>
  )
}

interface CDLInfoStepProps {
  data: CDLInfo
  onChange: (data: CDLInfo) => void
  theme: string
}

function CDLInfoStep({ data, onChange, theme }: CDLInfoStepProps) {
  const toggleEndorsement = (endorsement: string) => {
    const updated = data.endorsements.includes(endorsement)
      ? data.endorsements.filter((e) => e !== endorsement)
      : [...data.endorsements, endorsement]
    onChange({ ...data, endorsements: updated })
  }

  const addRestriction = (restriction: string) => {
    if (restriction.trim() && !data.restrictions.includes(restriction.trim())) {
      onChange({ ...data, restrictions: [...data.restrictions, restriction.trim()] })
    }
  }

  const removeRestriction = (restriction: string) => {
    onChange({ ...data, restrictions: data.restrictions.filter((r) => r !== restriction) })
  }

  return (
    <div className='space-y-4'>
      <h4
        className={`text-base sm:text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        CDL & License Information
      </h4>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
        <InputField
          label='CDL Number'
          value={data.cdlNumber}
          onChange={(v) => onChange({ ...data, cdlNumber: v })}
          theme={theme}
          required
          placeholder='For internal use only - not shown on resume'
        />
        <InputField
          label='CDL State'
          value={data.cdlState}
          onChange={(v) => onChange({ ...data, cdlState: v })}
          theme={theme}
          required
        />
        <SelectField
          label='CDL Class'
          value={data.cdlClass}
          onChange={(v) => onChange({ ...data, cdlClass: v })}
          options={['', 'Class A', 'Class B', 'Class C']}
          theme={theme}
          required
        />
        <InputField
          label='Expiration Date'
          type='date'
          value={data.expirationDate}
          onChange={(v) => onChange({ ...data, expirationDate: v })}
          theme={theme}
        />
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Endorsements
        </label>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2'>
          {ENDORSEMENT_OPTIONS.map((endorsement) => (
            <label
              key={endorsement}
              className={`flex items-center gap-2 p-2 sm:p-3 rounded-xl cursor-pointer border transition-all text-xs sm:text-sm ${
                data.endorsements.includes(endorsement)
                  ? 'bg-brand-mint/20 border-brand-mint/50'
                  : theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type='checkbox'
                checked={data.endorsements.includes(endorsement)}
                onChange={() => toggleEndorsement(endorsement)}
                className='w-4 h-4'
              />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                {endorsement}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Restrictions
        </label>
        <div className='flex flex-wrap gap-2 mb-2'>
          {data.restrictions.map((restriction) => (
            <span
              key={restriction}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700/50 text-gray-200 border border-gray-600'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              {restriction}
              <button
                onClick={() => removeRestriction(restriction)}
                className='ml-1 hover:opacity-70'
              >
                <X className='w-3 h-3' />
              </button>
            </span>
          ))}
        </div>
        <input
          type='text'
          placeholder='Add restriction (press Enter)'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addRestriction(e.currentTarget.value)
              e.currentTarget.value = ''
            }
          }}
          className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
          }`}
        />
      </div>
    </div>
  )
}

interface EmploymentStepProps {
  employments: Employment[]
  onChange: (employments: Employment[]) => void
  theme: string
}

function EmploymentStep({ employments, onChange, theme }: EmploymentStepProps) {
  const addEmployment = () => {
    onChange([
      ...employments,
      {
        id: Date.now().toString(),
        companyName: '',
        position: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        location: '',
        responsibilities: [],
        equipment: [],
      },
    ])
  }

  const updateEmployment = (id: string, updates: Partial<Employment>) => {
    onChange(
      employments.map((emp) => (emp.id === id ? { ...emp, ...updates } : emp))
    )
  }

  const removeEmployment = (id: string) => {
    onChange(employments.filter((emp) => emp.id !== id))
  }

  const addResponsibility = (id: string, responsibility: string) => {
    if (responsibility.trim()) {
      const emp = employments.find((e) => e.id === id)
      if (emp && !emp.responsibilities.includes(responsibility.trim())) {
        updateEmployment(id, {
          responsibilities: [...emp.responsibilities, responsibility.trim()],
        })
      }
    }
  }

  const removeResponsibility = (id: string, responsibility: string) => {
    const emp = employments.find((e) => e.id === id)
    if (emp) {
      updateEmployment(id, {
        responsibilities: emp.responsibilities.filter((r) => r !== responsibility),
      })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4'>
        <h4
          className={`text-base sm:text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Employment History
        </h4>
        <button
          onClick={addEmployment}
          className='inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl font-medium bg-brand-mint text-gray-900 hover:bg-brand-mint/90 transition-all'
        >
          <Plus className='w-4 h-4' />
          <span>Add Employment</span>
        </button>
      </div>

      {employments.length === 0 ? (
        <div
          className={`text-center py-8 rounded-lg border-2 border-dashed ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400'
              : 'border-gray-300 text-gray-500'
          }`}
        >
          <p>No employment history added yet. Click "Add Employment" to get started.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {employments.map((emp) => (
            <div
              key={emp.id}
              className={`p-3 sm:p-4 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className='flex items-start justify-between mb-4'>
                <h5
                  className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Employment #{employments.indexOf(emp) + 1}
                </h5>
                <button
                  onClick={() => removeEmployment(emp.id)}
                  className={`p-1 rounded hover:opacity-70 ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`}
                >
                  <X className='w-4 h-4' />
                </button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
                <InputField
                  label='Company Name'
                  value={emp.companyName}
                  onChange={(v) => updateEmployment(emp.id, { companyName: v })}
                  theme={theme}
                  required
                />
                <InputField
                  label='Position'
                  value={emp.position}
                  onChange={(v) => updateEmployment(emp.id, { position: v })}
                  theme={theme}
                  required
                />
                <InputField
                  label='Location'
                  value={emp.location}
                  onChange={(v) => updateEmployment(emp.id, { location: v })}
                  theme={theme}
                />
                <InputField
                  label='Start Date'
                  type='date'
                  value={emp.startDate}
                  onChange={(v) => updateEmployment(emp.id, { startDate: v })}
                  theme={theme}
                  required
                />
                <InputField
                  label='End Date'
                  type='date'
                  value={emp.endDate}
                  onChange={(v) => updateEmployment(emp.id, { endDate: v })}
                  theme={theme}
                  disabled={emp.isCurrent}
                  required={!emp.isCurrent}
                />
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={emp.isCurrent}
                    onChange={(e) =>
                      updateEmployment(emp.id, { isCurrent: e.target.checked, endDate: '' })
                    }
                    className='w-4 h-4'
                  />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Currently employed here
                  </span>
                </label>
              </div>

              <div className='mt-4'>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Responsibilities
                </label>
                <div className='flex flex-wrap gap-2 mb-2'>
                  {emp.responsibilities.map((resp) => (
                    <span
                      key={resp}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700/50 text-gray-200 border border-gray-600'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {resp}
                      <button
                        onClick={() => removeResponsibility(emp.id, resp)}
                        className='ml-1 hover:opacity-70'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type='text'
                  placeholder='Add responsibility (press Enter)'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addResponsibility(emp.id, e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EducationStep({
  educations,
  onChange,
  theme,
}: {
  educations: Education[]
  onChange: (educations: Education[]) => void
  theme: string
}) {
  const addEducation = () => {
    onChange([
      ...educations,
      {
        id: Date.now().toString(),
        school: '',
        degree: '',
        field: '',
        year: '',
        certifications: [],
      },
    ])
  }

  const updateEducation = (id: string, updates: Partial<Education>) => {
    onChange(educations.map((edu) => (edu.id === id ? { ...edu, ...updates } : edu)))
  }

  const removeEducation = (id: string) => {
    onChange(educations.filter((edu) => edu.id !== id))
  }

  const addCertification = (id: string, certification: string) => {
    if (certification.trim()) {
      const edu = educations.find((e) => e.id === id)
      if (edu && !edu.certifications.includes(certification.trim())) {
        updateEducation(id, {
          certifications: [...edu.certifications, certification.trim()],
        })
      }
    }
  }

  const removeCertification = (id: string, certification: string) => {
    const edu = educations.find((e) => e.id === id)
    if (edu) {
      updateEducation(id, {
        certifications: edu.certifications.filter((c) => c !== certification),
      })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4'>
        <h4
          className={`text-base sm:text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Education & Training
        </h4>
        <button
          onClick={addEducation}
          className='inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl font-medium bg-brand-mint text-gray-900 hover:bg-brand-mint/90 transition-all'
        >
          <Plus className='w-4 h-4' />
          <span>Add Education</span>
        </button>
      </div>

      {educations.length === 0 ? (
        <div
          className={`text-center py-8 rounded-lg border-2 border-dashed ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400'
              : 'border-gray-300 text-gray-500'
          }`}
        >
          <p>No education entries added yet. Click "Add Education" to get started.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {educations.map((edu) => (
            <div
              key={edu.id}
              className={`p-3 sm:p-4 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className='flex items-start justify-between mb-4'>
                <h5
                  className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Education #{educations.indexOf(edu) + 1}
                </h5>
                <button
                  onClick={() => removeEducation(edu.id)}
                  className={`p-1 rounded hover:opacity-70 ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`}
                >
                  <X className='w-4 h-4' />
                </button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
                <InputField
                  label='School/Institution'
                  value={edu.school}
                  onChange={(v) => updateEducation(edu.id, { school: v })}
                  theme={theme}
                  required
                />
                <InputField
                  label='Degree/Certificate'
                  value={edu.degree}
                  onChange={(v) => updateEducation(edu.id, { degree: v })}
                  theme={theme}
                  placeholder='e.g., High School Diploma, CDL Training'
                />
                <InputField
                  label='Field of Study'
                  value={edu.field}
                  onChange={(v) => updateEducation(edu.id, { field: v })}
                  theme={theme}
                  placeholder='e.g., Commercial Driving'
                />
                <InputField
                  label='Year'
                  type='text'
                  value={edu.year}
                  onChange={(v) => updateEducation(edu.id, { year: v })}
                  theme={theme}
                  placeholder='e.g., 2020 or 2018-2020'
                />
              </div>

              <div className='mt-4'>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Certifications & Licenses
                </label>
                <div className='flex flex-wrap gap-2 mb-2'>
                  {edu.certifications.map((cert) => (
                    <span
                      key={cert}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700/50 text-gray-200 border border-gray-600'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {cert}
                      <button
                        onClick={() => removeCertification(edu.id, cert)}
                        className='ml-1 hover:opacity-70'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type='text'
                  placeholder='Add certification (press Enter)'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCertification(edu.id, e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillsStep({
  skills,
  onChange,
  theme,
}: {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
  theme: string
}) {
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState<Skill['category']>('other')

  const addSkill = () => {
    if (newSkillName.trim()) {
      onChange([
        ...skills,
        {
          id: Date.now().toString(),
          name: newSkillName.trim(),
          category: newSkillCategory,
        },
      ])
      setNewSkillName('')
      setNewSkillCategory('other')
    }
  }

  const removeSkill = (id: string) => {
    onChange(skills.filter((skill) => skill.id !== id))
  }

  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = []
      }
      acc[skill.category].push(skill)
      return acc
    },
    {} as Record<Skill['category'], Skill[]>
  )

  return (
    <div className='space-y-4'>
      <h4
        className={`text-base sm:text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Skills & Equipment
      </h4>

      {/* Add Skill Form */}
      <div
        className={`p-4 rounded-lg border ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4'>
          <div className='sm:col-span-2'>
            <label
              className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Skill Name
            </label>
            <input
              type='text'
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSkill()
                }
              }}
              placeholder='e.g., Double/Triple Trailers, ELD Systems'
              className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
              }`}
            />
          </div>
          <div>
            <SelectField
              label='Category'
              value={newSkillCategory}
              onChange={(v) => setNewSkillCategory(v as Skill['category'])}
              options={SKILL_CATEGORIES.map((cat) => cat.value)}
              theme={theme}
            />
          </div>
        </div>
        <button
          onClick={addSkill}
          disabled={!newSkillName.trim()}
          className='mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl font-medium bg-brand-mint text-gray-900 hover:bg-brand-mint/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <Plus className='w-4 h-4' />
          Add Skill
        </button>
      </div>

      {/* Skills by Category */}
      {skills.length === 0 ? (
        <div
          className={`text-center py-8 rounded-lg border-2 border-dashed ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400'
              : 'border-gray-300 text-gray-500'
          }`}
        >
          <p>No skills added yet. Add your first skill above.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {SKILL_CATEGORIES.map((category) => {
            const categorySkills = skillsByCategory[category.value] || []
            if (categorySkills.length === 0) return null

            return (
              <div
                key={category.value}
                className={`p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h5
                  className={`font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {category.label}
                </h5>
                <div className='flex flex-wrap gap-2'>
                  {categorySkills.map((skill) => (
                    <span
                      key={skill.id}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700/50 text-gray-200 border border-gray-600'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {skill.name}
                      <button
                        onClick={() => removeSkill(skill.id)}
                        className='ml-1 hover:opacity-70'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReferencesStep({
  references,
  onChange,
  theme,
}: {
  references: Reference[]
  onChange: (references: Reference[]) => void
  theme: string
}) {
  const addReference = () => {
    onChange([
      ...references,
      {
        id: Date.now().toString(),
        name: '',
        title: '',
        company: '',
        phone: '',
        email: '',
        relationship: '',
      },
    ])
  }

  const updateReference = (id: string, updates: Partial<Reference>) => {
    onChange(references.map((ref) => (ref.id === id ? { ...ref, ...updates } : ref)))
  }

  const removeReference = (id: string) => {
    onChange(references.filter((ref) => ref.id !== id))
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4'>
        <h4
          className={`text-base sm:text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Professional References
        </h4>
        <button
          onClick={addReference}
          className='inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl font-medium bg-brand-mint text-gray-900 hover:bg-brand-mint/90 transition-all'
        >
          <Plus className='w-4 h-4' />
          <span>Add Reference</span>
        </button>
      </div>

      {references.length === 0 ? (
        <div
          className={`text-center py-8 rounded-lg border-2 border-dashed ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400'
              : 'border-gray-300 text-gray-500'
          }`}
        >
          <p>No references added yet. Click "Add Reference" to get started.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {references.map((ref) => (
            <div
              key={ref.id}
              className={`p-3 sm:p-4 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className='flex items-start justify-between mb-4'>
                <h5
                  className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Reference #{references.indexOf(ref) + 1}
                </h5>
                <button
                  onClick={() => removeReference(ref.id)}
                  className={`p-1 rounded hover:opacity-70 ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`}
                >
                  <X className='w-4 h-4' />
                </button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4'>
                <InputField
                  label='Name'
                  value={ref.name}
                  onChange={(v) => updateReference(ref.id, { name: v })}
                  theme={theme}
                  required
                />
                <InputField
                  label='Title/Position'
                  value={ref.title}
                  onChange={(v) => updateReference(ref.id, { title: v })}
                  theme={theme}
                />
                <InputField
                  label='Company'
                  value={ref.company}
                  onChange={(v) => updateReference(ref.id, { company: v })}
                  theme={theme}
                />
                <InputField
                  label='Relationship'
                  value={ref.relationship}
                  onChange={(v) => updateReference(ref.id, { relationship: v })}
                  theme={theme}
                  placeholder='e.g., Former Supervisor, Colleague'
                />
                <PhoneField
                  label='Phone'
                  value={ref.phone}
                  onChange={(v) => updateReference(ref.id, { phone: v })}
                  theme={theme}
                />
                <InputField
                  label='Email'
                  type='email'
                  value={ref.email}
                  onChange={(v) => updateReference(ref.id, { email: v })}
                  theme={theme}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewStep({
  personalInfo,
  cdlInfo,
  employments,
  educations,
  skills,
  references,
  theme,
}: {
  personalInfo: PersonalInfo
  cdlInfo: CDLInfo
  employments: Employment[]
  educations: Education[]
  skills: Skill[]
  references: Reference[]
  theme: string
}) {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Present'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }

  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = []
      }
      acc[skill.category].push(skill)
      return acc
    },
    {} as Record<Skill['category'], Skill[]>
  )

  return (
    <div className='space-y-6'>
      <h4
        className={`text-base sm:text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Review Your Resume
      </h4>

      <div
        id='resume-review-content'
        className={`rounded-lg border p-6 sm:p-8 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Personal Information */}
        <section className='mb-6 pb-6 border-b border-gray-300 dark:border-gray-700'>
          <h5
            className={`text-lg font-bold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {personalInfo.firstName || personalInfo.lastName
              ? `${personalInfo.firstName} ${personalInfo.lastName}`.trim()
              : 'Your Name'}
          </h5>
          <div
            className={`text-sm space-y-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {personalInfo.email && <p>📧 {personalInfo.email}</p>}
            {personalInfo.phone && <p>📞 {personalInfo.phone}</p>}
            {(personalInfo.address || personalInfo.city || personalInfo.state) && (
              <p>
                📍{' '}
                {[personalInfo.address, personalInfo.city, personalInfo.state, personalInfo.zipCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
          {personalInfo.professionalSummary && (
            <p
              className={`mt-3 text-sm leading-relaxed ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {personalInfo.professionalSummary}
            </p>
          )}
        </section>

        {/* CDL Information - CDL number excluded for privacy/security */}
        {(cdlInfo.cdlClass || cdlInfo.endorsements.length > 0 || cdlInfo.expirationDate || cdlInfo.restrictions.length > 0) && (
          <section className='mb-6 pb-6 border-b border-gray-300 dark:border-gray-700'>
            <h5
              className={`text-base font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              CDL & License Information
            </h5>
            <div
              className={`text-sm space-y-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {cdlInfo.cdlState && (
                <p>
                  <span className='font-medium'>Licensed State:</span> {cdlInfo.cdlState}
                </p>
              )}
              {cdlInfo.cdlClass && (
                <p>
                  <span className='font-medium'>Class:</span> {cdlInfo.cdlClass}
                </p>
              )}
              {cdlInfo.endorsements.length > 0 && (
                <p>
                  <span className='font-medium'>Endorsements:</span>{' '}
                  {cdlInfo.endorsements.join(', ')}
                </p>
              )}
              {cdlInfo.expirationDate && (
                <p>
                  <span className='font-medium'>Expiration:</span> {formatDate(cdlInfo.expirationDate)}
                </p>
              )}
              {cdlInfo.restrictions.length > 0 && (
                <p>
                  <span className='font-medium'>Restrictions:</span>{' '}
                  {cdlInfo.restrictions.join(', ')}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Employment History */}
        {employments.length > 0 && (
          <section className='mb-6 pb-6 border-b border-gray-300 dark:border-gray-700'>
            <h5
              className={`text-base font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Employment History
            </h5>
            <div className='space-y-4'>
              {employments.map((emp, idx) => (
                <div key={emp.id || idx}>
                  <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between mb-1'>
                    <div>
                      <p
                        className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {emp.position || 'Position'}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {emp.companyName || 'Company'} {emp.location && `• ${emp.location}`}
                      </p>
                    </div>
                    <p
                      className={`text-sm mt-1 sm:mt-0 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      {formatDate(emp.startDate)} -{' '}
                      {emp.isCurrent ? 'Present' : formatDate(emp.endDate)}
                    </p>
                  </div>
                  {emp.responsibilities.length > 0 && (
                    <ul
                      className={`mt-2 ml-4 list-disc text-sm space-y-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {emp.responsibilities.map((resp, i) => (
                        <li key={i}>{resp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {educations.length > 0 && (
          <section className='mb-6 pb-6 border-b border-gray-300 dark:border-gray-700'>
            <h5
              className={`text-base font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Education & Training
            </h5>
            <div className='space-y-2'>
              {educations.map((edu, idx) => (
                <div key={edu.id || idx}>
                  <p
                    className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {edu.degree || 'Degree'} {edu.field && `in ${edu.field}`}
                  </p>
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {edu.school} {edu.year && `• ${edu.year}`}
                  </p>
                  {edu.certifications.length > 0 && (
                    <p
                      className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Certifications: {edu.certifications.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section className='mb-6 pb-6 border-b border-gray-300 dark:border-gray-700'>
            <h5
              className={`text-base font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Skills & Equipment
            </h5>
            <div className='space-y-3'>
              {SKILL_CATEGORIES.map((category) => {
                const categorySkills = skillsByCategory[category.value] || []
                if (categorySkills.length === 0) return null

                return (
                  <div key={category.value}>
                    <p
                      className={`text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {category.label}:
                    </p>
                    <p
                      className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      {categorySkills.map((s) => s.name).join(', ')}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* References */}
        {references.length > 0 && (
          <section>
            <h5
              className={`text-base font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Professional References
            </h5>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {references.map((ref, idx) => (
                <div key={ref.id || idx}>
                  <p
                    className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {ref.name || 'Name'}
                  </p>
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {ref.title} {ref.company && `at ${ref.company}`}
                  </p>
                  {ref.relationship && (
                    <p
                      className={`text-xs mt-1 ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      }`}
                    >
                      {ref.relationship}
                    </p>
                  )}
                  {ref.phone && (
                    <p
                      className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      📞 {ref.phone}
                    </p>
                  )}
                  {ref.email && (
                    <p
                      className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      📧 {ref.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!personalInfo.firstName &&
          !cdlInfo.cdlNumber &&
          employments.length === 0 &&
          educations.length === 0 &&
          skills.length === 0 &&
          references.length === 0 && (
            <div
              className={`text-center py-8 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <p>Your resume preview will appear here once you fill in the previous steps.</p>
            </div>
          )}
      </div>
    </div>
  )
}

// Shared Input Components
function InputField({
  label,
  value,
  onChange,
  type = 'text',
  theme,
  required = false,
  disabled = false,
  className = '',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  theme: string
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  return (
    <div className={className}>
      <label
        className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {label}
        {required && <span className='text-red-500 ml-1'>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      />
    </div>
  )
}

function PhoneField({
  label,
  value,
  onChange,
  theme,
  required = false,
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  theme: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label
        className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {label}
        {required && <span className='text-red-500 ml-1'>*</span>}
      </label>
      <PhoneInput
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
        }`}
      />
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  theme,
  required = false,
  rows = 3,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  theme: string
  required?: boolean
  rows?: number
  placeholder?: string
}) {
  return (
    <div>
      <label
        className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {label}
        {required && <span className='text-red-500 ml-1'>*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
        }`}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  theme,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  theme: string
  required?: boolean
}) {
  return (
    <div>
      <label
        className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {label}
        {required && <span className='text-red-500 ml-1'>*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-mint/20 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white focus:border-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 focus:border-brand-mint'
        }`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || 'Select...'}
          </option>
        ))}
      </select>
    </div>
  )
}
