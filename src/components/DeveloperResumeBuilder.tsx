'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  X,
  Check,
  User,
  Code,
  Briefcase,
  GraduationCap,
  Folder,
  FileCheck,
  Loader2,
  ExternalLink,
  Github,
  Globe,
  Sparkles,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'

// ============================================================
// TYPES
// ============================================================

interface PersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  headline: string
  summary: string
  githubUrl: string
  linkedinUrl: string
  portfolioUrl: string
  personalWebsite: string
}

interface TechnicalSkill {
  id: string
  name: string
  category: 'language' | 'framework' | 'database' | 'cloud' | 'tool' | 'other'
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

interface WorkExperience {
  id: string
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
  achievements: string[]
  technologies: string[]
}

interface Project {
  id: string
  name: string
  description: string
  role: string
  technologies: string[]
  liveUrl: string
  repoUrl: string
  highlights: string[]
}

interface Education {
  id: string
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa: string
  achievements: string[]
}

interface Certification {
  id: string
  name: string
  issuer: string
  date: string
  credentialId: string
  url: string
}

export interface DeveloperResumeData {
  personalInfo: PersonalInfo
  skills: TechnicalSkill[]
  experience: WorkExperience[]
  projects: Project[]
  education: Education[]
  certifications: Certification[]
  createdAt: string
  updatedAt: string
}

interface DeveloperResumeBuilderProps {
  userAddress?: string | null
  onBack?: () => void
  onSave?: (resumeId: string) => void
  existingResumeId?: string
}

// ============================================================
// CONSTANTS
// ============================================================

const STEPS = [
  { id: 'personal', name: 'Personal Info', Icon: User },
  { id: 'skills', name: 'Technical Skills', Icon: Code },
  { id: 'experience', name: 'Work Experience', Icon: Briefcase },
  { id: 'projects', name: 'Projects', Icon: Folder },
  { id: 'education', name: 'Education', Icon: GraduationCap },
  { id: 'review', name: 'Review & Export', Icon: FileCheck },
]

const SKILL_CATEGORIES: { value: TechnicalSkill['category']; label: string }[] =
  [
    { value: 'language', label: 'Languages' },
    { value: 'framework', label: 'Frameworks' },
    { value: 'database', label: 'Databases' },
    { value: 'cloud', label: 'Cloud & DevOps' },
    { value: 'tool', label: 'Tools' },
    { value: 'other', label: 'Other' },
  ]

const PROFICIENCY_LEVELS: {
  value: TechnicalSkill['proficiency']
  label: string
}[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]

const COMMON_SKILLS = {
  language: [
    'JavaScript',
    'TypeScript',
    'Python',
    'Java',
    'C#',
    'Go',
    'Rust',
    'Ruby',
    'PHP',
    'Swift',
    'Kotlin',
  ],
  framework: [
    'React',
    'Next.js',
    'Vue.js',
    'Angular',
    'Node.js',
    'Express',
    'Django',
    'Flask',
    'Spring Boot',
    'Rails',
  ],
  database: [
    'PostgreSQL',
    'MySQL',
    'MongoDB',
    'Redis',
    'Supabase',
    'Firebase',
    'DynamoDB',
    'SQLite',
  ],
  cloud: [
    'AWS',
    'Azure',
    'GCP',
    'Docker',
    'Kubernetes',
    'Vercel',
    'Netlify',
    'CI/CD',
    'Terraform',
  ],
  tool: [
    'Git',
    'GitHub',
    'VS Code',
    'Figma',
    'Jira',
    'Slack',
    'Postman',
    'Linux',
  ],
  other: [
    'REST APIs',
    'GraphQL',
    'WebSockets',
    'Agile',
    'TDD',
    'Microservices',
  ],
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const generateId = () => Math.random().toString(36).substring(2, 11)

const getInitialData = (): DeveloperResumeData => ({
  personalInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    headline: '',
    summary: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    personalWebsite: '',
  },
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DeveloperResumeBuilder({
  userAddress,
  onBack,
  onSave,
  existingResumeId,
}: DeveloperResumeBuilderProps) {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<DeveloperResumeData>(getInitialData())
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!existingResumeId)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [resumeId, setResumeId] = useState<string | null>(
    existingResumeId || null
  )
  const initialLoadRef = useRef(true)

  // Load existing resume or prefill from developer profile
  useEffect(() => {
    const loadData = async () => {
      if (!userAddress) return

      try {
        if (existingResumeId) {
          // Load existing resume
          const res = await fetch(`/api/resumes/${existingResumeId}`, {
            headers: { 'x-wallet-address': userAddress },
          })
          if (res.ok) {
            // GET /api/resumes/[id] returns the row at the top level (not { resume })
            const row = await res.json() as {
              id: string
              structured_data?: DeveloperResumeData | null
            }
            if (row.structured_data && typeof row.structured_data === 'object') {
              setData(row.structured_data as DeveloperResumeData)
              setResumeId(row.id)
            } else if (row.id) {
              setResumeId(row.id)
            }
          }
        } else {
          // Prefer latest saved developer resume (so hub tile opens real data without My Files → Edit)
          const listRes = await fetch('/api/developer/resume', {
            headers: { 'x-wallet-address': userAddress },
          })
          if (listRes.ok) {
            const listJson = await listRes.json()
            const rows = listJson.resumes as Array<{ id: string; structured_data?: DeveloperResumeData }> | undefined
            const latest = rows?.[0]
            if (latest?.structured_data && typeof latest.structured_data === 'object') {
              setData(latest.structured_data as DeveloperResumeData)
              setResumeId(latest.id)
              return
            }
          }

          // Prefill from developer hub profile when no resume row yet
          const res = await fetch('/api/developer/hub', {
            headers: { 'x-wallet-address': userAddress },
          })
          if (res.ok) {
            const { profile } = await res.json()
            if (profile) {
              setData((prev) => ({
                ...prev,
                personalInfo: {
                  ...prev.personalInfo,
                  firstName: profile.firstName || '',
                  lastName: profile.lastName || '',
                  email: profile.email || '',
                  phone: profile.phone || '',
                  location: profile.location || '',
                  headline: profile.headline || '',
                  summary: profile.bio || '',
                  githubUrl: profile.githubUsername
                    ? `https://github.com/${profile.githubUsername}`
                    : '',
                  linkedinUrl: profile.linkedinUrl || '',
                  portfolioUrl: profile.portfolioUrl || '',
                  personalWebsite: profile.personalWebsite || '',
                },
                skills: (profile.skills || []).map(
                  (s: string | { name: string }) => ({
                    id: generateId(),
                    name: typeof s === 'string' ? s : s.name,
                    category: 'other' as const,
                    proficiency: 'intermediate' as const,
                  })
                ),
              }))
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
        initialLoadRef.current = false
      }
    }

    loadData()
  }, [userAddress, existingResumeId])

  // Track unsaved changes
  useEffect(() => {
    if (!initialLoadRef.current) {
      setHasUnsavedChanges(true)
    }
  }, [data])

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Save resume
  const handleSave = useCallback(async () => {
    if (!userAddress) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const updatedData = { ...data, updatedAt: new Date().toISOString() }
      const method = resumeId ? 'PUT' : 'POST'
      const url = '/api/developer/resume'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          resumeId,
          structuredData: updatedData,
          title: `${data.personalInfo.firstName} ${data.personalInfo.lastName} - Developer Resume`,
        }),
      })

      const result = await res.json()

      if (res.ok) {
        setResumeId(result.resumeId)
        setHasUnsavedChanges(false)
        setSaveMessage({ type: 'success', text: 'Resume saved!' })
        if (onSave && result.resumeId) {
          onSave(result.resumeId)
        }
        void syncDriverHubFromApi(userAddress)
      } else {
        setSaveMessage({
          type: 'error',
          text: result.error || 'Failed to save',
        })
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save resume' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [userAddress, data, resumeId, onSave])

  // Quick fill with test data (only fills empty fields, like driver resume builder)
  const fillTestData = () => {
    setData((prev) => {
      const pi = prev.personalInfo
      return {
        ...prev,
        personalInfo: {
          firstName: pi.firstName || 'Alex',
          lastName: pi.lastName || 'Developer',
          email: pi.email || 'alex.developer@example.com',
          phone: pi.phone || '(555) 987-6543',
          location: pi.location || 'San Francisco, CA',
          headline:
            pi.headline || 'Senior Full-Stack Developer | React & Node.js',
          summary:
            pi.summary ||
            'Full-stack developer with 6+ years building scalable web apps. Strong in TypeScript, React, Node.js, and cloud platforms. Passionate about clean code and developer experience.',
          githubUrl: pi.githubUrl || 'https://github.com/alexdeveloper',
          linkedinUrl:
            pi.linkedinUrl || 'https://linkedin.com/in/alexdeveloper',
          portfolioUrl: pi.portfolioUrl || 'https://alexdeveloper.dev',
          personalWebsite: pi.personalWebsite || '',
        },
        skills:
          prev.skills.length > 0
            ? prev.skills
            : [
                {
                  id: generateId(),
                  name: 'TypeScript',
                  category: 'language',
                  proficiency: 'expert',
                },
                {
                  id: generateId(),
                  name: 'React',
                  category: 'framework',
                  proficiency: 'expert',
                },
                {
                  id: generateId(),
                  name: 'Node.js',
                  category: 'framework',
                  proficiency: 'advanced',
                },
                {
                  id: generateId(),
                  name: 'PostgreSQL',
                  category: 'database',
                  proficiency: 'advanced',
                },
                {
                  id: generateId(),
                  name: 'AWS',
                  category: 'cloud',
                  proficiency: 'intermediate',
                },
                {
                  id: generateId(),
                  name: 'Docker',
                  category: 'cloud',
                  proficiency: 'intermediate',
                },
                {
                  id: generateId(),
                  name: 'Git',
                  category: 'tool',
                  proficiency: 'expert',
                },
              ],
        experience:
          prev.experience.length > 0
            ? prev.experience
            : [
                {
                  id: generateId(),
                  company: 'TechCorp Inc.',
                  title: 'Senior Software Engineer',
                  location: 'San Francisco, CA (Remote)',
                  startDate: '2021-03',
                  endDate: '',
                  isCurrent: true,
                  description:
                    'Lead full-stack development for customer-facing products.',
                  achievements: [
                    'Shipped new billing platform, reducing support tickets by 40%',
                    'Mentored 3 junior developers; established code review standards',
                    'Reduced API latency by 30% via query optimization and caching',
                  ],
                  technologies: [
                    'React',
                    'TypeScript',
                    'Node.js',
                    'PostgreSQL',
                    'AWS',
                  ],
                },
                {
                  id: generateId(),
                  company: 'StartupXYZ',
                  title: 'Full-Stack Developer',
                  location: 'Austin, TX',
                  startDate: '2019-06',
                  endDate: '2021-02',
                  isCurrent: false,
                  description: 'Built and maintained core product features.',
                  achievements: [
                    'Developed real-time dashboard used by 10k+ daily active users',
                    'Integrated Stripe and reduced payment failures by 15%',
                  ],
                  technologies: ['Vue.js', 'Python', 'Django', 'Redis'],
                },
              ],
        projects:
          prev.projects.length > 0
            ? prev.projects
            : [
                {
                  id: generateId(),
                  name: 'Resume Wallet',
                  description:
                    'Portfolio and resume builder with blockchain verification.',
                  role: 'Creator',
                  technologies: [
                    'Next.js',
                    'TypeScript',
                    'Supabase',
                    'Tailwind',
                  ],
                  liveUrl: 'https://resumewallet.example.com',
                  repoUrl: 'https://github.com/alexdeveloper/resume-wallet',
                  highlights: [
                    'Open source, 500+ GitHub stars',
                    'Featured on Product Hunt',
                  ],
                },
              ],
        education:
          prev.education.length > 0
            ? prev.education
            : [
                {
                  id: generateId(),
                  institution: 'State University',
                  degree: 'B.S.',
                  field: 'Computer Science',
                  startDate: '2015-09',
                  endDate: '2019-05',
                  gpa: '3.8',
                  achievements: [],
                },
              ],
        certifications:
          prev.certifications.length > 0
            ? prev.certifications
            : [
                {
                  id: generateId(),
                  name: 'AWS Solutions Architect – Associate',
                  issuer: 'Amazon Web Services',
                  date: '2022-06',
                  credentialId: 'ABC123',
                  url: 'https://aws.amazon.com/verification',
                },
              ],
      }
    })
  }

  // Navigation
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0))

  // Styling helpers
  const inputClass = `w-full px-4 py-3 rounded-xl border transition-colors ${
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  } focus:outline-none focus:ring-2 focus:ring-teal-500/20`

  const labelClass = `block text-sm font-medium mb-2 ${
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  }`

  const cardClass = `p-4 rounded-xl border ${
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-gray-50 border-gray-200'
  }`

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
      </div>
    )
  }

