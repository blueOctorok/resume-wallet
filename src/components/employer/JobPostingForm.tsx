'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Loader2,
  CheckCircle,
  Car,
  Code,
  Warehouse,
  Users,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'

interface JobPostingFormProps {
  walletAddress: string
  onBack: () => void
  onSuccess?: () => void
}

const JOB_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
]

const TARGET_ROLES = [
  { value: 'driver', label: 'Driver', icon: Car },
  { value: 'developer', label: 'Developer', icon: Code },
  { value: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { value: 'other', label: 'Other', icon: Users },
]

const ROUTE_TYPES = [
  { value: 'long-haul', label: 'Long Haul (OTR)' },
  { value: 'regional', label: 'Regional' },
  { value: 'local', label: 'Local' },
  { value: 'dedicated', label: 'Dedicated' },
]

const EXPERIENCE_LEVELS = [
  { value: '0-1', label: 'Entry (0-1 years)' },
  { value: '1-3', label: 'Junior (1-3 years)' },
  { value: '3-5', label: 'Mid (3-5 years)' },
  { value: '5+', label: 'Senior (5+ years)' },
]

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export default function JobPostingForm({
  walletAddress,
  onBack,
  onSuccess,
}: JobPostingFormProps) {
  const { theme } = useTheme()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [targetRole, setTargetRole] = useState('driver')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [jobType, setJobType] = useState('full-time')
  const [routeType, setRouteType] = useState('')
  const [experienceRequired, setExperienceRequired] = useState('')
  const [remoteAllowed, setRemoteAllowed] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Job title is required')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/employer/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          requirements,
          targetRole,
          locationCity,
          locationState,
          salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
          salaryMax: salaryMax ? parseInt(salaryMax, 10) : null,
          jobType,
          routeType: targetRole === 'driver' ? routeType : null,
          experienceRequired,
          remoteAllowed: targetRole === 'developer' ? remoteAllowed : false,
          isActive: true,
        }),
      })

      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create job')
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onBack()
      }, 1500)
    } catch (err) {
      console.error('Error creating job:', err)
      setError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border transition-colors ${
    isDarkTheme(theme)
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'
  } focus:outline-none focus:ring-1 focus:ring-teal-500`

  const labelClass = `block text-sm font-medium mb-2 ${
    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
  }`

  if (success) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-12'>
        <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
          <BlockCard
            variant='embed'
            icon={CheckCircle}
            title='Job posted'
            description='Your listing is live — candidates can apply from Find Talent and your pipeline.'
          >
            <div className='flex justify-center py-4'>
              <div className='flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20'>
                <CheckCircle className='h-8 w-8 text-green-500' />
              </div>
            </div>
          </BlockCard>
        </HubSectionPanel>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      {/* Back button */}
      <div className='mb-6'>
        <BackToHubButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className='mb-8'>
        <h1 className={`text-2xl font-bold ${
          isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
        }`}>
          Post a New Job
        </h1>
        <p className={`mt-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
          Create a job posting to attract qualified candidates
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
          <BlockCard variant='embed' icon={Users} title='Role type' description='What kind of hire is this?'>
          <label className={labelClass}>Select role category</label>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {TARGET_ROLES.map(role => {
              const Icon = role.icon
              const isSelected = targetRole === role.value
              return (
                <button
                  key={role.value}
                  type='button'
                  onClick={() => setTargetRole(role.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500/10'
                      : isDarkTheme(theme)
                        ? 'border-gray-700 hover:border-gray-600'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${
                    isSelected ? 'text-teal-500' : isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    isSelected
                      ? 'text-teal-500'
                      : isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {role.label}
                  </span>
                </button>
              )
            })}
          </div>
          </BlockCard>
        </HubSectionPanel>

        <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
          <BlockCard variant='embed' icon={Briefcase} title='Job details' description='Title, description, and employment basics.'>
          <div className='space-y-4'>
            <div>
              <label className={labelClass}>Job Title *</label>
              <input
                type='text'
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={targetRole === 'driver' ? 'e.g., OTR Truck Driver' : 'e.g., Full Stack Developer'}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='Describe the role, responsibilities, and what makes it great...'
                rows={4}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Requirements</label>
              <textarea
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder='List qualifications, certifications, or skills required...'
                rows={3}
                className={inputClass}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={labelClass}>Job Type</label>
                <select
                  value={jobType}
                  onChange={e => setJobType(e.target.value)}
                  className={inputClass}
                >
                  {JOB_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Experience Level</label>
                <select
                  value={experienceRequired}
                  onChange={e => setExperienceRequired(e.target.value)}
                  className={inputClass}
                >
                  <option value=''>Any experience</option>
                  {EXPERIENCE_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          </BlockCard>
        </HubSectionPanel>

        {targetRole === 'driver' && (
          <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
            <BlockCard variant='embed' icon={Car} title='Driver details' description='Route type for CDL and logistics roles.'>
            <div>
              <label className={labelClass}>Route Type</label>
              <select
                value={routeType}
                onChange={e => setRouteType(e.target.value)}
                className={inputClass}
              >
                <option value=''>Select route type</option>
                {ROUTE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            </BlockCard>
          </HubSectionPanel>
        )}

        {targetRole === 'developer' && (
          <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
            <BlockCard variant='embed' icon={Code} title='Developer details' description='Remote policy for tech roles.'>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={remoteAllowed}
                onChange={e => setRemoteAllowed(e.target.checked)}
                className='w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500'
              />
              <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                Remote work allowed
              </span>
            </label>
            </BlockCard>
          </HubSectionPanel>
        )}

        <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
          <BlockCard variant='embed' icon={MapPin} title='Location' description='Where the role is based.'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={labelClass}>City</label>
              <input
                type='text'
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                placeholder='e.g., Columbus'
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <select
                value={locationState}
                onChange={e => setLocationState(e.target.value)}
                className={inputClass}
              >
                <option value=''>Select state</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>
          </BlockCard>
        </HubSectionPanel>

        <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal'>
          <BlockCard variant='embed' icon={DollarSign} title='Compensation' description='Optional salary band — shown to candidates when set.'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={labelClass}>Salary Min ($/year)</label>
              <input
                type='number'
                value={salaryMin}
                onChange={e => setSalaryMin(e.target.value)}
                placeholder='e.g., 50000'
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Salary Max ($/year)</label>
              <input
                type='number'
                value={salaryMax}
                onChange={e => setSalaryMax(e.target.value)}
                placeholder='e.g., 75000'
                className={inputClass}
              />
            </div>
          </div>
          <p className={`mt-2 text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
            Leave blank if you prefer not to disclose salary range
          </p>
          </BlockCard>
        </HubSectionPanel>

        {/* Error */}
        {error && (
          <div className='p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div className='flex gap-4'>
          <Button type='button' variant='secondary' size='md' className='flex-1' onClick={onBack}>
            Cancel
          </Button>
          <Button
            type='submit'
            variant='primary'
            size='md'
            className='flex-1'
            disabled={submitting || !title.trim()}
            isLoading={submitting}
          >
            <>
              <Briefcase className='h-5 w-5' />
              Post job
            </>
          </Button>
        </div>
      </form>
    </div>
  )
}
