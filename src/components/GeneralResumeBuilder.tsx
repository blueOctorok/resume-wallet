'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ArrowRight,
  Briefcase,
  Check,
  FileCheck,
  GraduationCap,
  Phone,
  Plus,
  Save,
  User,
  Wrench,
  X,
  Award,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { GENERAL_RESUME_SCHEMA } from '@/lib/general-resume-schema'
import type { UnifiedEducation, UnifiedSkill, UnifiedReference } from '@/types/driver-profile'

interface PersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  headline: string
  professionalSummary: string
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

interface ProfCert {
  id: string
  name: string
  issuer: string
  issuedDate: string
  expiresDate: string
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

const STEPS = [
  { id: 'personal', name: 'Profile', Icon: User },
  { id: 'employment', name: 'Work', Icon: Briefcase },
  { id: 'education', name: 'Education', Icon: GraduationCap },
  { id: 'skills', name: 'Skills', Icon: Wrench },
  { id: 'certs', name: 'Credentials', Icon: Award },
  { id: 'references', name: 'References', Icon: Phone },
  { id: 'review', name: 'Review', Icon: FileCheck },
] as const

const SKILL_OPTIONS: { value: Skill['category']; label: string }[] = [
  { value: 'other', label: 'General' },
  { value: 'technology', label: 'Technology' },
  { value: 'equipment', label: 'Equipment / tools' },
  { value: 'safety', label: 'Safety / compliance' },
  { value: 'route', label: 'Domain / industry' },
]

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function mapUnifiedEducation(e: UnifiedEducation): Education {
  return {
    id: e.id || newId(),
    school: e.school ?? '',
    degree: e.degree ?? '',
    field: e.field ?? '',
    year: e.year ?? '',
    certifications: e.certifications ?? [],
  }
}

function mapUnifiedSkill(s: UnifiedSkill): Skill {
  return {
    id: s.id || newId(),
    name: s.name ?? '',
    category: s.category ?? 'other',
  }
}

function mapUnifiedReference(r: UnifiedReference): Reference {
  return {
    id: r.id || newId(),
    name: r.name ?? '',
    title: r.title ?? '',
    company: r.company ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    relationship: r.relationship ?? '',
  }
}

interface GeneralResumeBuilderProps {
  userAddress?: string | null
  onBack?: () => void
  onSave?: (resumeId: string) => void
  existingResumeId?: string
  hideHubBackButton?: boolean
}

export default function GeneralResumeBuilder({
  userAddress,
  onBack,
  onSave,
  existingResumeId,
  hideHubBackButton = false,
}: GeneralResumeBuilderProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [internalResumeId, setInternalResumeId] = useState<string | undefined>(existingResumeId)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedRef = useRef('')

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    headline: '',
    professionalSummary: '',
  })

  const [employments, setEmployments] = useState<Employment[]>([])
  const [educations, setEducations] = useState<Education[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [professionalCertifications, setProfessionalCertifications] = useState<ProfCert[]>([])
  const [references, setReferences] = useState<Reference[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setInternalResumeId(existingResumeId)
  }, [existingResumeId])

  useEffect(() => {
    const blob = JSON.stringify({
      personalInfo,
      employments,
      educations,
      skills,
      professionalCertifications,
      references,
    })
    if (lastSavedRef.current && blob !== lastSavedRef.current) setHasUnsavedChanges(true)
  }, [personalInfo, employments, educations, skills, professionalCertifications, references])

  const loadData = useCallback(async () => {
    const wallet = (userAddress ?? '').trim()
    if (!wallet) return
    setLoadError(null)

    try {
      if (existingResumeId) {
        const res = await fetch(`/api/resumes/${existingResumeId}`, {
          headers: { 'x-wallet-address': wallet },
        })
        if (!res.ok) {
          setLoadError('Could not load resume')
          return
        }
        const row = await res.json()
        const sd = row.structured_data as Record<string, unknown> | null
        if (sd && typeof sd === 'object') {
          if (sd.personalInfo) setPersonalInfo((p) => ({ ...p, ...(sd.personalInfo as PersonalInfo) }))
          if (Array.isArray(sd.employments)) setEmployments(sd.employments as Employment[])
          if (Array.isArray(sd.educations)) setEducations(sd.educations as Education[])
          if (Array.isArray(sd.skills)) setSkills(sd.skills as Skill[])
          if (Array.isArray(sd.professionalCertifications)) {
            setProfessionalCertifications(sd.professionalCertifications as ProfCert[])
          }
          if (Array.isArray(sd.references)) setReferences(sd.references as Reference[])
        }
        setInternalResumeId(existingResumeId)
        return
      }

      const gr = await fetch('/api/general/resume', { headers: { 'x-wallet-address': wallet } })
      if (gr.ok) {
        const data = await gr.json()
        const latest = data.resumes?.[0]
        if (latest?.structured_data && typeof latest.structured_data === 'object') {
          const sd = latest.structured_data as Record<string, unknown>
          if (sd.personalInfo) setPersonalInfo((p) => ({ ...p, ...(sd.personalInfo as PersonalInfo) }))
          if (Array.isArray(sd.employments)) setEmployments(sd.employments as Employment[])
          if (Array.isArray(sd.educations)) setEducations(sd.educations as Education[])
          if (Array.isArray(sd.skills)) setSkills(sd.skills as Skill[])
          if (Array.isArray(sd.professionalCertifications)) {
            setProfessionalCertifications(sd.professionalCertifications as ProfCert[])
          }
          if (Array.isArray(sd.references)) setReferences(sd.references as Reference[])
          setInternalResumeId(latest.id)
        } else {
          const pre = data.prefill
          const prof = pre?.profile
          if (prof) {
            setPersonalInfo((p) => ({
              ...p,
              firstName: prof.first_name ?? p.firstName,
              lastName: prof.last_name ?? p.lastName,
              email: prof.email ?? p.email,
              phone: prof.phone ?? p.phone,
              city: prof.city ?? p.city,
              state: prof.state ?? p.state,
              zipCode: prof.zip_code ?? p.zipCode,
              headline: prof.headline ?? p.headline,
              professionalSummary: prof.professional_summary ?? p.professionalSummary,
            }))
          }
          if (pre?.education?.length) setEducations(pre.education.map(mapUnifiedEducation))
          if (pre?.skills?.length) setSkills(pre.skills.map(mapUnifiedSkill))
          if (pre?.references?.length) setReferences(pre.references.map(mapUnifiedReference))
        }
      }
    } catch (e) {
      console.error('[GENERAL RESUME BUILDER] load', e)
      setLoadError('Failed to load data')
    }
  }, [existingResumeId, userAddress])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const buildStructuredData = useCallback(() => {
    const now = new Date().toISOString()
    const cleanedEmployments = employments.map((e) => ({
      ...e,
      responsibilities: e.responsibilities.map((r) => r.trim()).filter(Boolean),
    }))
    return {
      schema: GENERAL_RESUME_SCHEMA,
      personalInfo,
      cdlInfo: {},
      employments: cleanedEmployments,
      educations,
      skills,
      professionalCertifications,
      references,
      createdAt: now,
      updatedAt: now,
    }
  }, [personalInfo, employments, educations, skills, professionalCertifications, references])

  const handleSave = async () => {
    const wallet = (userAddress ?? '').trim()
    if (!wallet) {
      setSaveError('Connect your wallet to save')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const structuredData = buildStructuredData()
      const title =
        `${personalInfo.firstName} ${personalInfo.lastName}`.trim() || 'Professional Resume'
      const res = await fetch('/api/general/resume', {
        method: internalResumeId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet,
        },
        body: JSON.stringify({
          resumeId: internalResumeId,
          structuredData,
          title,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Save failed')
      }
      const result = await res.json()
      const rid = result.resumeId as string
      if (rid && !internalResumeId) setInternalResumeId(rid)
      setSaveSuccess(true)
      lastSavedRef.current = JSON.stringify({
        personalInfo,
        employments,
        educations,
        skills,
        professionalCertifications,
        references,
      })
      setHasUnsavedChanges(false)
      onSave?.(rid)
      void syncDriverHubFromApi(wallet)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const ok = window.confirm('Discard unsaved changes?')
      if (!ok) return
    }
    onBack?.()
  }, [hasUnsavedChanges, onBack])

  const step = STEPS[currentStep]
  const StepIcon = step.Icon

  const addEmployment = () => {
    setEmployments((prev) => [
      ...prev,
      {
        id: newId(),
        companyName: '',
        position: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        location: '',
        responsibilities: [''],
      },
    ])
  }

  const addEducation = () => {
    setEducations((prev) => [
      ...prev,
      { id: newId(), school: '', degree: '', field: '', year: '', certifications: [] },
    ])
  }

  const addSkill = () => {
    setSkills((prev) => [...prev, { id: newId(), name: '', category: 'other' }])
  }

  const addCert = () => {
    setProfessionalCertifications((prev) => [
      ...prev,
      { id: newId(), name: '', issuer: '', issuedDate: '', expiresDate: '' },
    ])
  }

  const addReference = () => {
    setReferences((prev) => [
      ...prev,
      { id: newId(), name: '', title: '', company: '', phone: '', email: '', relationship: '' },
    ])
  }

  const fieldClass = `w-full rounded-xl border px-3 py-2 text-sm ${
    isDark
      ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder:text-gray-500'
      : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
  }`

  const labelClass = `block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`

  if (!userAddress?.trim()) {
    return (
      <Card variant='elevated' className='p-6 text-center'>
        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>Connect your wallet to edit your resume.</p>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between gap-4 flex-wrap'>
        {hideHubBackButton ? <span className='min-w-0' aria-hidden /> : <BackToHubButton onClick={handleBack} />}
        <div className='flex items-center gap-2'>
          {saveSuccess && (
            <span className={`text-sm flex items-center gap-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              <Check className='w-4 h-4' /> Saved
            </span>
          )}
          <Button variant='primary' size='sm' onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
            <Save className='w-4 h-4 mr-1' />
            Save
          </Button>
        </div>
      </div>

      {loadError && (
        <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{loadError}</p>
      )}
      {saveError && (
        <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{saveError}</p>
      )}

      {/* Step indicator */}
      <div className='flex flex-wrap gap-2'>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type='button'
            onClick={() => setCurrentStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === currentStep
                ? isDark
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'bg-teal-100 text-teal-800'
                : isDark
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <s.Icon className='w-3.5 h-3.5' />
            {s.name}
          </button>
        ))}
      </div>

      <Card variant='elevated' className='p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <StepIcon className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {step.name}
          </h2>
        </div>

        {step.id === 'personal' && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className={labelClass}>First name</label>
              <input
                className={fieldClass}
                value={personalInfo.firstName}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input
                className={fieldClass}
                value={personalInfo.lastName}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type='email'
                className={fieldClass}
                value={personalInfo.email}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <PhoneInput
                value={personalInfo.phone}
                onChange={(phone) => setPersonalInfo((p) => ({ ...p, phone }))}
                className={fieldClass}
              />
            </div>
            <div className='sm:col-span-2'>
              <label className={labelClass}>Street address</label>
              <input
                className={fieldClass}
                value={personalInfo.address}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                className={fieldClass}
                value={personalInfo.city}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                className={fieldClass}
                value={personalInfo.state}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, state: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>ZIP</label>
              <input
                className={fieldClass}
                value={personalInfo.zipCode}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, zipCode: e.target.value }))}
              />
            </div>
            <div className='sm:col-span-2'>
              <label className={labelClass}>Professional headline</label>
              <input
                className={fieldClass}
                placeholder='e.g. Registered Nurse · 5 years acute care'
                value={personalInfo.headline}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, headline: e.target.value }))}
              />
            </div>
            <div className='sm:col-span-2'>
              <label className={labelClass}>Summary</label>
              <textarea
                className={`${fieldClass} min-h-[100px]`}
                value={personalInfo.professionalSummary}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, professionalSummary: e.target.value }))}
              />
            </div>
          </div>
        )}

        {step.id === 'employment' && (
          <div className='space-y-4'>
            {employments.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Add at least one job. You can edit anytime.
              </p>
            ) : null}
            {employments.map((emp, idx) => (
              <div
                key={emp.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className='flex justify-between items-center'>
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Job {idx + 1}
                  </span>
                  <button
                    type='button'
                    onClick={() => setEmployments((prev) => prev.filter((e) => e.id !== emp.id))}
                    className={isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}
                    aria-label='Remove job'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div>
                    <label className={labelClass}>Company</label>
                    <input
                      className={fieldClass}
                      value={emp.companyName}
                      onChange={(e) => {
                        const v = e.target.value
                        setEmployments((prev) =>
                          prev.map((x) => (x.id === emp.id ? { ...x, companyName: v } : x)),
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Title</label>
                    <input
                      className={fieldClass}
                      value={emp.position}
                      onChange={(e) => {
                        const v = e.target.value
                        setEmployments((prev) =>
                          prev.map((x) => (x.id === emp.id ? { ...x, position: v } : x)),
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Location</label>
                    <input
                      className={fieldClass}
                      value={emp.location}
                      onChange={(e) => {
                        const v = e.target.value
                        setEmployments((prev) =>
                          prev.map((x) => (x.id === emp.id ? { ...x, location: v } : x)),
                        )
                      }}
                    />
                  </div>
                  <div className='flex items-end gap-2'>
                    <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <input
                        type='checkbox'
                        checked={emp.isCurrent}
                        onChange={(e) => {
                          const v = e.target.checked
                          setEmployments((prev) =>
                            prev.map((x) => (x.id === emp.id ? { ...x, isCurrent: v } : x)),
                          )
                        }}
                      />
                      Current role
                    </label>
                  </div>
                  <div>
                    <label className={labelClass}>Start</label>
                    <input
                      type='date'
                      className={fieldClass}
                      value={emp.startDate}
                      onChange={(e) => {
                        const v = e.target.value
                        setEmployments((prev) =>
                          prev.map((x) => (x.id === emp.id ? { ...x, startDate: v } : x)),
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>End</label>
                    <input
                      type='date'
                      className={fieldClass}
                      disabled={emp.isCurrent}
                      value={emp.endDate}
                      onChange={(e) => {
                        const v = e.target.value
                        setEmployments((prev) =>
                          prev.map((x) => (x.id === emp.id ? { ...x, endDate: v } : x)),
                        )
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Key responsibilities (one per line)</label>
                  <textarea
                    className={fieldClass}
                    rows={4}
                    value={emp.responsibilities.join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n')
                      setEmployments((prev) =>
                        prev.map((x) =>
                          x.id === emp.id ? { ...x, responsibilities: lines.length ? lines : [''] } : x,
                        ),
                      )
                    }}
                  />
                </div>
              </div>
            ))}
            <Button variant='secondary' size='sm' type='button' onClick={addEmployment}>
              <Plus className='w-4 h-4 mr-1' />
              Add job
            </Button>
          </div>
        )}

        {step.id === 'education' && (
          <div className='space-y-4'>
            {educations.map((ed, idx) => (
              <div
                key={ed.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className='flex justify-between'>
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    School {idx + 1}
                  </span>
                  <button
                    type='button'
                    onClick={() => setEducations((prev) => prev.filter((e) => e.id !== ed.id))}
                    className={isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}
                    aria-label='Remove education'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {(['school', 'degree', 'field', 'year'] as const).map((key) => (
                    <div key={key} className={key === 'school' ? 'sm:col-span-2' : ''}>
                      <label className={labelClass}>{key}</label>
                      <input
                        className={fieldClass}
                        value={ed[key]}
                        onChange={(e) => {
                          const v = e.target.value
                          setEducations((prev) =>
                            prev.map((x) => (x.id === ed.id ? { ...x, [key]: v } : x)),
                          )
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button variant='secondary' size='sm' type='button' onClick={addEducation}>
              <Plus className='w-4 h-4 mr-1' />
              Add education
            </Button>
          </div>
        )}

        {step.id === 'skills' && (
          <div className='space-y-3'>
            {skills.map((sk) => (
              <div key={sk.id} className='flex flex-wrap gap-2 items-end'>
                <div className='flex-1 min-w-[140px]'>
                  <label className={labelClass}>Skill</label>
                  <input
                    className={fieldClass}
                    value={sk.name}
                    onChange={(e) => {
                      const v = e.target.value
                      setSkills((prev) => prev.map((x) => (x.id === sk.id ? { ...x, name: v } : x)))
                    }}
                  />
                </div>
                <div className='w-40'>
                  <label className={labelClass}>Group</label>
                  <select
                    className={fieldClass}
                    value={sk.category}
                    onChange={(e) => {
                      const v = e.target.value as Skill['category']
                      setSkills((prev) => prev.map((x) => (x.id === sk.id ? { ...x, category: v } : x)))
                    }}
                  >
                    {SKILL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type='button'
                  onClick={() => setSkills((prev) => prev.filter((x) => x.id !== sk.id))}
                  className={`p-2 rounded-lg ${isDark ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-100'}`}
                  aria-label='Remove skill'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            ))}
            <Button variant='secondary' size='sm' type='button' onClick={addSkill}>
              <Plus className='w-4 h-4 mr-1' />
              Add skill
            </Button>
          </div>
        )}

        {step.id === 'certs' && (
          <div className='space-y-4'>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Licenses, industry certs, or credentials (optional).
            </p>
            {professionalCertifications.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border grid gap-3 sm:grid-cols-2 ${
                  isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className='flex justify-end sm:col-span-2'>
                  <button
                    type='button'
                    onClick={() =>
                      setProfessionalCertifications((prev) => prev.filter((x) => x.id !== c.id))
                    }
                    className={isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}
                    aria-label='Remove certification'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                {(['name', 'issuer'] as const).map((key) => (
                  <div key={key} className={key === 'name' ? 'sm:col-span-2' : ''}>
                    <label className={labelClass}>{key === 'name' ? 'Credential name' : 'Issuing org'}</label>
                    <input
                      className={fieldClass}
                      value={c[key]}
                      onChange={(e) => {
                        const v = e.target.value
                        setProfessionalCertifications((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, [key]: v } : x)),
                        )
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label className={labelClass}>Issued</label>
                  <input
                    type='date'
                    className={fieldClass}
                    value={c.issuedDate}
                    onChange={(e) => {
                      const v = e.target.value
                      setProfessionalCertifications((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, issuedDate: v } : x)),
                      )
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass}>Expires</label>
                  <input
                    type='date'
                    className={fieldClass}
                    value={c.expiresDate}
                    onChange={(e) => {
                      const v = e.target.value
                      setProfessionalCertifications((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, expiresDate: v } : x)),
                      )
                    }}
                  />
                </div>
              </div>
            ))}
            <Button variant='secondary' size='sm' type='button' onClick={addCert}>
              <Plus className='w-4 h-4 mr-1' />
              Add credential
            </Button>
          </div>
        )}

        {step.id === 'references' && (
          <div className='space-y-4'>
            {references.map((ref) => (
              <div
                key={ref.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className='flex justify-end'>
                  <button
                    type='button'
                    onClick={() => setReferences((prev) => prev.filter((r) => r.id !== ref.id))}
                    className={isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}
                    aria-label='Remove reference'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {(
                    [
                      ['name', 'Full name'],
                      ['title', 'Title'],
                      ['company', 'Company'],
                      ['relationship', 'Relationship'],
                    ] as const
                  ).map(([key, lab]) => (
                    <div key={key}>
                      <label className={labelClass}>{lab}</label>
                      <input
                        className={fieldClass}
                        value={ref[key]}
                        onChange={(e) => {
                          const v = e.target.value
                          setReferences((prev) =>
                            prev.map((x) => (x.id === ref.id ? { ...x, [key]: v } : x)),
                          )
                        }}
                      />
                    </div>
                  ))}
                  <div>
                    <label className={labelClass}>Phone</label>
                    <PhoneInput
                      value={ref.phone}
                      onChange={(phone) =>
                        setReferences((prev) =>
                          prev.map((x) => (x.id === ref.id ? { ...x, phone } : x)),
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type='email'
                      className={fieldClass}
                      value={ref.email}
                      onChange={(e) => {
                        const v = e.target.value
                        setReferences((prev) =>
                          prev.map((x) => (x.id === ref.id ? { ...x, email: v } : x)),
                        )
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant='secondary' size='sm' type='button' onClick={addReference}>
              <Plus className='w-4 h-4 mr-1' />
              Add reference
            </Button>
          </div>
        )}

        {step.id === 'review' && (
          <div className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <p>
              <strong>Name:</strong> {personalInfo.firstName} {personalInfo.lastName}
            </p>
            {personalInfo.headline ? (
              <p>
                <strong>Headline:</strong> {personalInfo.headline}
              </p>
            ) : null}
            <p>
              <strong>Jobs:</strong> {employments.length} · <strong>Education:</strong> {educations.length} ·{' '}
              <strong>Skills:</strong> {skills.length} · <strong>Credentials:</strong>{' '}
              {professionalCertifications.length} · <strong>References:</strong> {references.length}
            </p>
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              Save, then use <strong>Verify on-chain</strong> from My Files when you are ready — same flow as other
              built resumes.
            </p>
          </div>
        )}

        <div className='flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
          <Button
            variant='secondary'
            size='sm'
            type='button'
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button
              variant='primary'
              size='sm'
              type='button'
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              Next
              <ArrowRight className='w-4 h-4 ml-1' />
            </Button>
          ) : (
            <Button variant='primary' size='sm' type='button' onClick={handleSave} isLoading={isSaving}>
              <Save className='w-4 h-4' />
              Save resume
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