  // ============================================================
  // STEP COMPONENTS
  // ============================================================

  const renderPersonalInfo = () => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label className={labelClass}>First Name *</label>
          <input
            type='text'
            className={inputClass}
            value={data.personalInfo.firstName}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, firstName: e.target.value },
              }))
            }
            placeholder='John'
          />
        </div>
        <div>
          <label className={labelClass}>Last Name *</label>
          <input
            type='text'
            className={inputClass}
            value={data.personalInfo.lastName}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, lastName: e.target.value },
              }))
            }
            placeholder='Doe'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label className={labelClass}>Email *</label>
          <input
            type='email'
            className={inputClass}
            value={data.personalInfo.email}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, email: e.target.value },
              }))
            }
            placeholder='john@example.com'
          />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <PhoneInput
            className={inputClass}
            value={data.personalInfo.phone}
            onChange={(value) =>
              setData((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, phone: value },
              }))
            }
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Location</label>
        <input
          type='text'
          className={inputClass}
          value={data.personalInfo.location}
          onChange={(e) =>
            setData((d) => ({
              ...d,
              personalInfo: { ...d.personalInfo, location: e.target.value },
            }))
          }
          placeholder='San Francisco, CA'
        />
      </div>

      <div>
        <label className={labelClass}>Professional Headline *</label>
        <input
          type='text'
          className={inputClass}
          value={data.personalInfo.headline}
          onChange={(e) =>
            setData((d) => ({
              ...d,
              personalInfo: { ...d.personalInfo, headline: e.target.value },
            }))
          }
          placeholder='Senior Full-Stack Developer | React & Node.js Expert'
        />
      </div>

      <div>
        <label className={labelClass}>Professional Summary</label>
        <textarea
          className={`${inputClass} min-h-[120px]`}
          value={data.personalInfo.summary}
          onChange={(e) =>
            setData((d) => ({
              ...d,
              personalInfo: { ...d.personalInfo, summary: e.target.value },
            }))
          }
          placeholder='Brief overview of your experience, skills, and what you bring to the table...'
        />
      </div>

      <div className='border-t border-gray-700 pt-6'>
        <h3
          className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          Online Presence
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className={labelClass}>
              <Github className='w-4 h-4 inline mr-1' /> GitHub URL
            </label>
            <input
              type='url'
              className={inputClass}
              value={data.personalInfo.githubUrl}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  personalInfo: {
                    ...d.personalInfo,
                    githubUrl: e.target.value,
                  },
                }))
              }
              placeholder='https://github.com/username'
            />
          </div>
          <div>
            <label className={labelClass}>LinkedIn URL</label>
            <input
              type='url'
              className={inputClass}
              value={data.personalInfo.linkedinUrl}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  personalInfo: {
                    ...d.personalInfo,
                    linkedinUrl: e.target.value,
                  },
                }))
              }
              placeholder='https://linkedin.com/in/username'
            />
          </div>
          <div>
            <label className={labelClass}>
              <Folder className='w-4 h-4 inline mr-1' /> Portfolio URL
            </label>
            <input
              type='url'
              className={inputClass}
              value={data.personalInfo.portfolioUrl}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  personalInfo: {
                    ...d.personalInfo,
                    portfolioUrl: e.target.value,
                  },
                }))
              }
              placeholder='https://portfolio.dev'
            />
          </div>
          <div>
            <label className={labelClass}>
              <Globe className='w-4 h-4 inline mr-1' /> Personal Website
            </label>
            <input
              type='url'
              className={inputClass}
              value={data.personalInfo.personalWebsite}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  personalInfo: {
                    ...d.personalInfo,
                    personalWebsite: e.target.value,
                  },
                }))
              }
              placeholder='https://johndoe.com'
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderSkills = () => {
    const addSkill = (name: string, category: TechnicalSkill['category']) => {
      if (data.skills.some((s) => s.name.toLowerCase() === name.toLowerCase()))
        return
      setData((d) => ({
        ...d,
        skills: [
          ...d.skills,
          { id: generateId(), name, category, proficiency: 'intermediate' },
        ],
      }))
    }

    const removeSkill = (id: string) => {
      setData((d) => ({ ...d, skills: d.skills.filter((s) => s.id !== id) }))
    }

    const updateSkill = (id: string, updates: Partial<TechnicalSkill>) => {
      setData((d) => ({
        ...d,
        skills: d.skills.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }))
    }

    return (
      <div className='space-y-6'>
        {/* Quick add common skills */}
        {SKILL_CATEGORIES.map(({ value, label }) => (
          <div key={value} className={cardClass}>
            <h3
              className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {label}
            </h3>
            <div className='flex flex-wrap gap-2'>
              {COMMON_SKILLS[value].map((skill) => {
                const isAdded = data.skills.some((s) => s.name === skill)
                return (
                  <button
                    key={skill}
                    onClick={() => !isAdded && addSkill(skill, value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      isAdded
                        ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/50'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    disabled={isAdded}
                  >
                    {isAdded && <Check className='w-3 h-3 inline mr-1' />}
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Added skills with proficiency */}
        {data.skills.length > 0 && (
          <div className={cardClass}>
            <h3
              className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Your Skills ({data.skills.length})
            </h3>
            <div className='space-y-2'>
              {data.skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-white'
                  }`}
                >
                  <span
                    className={
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }
                  >
                    {skill.name}
                  </span>
                  <div className='flex items-center gap-2'>
                    <select
                      value={skill.proficiency}
                      onChange={(e) =>
                        updateSkill(skill.id, {
                          proficiency: e.target
                            .value as TechnicalSkill['proficiency'],
                        })
                      }
                      className={`text-sm px-2 py-1 rounded border ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-600 text-gray-300'
                          : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      {PROFICIENCY_LEVELS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeSkill(skill.id)}
                      className='p-1 text-red-400 hover:text-red-300'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom skill input */}
        <div className={cardClass}>
          <h3
            className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Add Custom Skill
          </h3>
          <div className='flex gap-2'>
            <input
              type='text'
              className={`${inputClass} flex-1`}
              placeholder='Enter skill name...'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  addSkill(e.currentTarget.value.trim(), 'other')
                  e.currentTarget.value = ''
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget
                  .previousSibling as HTMLInputElement
                if (input.value.trim()) {
                  addSkill(input.value.trim(), 'other')
                  input.value = ''
                }
              }}
              className='px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-500'
            >
              <Plus className='w-5 h-5' />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderExperience = () => {
    const addExperience = () => {
      setData((d) => ({
        ...d,
        experience: [
          ...d.experience,
          {
            id: generateId(),
            company: '',
            title: '',
            location: '',
            startDate: '',
            endDate: '',
            isCurrent: false,
            description: '',
            achievements: [''],
            technologies: [],
          },
        ],
      }))
    }

    const removeExperience = (id: string) => {
      setData((d) => ({
        ...d,
        experience: d.experience.filter((e) => e.id !== id),
      }))
    }

    const updateExperience = (id: string, updates: Partial<WorkExperience>) => {
      setData((d) => ({
        ...d,
        experience: d.experience.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }))
    }

    return (
      <div className='space-y-6'>
        {data.experience.map((exp, idx) => (
          <div key={exp.id} className={cardClass}>
            <div className='flex items-center justify-between mb-4'>
              <h3
                className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Experience {idx + 1}
              </h3>
              <button
                onClick={() => removeExperience(exp.id)}
                className='p-1 text-red-400 hover:text-red-300'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className={labelClass}>Company *</label>
                  <input
                    type='text'
                    className={inputClass}
                    value={exp.company}
                    onChange={(e) =>
                      updateExperience(exp.id, { company: e.target.value })
                    }
                    placeholder='Company Name'
                  />
                </div>
                <div>
                  <label className={labelClass}>Job Title *</label>
                  <input
                    type='text'
                    className={inputClass}
                    value={exp.title}
                    onChange={(e) =>
                      updateExperience(exp.id, { title: e.target.value })
                    }
                    placeholder='Senior Software Engineer'
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Location</label>
                <input
                  type='text'
                  className={inputClass}
                  value={exp.location}
                  onChange={(e) =>
                    updateExperience(exp.id, { location: e.target.value })
                  }
                  placeholder='San Francisco, CA (Remote)'
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div>
                  <label className={labelClass}>Start Date</label>
                  <input
                    type='month'
                    className={inputClass}
                    value={exp.startDate}
                    onChange={(e) =>
                      updateExperience(exp.id, { startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>End Date</label>
                  <input
                    type='month'
                    className={inputClass}
                    value={exp.endDate}
                    onChange={(e) =>
                      updateExperience(exp.id, { endDate: e.target.value })
                    }
                    disabled={exp.isCurrent}
                  />
                </div>
                <div className='flex items-end pb-3'>
                  <label className='flex items-center gap-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={exp.isCurrent}
                      onChange={(e) =>
                        updateExperience(exp.id, {
                          isCurrent: e.target.checked,
                          endDate: e.target.checked ? '' : exp.endDate,
                        })
                      }
                      className='w-4 h-4 rounded border-gray-600 text-teal-600 dark:text-teal-400 focus:ring-teal-500'
                    />
                    <span
                      className={
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }
                    >
                      Current Job
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={exp.description}
                  onChange={(e) =>
                    updateExperience(exp.id, { description: e.target.value })
                  }
                  placeholder='Brief description of your role and responsibilities...'
                />
              </div>

              <div>
                <label className={labelClass}>Key Achievements</label>
                {exp.achievements.map((achievement, aIdx) => (
                  <div key={aIdx} className='flex gap-2 mb-2'>
                    <input
                      type='text'
                      className={`${inputClass} flex-1`}
                      value={achievement}
                      onChange={(e) => {
                        const newAchievements = [...exp.achievements]
                        newAchievements[aIdx] = e.target.value
                        updateExperience(exp.id, {
                          achievements: newAchievements,
                        })
                      }}
                      placeholder='• Led migration to microservices, reducing latency by 40%'
                    />
                    {exp.achievements.length > 1 && (
                      <button
                        onClick={() => {
                          const newAchievements = exp.achievements.filter(
                            (_, i) => i !== aIdx
                          )
                          updateExperience(exp.id, {
                            achievements: newAchievements,
                          })
                        }}
                        className='p-2 text-red-400 hover:text-red-300'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateExperience(exp.id, {
                      achievements: [...exp.achievements, ''],
                    })
                  }
                  className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                >
                  <Plus className='w-4 h-4' /> Add Achievement
                </button>
              </div>

              <div>
                <label className={labelClass}>Technologies Used</label>
                <input
                  type='text'
                  className={inputClass}
                  value={exp.technologies.join(', ')}
                  onChange={(e) =>
                    updateExperience(exp.id, {
                      technologies: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder='React, Node.js, PostgreSQL, AWS (comma-separated)'
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addExperience}
          className={`w-full p-4 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
              : 'border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
          }`}
        >
          <Plus className='w-5 h-5' />
          Add Work Experience
        </button>
      </div>
    )
  }

  const renderProjects = () => {
    const addProject = () => {
      setData((d) => ({
        ...d,
        projects: [
          ...d.projects,
          {
            id: generateId(),
            name: '',
            description: '',
            role: '',
            technologies: [],
            liveUrl: '',
            repoUrl: '',
            highlights: [''],
          },
        ],
      }))
    }

    const removeProject = (id: string) => {
      setData((d) => ({
        ...d,
        projects: d.projects.filter((p) => p.id !== id),
      }))
    }

    const updateProject = (id: string, updates: Partial<Project>) => {
      setData((d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }))
    }

    return (
      <div className='space-y-6'>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Showcase your best work — personal projects, open source
          contributions, or side projects that demonstrate your skills.
        </p>

        {data.projects.map((project, idx) => (
          <div key={project.id} className={cardClass}>
            <div className='flex items-center justify-between mb-4'>
              <h3
                className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Project {idx + 1}
              </h3>
              <button
                onClick={() => removeProject(project.id)}
                className='p-1 text-red-400 hover:text-red-300'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className={labelClass}>Project Name *</label>
                  <input
                    type='text'
                    className={inputClass}
                    value={project.name}
                    onChange={(e) =>
                      updateProject(project.id, { name: e.target.value })
                    }
                    placeholder='My Awesome Project'
                  />
                </div>
                <div>
                  <label className={labelClass}>Your Role</label>
                  <input
                    type='text'
                    className={inputClass}
                    value={project.role}
                    onChange={(e) =>
                      updateProject(project.id, { role: e.target.value })
                    }
                    placeholder='Creator / Lead Developer / Contributor'
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={project.description}
                  onChange={(e) =>
                    updateProject(project.id, { description: e.target.value })
                  }
                  placeholder='What does this project do? What problem does it solve?'
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className={labelClass}>
                    <Globe className='w-4 h-4 inline mr-1' /> Live URL
                  </label>
                  <input
                    type='url'
                    className={inputClass}
                    value={project.liveUrl}
                    onChange={(e) =>
                      updateProject(project.id, { liveUrl: e.target.value })
                    }
                    placeholder='https://myproject.com'
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <Github className='w-4 h-4 inline mr-1' /> Repository URL
                  </label>
                  <input
                    type='url'
                    className={inputClass}
                    value={project.repoUrl}
                    onChange={(e) =>
                      updateProject(project.id, { repoUrl: e.target.value })
                    }
                    placeholder='https://github.com/user/repo'
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Technologies Used</label>
                <input
                  type='text'
                  className={inputClass}
                  value={project.technologies.join(', ')}
                  onChange={(e) =>
                    updateProject(project.id, {
                      technologies: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder='Next.js, TypeScript, Supabase, Tailwind (comma-separated)'
                />
              </div>

              <div>
                <label className={labelClass}>Key Highlights</label>
                {project.highlights.map((highlight, hIdx) => (
                  <div key={hIdx} className='flex gap-2 mb-2'>
                    <input
                      type='text'
                      className={`${inputClass} flex-1`}
                      value={highlight}
                      onChange={(e) => {
                        const newHighlights = [...project.highlights]
                        newHighlights[hIdx] = e.target.value
                        updateProject(project.id, { highlights: newHighlights })
                      }}
                      placeholder='• 10,000+ users, featured on Product Hunt'
                    />
                    {project.highlights.length > 1 && (
                      <button
                        onClick={() => {
                          const newHighlights = project.highlights.filter(
                            (_, i) => i !== hIdx
                          )
                          updateProject(project.id, {
                            highlights: newHighlights,
                          })
                        }}
                        className='p-2 text-red-400 hover:text-red-300'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateProject(project.id, {
                      highlights: [...project.highlights, ''],
                    })
                  }
                  className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                >
                  <Plus className='w-4 h-4' /> Add Highlight
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addProject}
          className={`w-full p-4 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
            theme === 'dark'
              ? 'border-gray-700 text-gray-400 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
              : 'border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
          }`}
        >
          <Plus className='w-5 h-5' />
          Add Project
        </button>
      </div>
    )
  }

  const renderEducation = () => {
    const addEducation = () => {
      setData((d) => ({
        ...d,
        education: [
          ...d.education,
          {
            id: generateId(),
            institution: '',
            degree: '',
            field: '',
            startDate: '',
            endDate: '',
            gpa: '',
            achievements: [],
          },
        ],
      }))
    }

    const removeEducation = (id: string) => {
      setData((d) => ({
        ...d,
        education: d.education.filter((e) => e.id !== id),
      }))
    }

    const updateEducation = (id: string, updates: Partial<Education>) => {
      setData((d) => ({
        ...d,
        education: d.education.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }))
    }

    const addCertification = () => {
      setData((d) => ({
        ...d,
        certifications: [
          ...d.certifications,
          {
            id: generateId(),
            name: '',
            issuer: '',
            date: '',
            credentialId: '',
            url: '',
          },
        ],
      }))
    }

    const removeCertification = (id: string) => {
      setData((d) => ({
        ...d,
        certifications: d.certifications.filter((c) => c.id !== id),
      }))
    }

    const updateCertification = (
      id: string,
      updates: Partial<Certification>
    ) => {
      setData((d) => ({
        ...d,
        certifications: d.certifications.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }))
    }

    return (
      <div className='space-y-8'>
        {/* Education Section */}
        <div>
          <h3
            className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Education
          </h3>

          {data.education.map((edu, idx) => (
            <div key={edu.id} className={`${cardClass} mb-4`}>
              <div className='flex items-center justify-between mb-4'>
                <h4
                  className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  Education {idx + 1}
                </h4>
                <button
                  onClick={() => removeEducation(edu.id)}
                  className='p-1 text-red-400 hover:text-red-300'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              <div className='space-y-4'>
                <div>
                  <label className={labelClass}>Institution *</label>
                  <input
                    type='text'
                    className={inputClass}
                    value={edu.institution}
                    onChange={(e) =>
                      updateEducation(edu.id, { institution: e.target.value })
                    }
                    placeholder='University / Bootcamp / School'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className={labelClass}>Degree</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={edu.degree}
                      onChange={(e) =>
                        updateEducation(edu.id, { degree: e.target.value })
                      }
                      placeholder='B.S. / M.S. / Certificate'
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Field of Study</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={edu.field}
                      onChange={(e) =>
                        updateEducation(edu.id, { field: e.target.value })
                      }
                      placeholder='Computer Science'
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input
                      type='month'
                      className={inputClass}
                      value={edu.startDate}
                      onChange={(e) =>
                        updateEducation(edu.id, { startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input
                      type='month'
                      className={inputClass}
                      value={edu.endDate}
                      onChange={(e) =>
                        updateEducation(edu.id, { endDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>GPA (optional)</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={edu.gpa}
                      onChange={(e) =>
                        updateEducation(edu.id, { gpa: e.target.value })
                      }
                      placeholder='3.8 / 4.0'
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addEducation}
            className={`w-full p-4 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
              theme === 'dark'
                ? 'border-gray-700 text-gray-400 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
                : 'border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
            }`}
          >
            <Plus className='w-5 h-5' />
            Add Education
          </button>
        </div>

        {/* Certifications Section */}
        <div>
          <h3
            className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Certifications
          </h3>

          {data.certifications.map((cert, idx) => (
            <div key={cert.id} className={`${cardClass} mb-4`}>
              <div className='flex items-center justify-between mb-4'>
                <h4
                  className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  Certification {idx + 1}
                </h4>
                <button
                  onClick={() => removeCertification(cert.id)}
                  className='p-1 text-red-400 hover:text-red-300'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              <div className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className={labelClass}>Certification Name *</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={cert.name}
                      onChange={(e) =>
                        updateCertification(cert.id, { name: e.target.value })
                      }
                      placeholder='AWS Solutions Architect'
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Issuing Organization</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={cert.issuer}
                      onChange={(e) =>
                        updateCertification(cert.id, { issuer: e.target.value })
                      }
                      placeholder='Amazon Web Services'
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <label className={labelClass}>Date Issued</label>
                    <input
                      type='month'
                      className={inputClass}
                      value={cert.date}
                      onChange={(e) =>
                        updateCertification(cert.id, { date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Credential ID</label>
                    <input
                      type='text'
                      className={inputClass}
                      value={cert.credentialId}
                      onChange={(e) =>
                        updateCertification(cert.id, {
                          credentialId: e.target.value,
                        })
                      }
                      placeholder='ABC123XYZ'
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Verification URL</label>
                    <input
                      type='url'
                      className={inputClass}
                      value={cert.url}
                      onChange={(e) =>
                        updateCertification(cert.id, { url: e.target.value })
                      }
                      placeholder='https://verify.cert.com/...'
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addCertification}
            className={`w-full p-4 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
              theme === 'dark'
                ? 'border-gray-700 text-gray-400 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
                : 'border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:text-teal-400'
            }`}
          >
            <Plus className='w-5 h-5' />
            Add Certification
          </button>
        </div>
      </div>
    )
  }

  const renderReview = () => {
    const {
      personalInfo,
      skills,
      experience,
      projects,
      education,
      certifications,
    } = data

    const sectionClass = `mb-6 ${cardClass}`
    const sectionTitleClass = `text-lg font-semibold mb-3 flex items-center gap-2 ${
      theme === 'dark' ? 'text-white' : 'text-gray-900'
    }`

    return (
      <div className='space-y-6'>
        {/* Personal Info */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>
            <User className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Personal Information
          </h3>
          <div className='space-y-2'>
            <p
              className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {personalInfo.firstName} {personalInfo.lastName}
            </p>
            {personalInfo.headline && (
              <p
                className={
                  theme === 'dark' ? 'text-teal-600 dark:text-teal-400' : 'text-teal-600 dark:text-teal-400'
                }
              >
                {personalInfo.headline}
              </p>
            )}
            <div
              className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {personalInfo.email && <p>{personalInfo.email}</p>}
              {personalInfo.phone && <p>{personalInfo.phone}</p>}
              {personalInfo.location && <p>{personalInfo.location}</p>}
            </div>
            {personalInfo.summary && (
              <p
                className={`mt-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {personalInfo.summary}
              </p>
            )}
            {/* Links */}
            <div className='flex flex-wrap gap-3 mt-3'>
              {personalInfo.githubUrl && (
                <a
                  href={personalInfo.githubUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                >
                  <Github className='w-4 h-4' /> GitHub
                </a>
              )}
              {personalInfo.linkedinUrl && (
                <a
                  href={personalInfo.linkedinUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                >
                  <ExternalLink className='w-4 h-4' /> LinkedIn
                </a>
              )}
              {personalInfo.portfolioUrl && (
                <a
                  href={personalInfo.portfolioUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                >
                  <Folder className='w-4 h-4' /> Portfolio
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <Code className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Technical Skills
            </h3>
            <div className='flex flex-wrap gap-2'>
              {skills.map((skill) => (
                <span
                  key={skill.id}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {skill.name}
                  <span className='ml-1 text-xs opacity-60'>
                    ({skill.proficiency})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <Briefcase className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Work Experience
            </h3>
            <div className='space-y-4'>
              {experience.map((exp) => (
                <div
                  key={exp.id}
                  className='border-l-2 border-teal-500/30 pl-4'
                >
                  <p
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {exp.title}
                  </p>
                  <p
                    className={
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }
                  >
                    {exp.company} {exp.location && `• ${exp.location}`}
                  </p>
                  <p
                    className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                  >
                    {exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate}
                  </p>
                  {exp.description && (
                    <p
                      className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {exp.description}
                    </p>
                  )}
                  {exp.achievements.filter(Boolean).length > 0 && (
                    <ul
                      className={`mt-2 text-sm list-disc list-inside ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {exp.achievements.filter(Boolean).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {exp.technologies.length > 0 && (
                    <p
                      className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                    >
                      Tech: {exp.technologies.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <Folder className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Projects
            </h3>
            <div className='space-y-4'>
              {projects.map((project) => (
                <div
                  key={project.id}
                  className='border-l-2 border-teal-500/30 pl-4'
                >
                  <p
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {project.name}
                    {project.role && (
                      <span className='font-normal text-sm ml-2'>
                        ({project.role})
                      </span>
                    )}
                  </p>
                  {project.description && (
                    <p
                      className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {project.description}
                    </p>
                  )}
                  <div className='flex gap-3 mt-2'>
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                      >
                        <Globe className='w-3 h-3' /> Live
                      </a>
                    )}
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                      >
                        <Github className='w-3 h-3' /> Repo
                      </a>
                    )}
                  </div>
                  {project.technologies.length > 0 && (
                    <p
                      className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                    >
                      Tech: {project.technologies.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {education.length > 0 && (
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <GraduationCap className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Education
            </h3>
            <div className='space-y-3'>
              {education.map((edu) => (
                <div key={edu.id}>
                  <p
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {edu.degree} {edu.field && `in ${edu.field}`}
                  </p>
                  <p
                    className={
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }
                  >
                    {edu.institution}
                  </p>
                  <p
                    className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                  >
                    {edu.startDate} - {edu.endDate}{' '}
                    {edu.gpa && `• GPA: ${edu.gpa}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <FileCheck className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Certifications
            </h3>
            <div className='space-y-2'>
              {certifications.map((cert) => (
                <div
                  key={cert.id}
                  className='flex items-center justify-between'
                >
                  <div>
                    <p
                      className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      {cert.name}
                    </p>
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      {cert.issuer} {cert.date && `• ${cert.date}`}
                    </p>
                  </div>
                  {cert.url && (
                    <a
                      href={cert.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-sm text-teal-600 dark:text-teal-400 hover:underline'
                    >
                      Verify
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'personal':
        return renderPersonalInfo()
      case 'skills':
        return renderSkills()
      case 'experience':
        return renderExperience()
      case 'projects':
        return renderProjects()
      case 'education':
        return renderEducation()
      case 'review':
        return renderReview()
      default:
        return null
    }
  }

  return (
    <div
      className={`h-full flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      {/* Header - fixed at top, no scroll */}
      <div
        className={`flex-shrink-0 z-10 border-b ${
          theme === 'dark'
            ? 'bg-gray-900/95 border-gray-800'
            : 'bg-white/95 border-gray-200'
        } backdrop-blur-sm`}
      >
        <div className='max-w-4xl mx-auto px-4 py-4'>
          <div className='flex items-center justify-between'>
            <BackToHubButton onClick={onBack} />

            <div className='flex items-center gap-3'>
              {saveMessage && (
                <span
                  className={`text-sm ${
                    saveMessage.type === 'success'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {saveMessage.text}
                </span>
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
                className='flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-500 disabled:opacity-50'
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

      {/* Scrollable form area - only this section scrolls */}
      <div className='flex-1 min-h-0 overflow-y-auto'>
        <div className='max-w-4xl mx-auto px-4 py-6'>
          <div className='flex items-center justify-between mb-8 overflow-x-auto pb-2'>
            {STEPS.map((step, idx) => {
              const Icon = step.Icon
              const isActive = idx === currentStep
              const isCompleted = idx < currentStep

              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex flex-col items-center min-w-[80px] ${
                    isActive
                      ? 'text-teal-600 dark:text-teal-400'
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
                        ? 'bg-teal-600/20 border-2 border-teal-500'
                        : isCompleted
                          ? 'bg-teal-600/10 border border-teal-500/50'
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

          {/* Step Content */}
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
              onClick={goBack}
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
                onClick={goNext}
                className='flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-500'
              >
                Next
                <ArrowRight className='w-5 h-5' />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-500 disabled:opacity-50'
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
