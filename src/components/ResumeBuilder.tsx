'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { ArrowLeft, ArrowRight, Save, Download, Plus, X, Check } from 'lucide-react'

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
  { id: 'personal', name: 'Personal Info', icon: '👤' },
  { id: 'cdl', name: 'CDL & License', icon: '🚛' },
  { id: 'employment', name: 'Employment History', icon: '💼' },
  { id: 'education', name: 'Education & Training', icon: '🎓' },
  { id: 'skills', name: 'Skills & Equipment', icon: '⚙️' },
  { id: 'references', name: 'References', icon: '📞' },
  { id: 'review', name: 'Review & Export', icon: '✅' },
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

      const response = await fetch('/api/resumes/create', {
        method: existingResumeId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': user.address,
        },
        body: JSON.stringify({
          resumeId: existingResumeId,
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
      setSaveSuccess(true)
      onSave?.(result.resumeId)
      
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

  return (
    <>
      {onBack && (
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-2 px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 cursor-pointer ${
            theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
          }`}
        >
          <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
          Back
        </button>
      )}

      <div
        className={`max-w-4xl mx-auto rounded-2xl border p-6 sm:p-8 shadow-2xl relative overflow-x-hidden ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 border-brand-mint/30 backdrop-blur-xl'
            : 'bg-white/80 border-brand-sage/20 backdrop-blur-xl'
        } border-t-4 ${
          theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
        }`}
      >
          {/* Header */}
          <div className='mb-4 sm:mb-6'>
            <h3
              className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              📝 Build Your Resume
            </h3>
            <p
              className={`text-xs sm:text-sm md:text-base ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Create a professional driver resume step by step. You can save your progress and export
              to PDF when done.
            </p>
          </div>

          {/* Progress Steps */}
          <div className='mb-4 sm:mb-6 -mx-3 sm:mx-0'>
            <div className='overflow-x-auto pb-2 px-3 sm:px-0 resume-steps-scrollbar'>
              <div className='flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap'>
                {STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      index === currentStep
                        ? theme === 'dark'
                          ? 'bg-brand-mint text-gray-900'
                          : 'bg-brand-sage text-white'
                        : theme === 'dark'
                          ? 'bg-brand-sage/30 text-brand-cream/70 hover:bg-brand-sage/40'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span className='text-sm sm:text-base'>{step.icon}</span>
                    <span className='hidden sm:inline'>{step.name}</span>
                    <span className='sm:hidden font-semibold'>{index + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save Status */}
          {(saveError || saveSuccess) && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                saveError
                  ? theme === 'dark'
                    ? 'bg-red-900/20 text-red-400 border border-red-500/40'
                    : 'bg-red-50 text-red-700 border border-red-200'
                  : theme === 'dark'
                    ? 'bg-green-900/20 text-green-400 border border-green-500/40'
                    : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {saveError || (saveSuccess && '✅ Resume saved successfully!')}
            </div>
          )}

          {/* Step Content */}
          <div className='mb-4 sm:mb-6 overflow-x-hidden'>{renderStep()}</div>

          {/* Navigation Buttons */}
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700'>
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-brand-sage/30 text-brand-cream hover:bg-brand-sage/40'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className='w-4 h-4' />
              Previous
            </button>

            <div className='flex items-stretch sm:items-center gap-2 flex-1 sm:flex-initial justify-end'>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all disabled:opacity-50 flex-1 sm:flex-initial ${
                  theme === 'dark'
                    ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/40 hover:bg-brand-mint/30'
                    : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
                }`}
              >
                <Save className='w-4 h-4' />
                <span className='hidden xs:inline'>{isSaving ? 'Saving...' : 'Save Progress'}</span>
                <span className='xs:hidden'>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all flex-1 sm:flex-initial ${
                    theme === 'dark'
                      ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                      : 'bg-brand-sage text-white hover:bg-brand-sage/90'
                  }`}
                >
                  <span>Next</span>
                  <ArrowRight className='w-4 h-4' />
                </button>
              ) : (
                <button
                  onClick={() => {
                    // TODO: Export to PDF
                    alert('PDF export coming soon!')
                  }}
                  className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all flex-1 sm:flex-initial ${
                    theme === 'dark'
                      ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                      : 'bg-brand-sage text-white hover:bg-brand-sage/90'
                  }`}
                >
                  <Download className='w-4 h-4' />
                  <span className='hidden xs:inline'>Export PDF</span>
                  <span className='xs:hidden'>Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
    </>
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
        <InputField
          label='Phone'
          type='tel'
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
              className={`flex items-center gap-2 p-2 sm:p-3 rounded-lg cursor-pointer border transition-all text-xs sm:text-sm ${
                data.endorsements.includes(endorsement)
                  ? theme === 'dark'
                    ? 'bg-brand-mint/20 border-brand-mint/40'
                    : 'bg-brand-sage/10 border-brand-sage/40'
                  : theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
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
                  ? 'bg-brand-sage/30 text-brand-cream border border-brand-sage/40'
                  : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30'
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
          className={`w-full px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
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
          className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90'
          }`}
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
                          ? 'bg-brand-sage/30 text-brand-cream border border-brand-sage/40'
                          : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30'
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
                  className={`w-full px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
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

// Placeholder components for other steps (Education, Skills, References, Review)
function EducationStep({
  educations,
  onChange,
  theme,
}: {
  educations: Education[]
  onChange: (educations: Education[]) => void
  theme: string
}) {
  return (
    <div className='space-y-4'>
      <h4
        className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Education & Training
      </h4>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        Education step - full implementation coming soon
      </p>
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
  return (
    <div className='space-y-4'>
      <h4
        className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Skills & Equipment
      </h4>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        Skills step - full implementation coming soon
      </p>
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
  return (
    <div className='space-y-4'>
      <h4
        className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        References
      </h4>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        References step - full implementation coming soon
      </p>
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
  return (
    <div className='space-y-4'>
      <h4
        className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        Review Your Resume
      </h4>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        Review step - full implementation coming soon. You'll be able to preview and export to PDF.
      </p>
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
        className={`block text-sm font-medium mb-1 ${
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
        className={`w-full px-3 sm:px-4 py-2 rounded-lg border transition-all text-sm sm:text-base ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-brand-mint focus:ring-1 focus:ring-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-brand-sage focus:ring-1 focus:ring-brand-sage'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
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
        className={`block text-sm font-medium mb-1 ${
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
        className={`w-full px-3 sm:px-4 py-2 rounded-lg border transition-all resize-none text-sm sm:text-base ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-brand-mint focus:ring-1 focus:ring-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-brand-sage focus:ring-1 focus:ring-brand-sage'
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
        className={`block text-sm font-medium mb-1 ${
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
        className={`w-full px-3 sm:px-4 py-2 rounded-lg border transition-all text-sm sm:text-base ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-white focus:border-brand-mint focus:ring-1 focus:ring-brand-mint'
            : 'bg-white border-gray-300 text-gray-900 focus:border-brand-sage focus:ring-1 focus:ring-brand-sage'
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
