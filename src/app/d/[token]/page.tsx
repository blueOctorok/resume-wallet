'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import {
  User,
  MapPin,
  Award,
  FileText,
  ClipboardCheck,
  Car,
  CheckCircle,
  Shield,
  Briefcase,
  ExternalLink,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Send,
  Sparkles,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react'

// Types for the public profile data
interface PublicProfile {
  id: string
  firstName: string
  lastName: string
  location: string | null
  summary: string | null
  experienceYears: number | null
  cdl: {
    class: string | null
    state: string | null
    expiration: string | null
    endorsements: string[]
  }
  contact?: {
    email: string | null
    phone: string | null
  }
}

/** Driver resume structured_data (builder or extracted) */
interface DriverResumeStructuredData {
  personalInfo?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    professionalSummary?: string
  }
  cdlInfo?: {
    cdlClass?: string
    cdlState?: string
    expirationDate?: string
    endorsements?: string[]
    restrictions?: string[]
  }
  employments?: Array<{
    companyName?: string
    position?: string
    location?: string
    startDate?: string
    endDate?: string
    isCurrent?: boolean
    responsibilities?: string[]
  }>
  educations?: Array<{
    school?: string
    degree?: string
    field?: string
    year?: string
    certifications?: string[]
  }>
  skills?: string[] | Array<{ name?: string; category?: string }>
  references?: Array<{
    name?: string
    title?: string
    company?: string
    phone?: string
    email?: string
    relationship?: string
  }>
}

interface Resume {
  id: string
  title: string
  filename: string
  verified: boolean
  blockchainVerified: boolean
  type: string
  createdAt: string
  documentUrl?: string | null
  ipfsHash: string
  structuredData?: DriverResumeStructuredData
}


interface DotApp {
  id: string
  verified: boolean
  blockchainVerified: boolean
  isComplete: boolean
  completionPercentage: number
  createdAt: string
}

interface Mvr {
  licenseStatus: string
  totalPoints: number | null
  violationCount: number
  lastOrdered: string | null
  status: 'clean' | 'valid_with_violations' | 'review_needed'
}

interface EmploymentEntry {
  company: string
  position: string
  startDate: string
  endDate: string
}

/** Only jobs verified via the email verification flow (employer responded). */
interface VerifiedEmploymentEntry {
  companyName: string
  position: string
  startDate: string | null
  endDate: string | null
  status: string
}

interface ProfileData {
  success: boolean
  profile: PublicProfile
  resume: Resume | null
  dotApp: DotApp | null
  mvr: Mvr | null
  employmentSummary: EmploymentEntry[] | null
  verifiedEmployments?: VerifiedEmploymentEntry[] | null
  settings: {
    allowConnect: boolean
  }
  viewCount: number
}

export default function PublicDriverProfile() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Connect form state
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [connectForm, setConnectForm] = useState({
    employerName: '',
    employerEmail: '',
    employerPhone: '',
    employerCompanyName: '',
    eventName: '',
    notes: '',
  })
  const [connecting, setConnecting] = useState(false)
  const [connectSuccess, setConnectSuccess] = useState(false)

  useEffect(() => {
    if (token) fetchProfile()
  }, [token])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/driver/public/${token}`, { cache: 'no-store' })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Profile not found or sharing is disabled')
        } else {
          setError('Failed to load profile')
        }
        return
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connectForm.employerEmail && !connectForm.employerPhone) {
      alert('Please provide email or phone number')
      return
    }

    try {
      setConnecting(true)

      const response = await fetch(`/api/driver/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectForm,
          source: 'qr_scan',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send connection request')
      }

      setConnectSuccess(true)
      setShowConnectForm(false)
    } catch (err) {
      console.error('Error connecting:', err)
      alert('Failed to send connection request. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 animate-spin text-indigo-400 mx-auto mb-4' />
          <p className='text-gray-400'>Loading Career Card...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4'>
        <div className='text-center max-w-md'>
          <AlertCircle className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-white mb-2'>
            Profile Not Found
          </h1>
          <p className='text-gray-400 mb-6'>
            {error ||
              'This profile may have been removed or the link is invalid.'}
          </p>
          <a
            href='/'
            className='inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-500 transition-colors'
          >
            Go to Storm
          </a>
        </div>
      </div>
    )
  }

  const { profile, resume, dotApp, mvr, employmentSummary, verifiedEmployments, settings } = data
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Driver'
  const endorsements = profile.cdl.endorsements ?? []

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'>
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl' />
      </div>

      <header className='border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-20'>
        <div className='max-w-4xl mx-auto px-4 py-4 flex items-center justify-between'>
          <a href='/' className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-600/20'>
              <span className='text-gray-900 font-bold text-sm'>S</span>
            </div>
            <span className='text-white font-semibold'>Storm</span>
          </a>
          <div className='flex items-center gap-2'>
            <Sparkles className='w-4 h-4 text-teal-600 dark:text-teal-400' />
            <span className='text-xs text-gray-400'>Career Card</span>
          </div>
        </div>
      </header>

      <main className='max-w-4xl mx-auto px-4 py-8 relative z-10'>
        {/* Hero Profile Card */}
        <div className='bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden mb-8 shadow-2xl'>
          <div className='h-1 bg-gradient-to-r from-teal-600 via-teal-400 to-emerald-500' />
          <div className='p-8'>
            <div className='flex flex-col sm:flex-row items-start gap-6'>
              <div className='relative'>
                <div className='absolute inset-0 bg-teal-600/30 rounded-2xl blur-xl' />
                <div className='relative w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-400 to-emerald-500 flex items-center justify-center shadow-xl'>
                  <span className='text-4xl font-bold text-gray-900'>
                    {profile.firstName?.[0] ?? 'D'}
                    {profile.lastName?.[0] ?? ''}
                  </span>
                </div>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h1 className='text-3xl font-bold text-white'>{displayName}</h1>
                    {profile.summary && (
                      <p className='text-lg text-teal-600 dark:text-teal-400 font-medium mt-1 line-clamp-2'>
                        {profile.summary.split('\n')[0]?.slice(0, 80) || 'Professional Driver'}
                      </p>
                    )}
                    {!profile.summary && (
                      <p className='text-lg text-teal-600 dark:text-teal-400 font-medium mt-1'>Professional Driver</p>
                    )}
                  </div>
                  <div className='flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm border border-green-500/30'>
                    <CheckCircle className='w-4 h-4' />
                    Verified
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-4 mt-3 text-gray-400'>
                  {profile.location && (
                    <span className='flex items-center gap-1.5'>
                      <MapPin className='w-4 h-4' />
                      {profile.location}
                    </span>
                  )}
                  {profile.experienceYears != null && (
                    <span className='flex items-center gap-1.5'>
                      <Briefcase className='w-4 h-4' />
                      {profile.experienceYears}+ years
                    </span>
                  )}
                </div>
                {profile.summary && (
                  <p className='mt-4 text-gray-300 leading-relaxed'>{profile.summary}</p>
                )}
              </div>
            </div>
            {/* Quick Links */}
            <div className='flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-700/50'>
              {resume?.documentUrl && !resume.ipfsHash?.startsWith('built_') && (
                <a
                  href={resume.documentUrl ?? '#'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400 transition-all hover:scale-105 border border-green-500/30'
                >
                  <FileText className='w-4 h-4' />
                  View Resume
                  {resume.blockchainVerified && <CheckCircle className='w-3 h-3' />}
                </a>
              )}
              {profile.contact?.email && (
                <a
                  href={`mailto:${profile.contact.email}`}
                  className='flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                >
                  <Mail className='w-4 h-4' />
                  Email
                </a>
              )}
              {profile.contact?.phone && (
                <a
                  href={`tel:${profile.contact.phone}`}
                  className='flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                >
                  <Phone className='w-4 h-4' />
                  Phone
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Verified Employment — only when employer verified via email */}
        {verifiedEmployments && verifiedEmployments.length > 0 && (
          <div className='mb-8'>
            <div className='mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                <ShieldCheck className='w-5 h-5 text-green-400' />
                Verified Employment
              </h2>
              <p className='text-sm text-gray-400 mt-1'>
                Confirmed by previous employers — trust badges on your Career Card
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {verifiedEmployments.map((job, idx) => (
                <div
                  key={idx}
                  className='flex items-start gap-4 rounded-xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-4 transition-all hover:border-green-500/30 hover:bg-gray-800/70'
                >
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 border border-green-500/30'>
                    <CheckCircle className='h-5 w-5 text-green-400' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='font-semibold text-white'>{job.position}</p>
                    <p className='text-sm text-teal-600 dark:text-teal-400 font-medium'>{job.companyName}</p>
                    <p className='mt-1 text-xs text-gray-500'>
                      {job.startDate
                        ? new Date(job.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : ''}
                      {job.startDate && job.endDate ? ' – ' : ''}
                      {job.endDate
                        ? new Date(job.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : job.startDate ? 'Present' : ''}
                    </p>
                    {job.status === 'PARTIALLY_VERIFIED' && (
                      <span className='mt-2 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 border border-amber-500/30'>
                        Partially verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MVR & Driver Score Section (like GitHub Assessment for devs) */}
        <div className='mb-8'>
          <div className='mb-4'>
            <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
              <Car className='w-5 h-5 text-teal-600 dark:text-teal-400' />
              MVR & Driving Record
            </h2>
            <p className='text-sm text-gray-400 mt-1'>
              Motor Vehicle Record and AI-rated candidate score based on record
            </p>
          </div>
          <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden'>
            <div className='p-5 border-b border-gray-700/50'>
              <div className='flex items-center gap-4 flex-wrap'>
                <div className='flex-1 min-w-0'>
                  <p className='text-lg font-semibold text-white'>Driving record</p>
                  {mvr ? (
                    <p className='text-sm text-gray-400'>
                      License {mvr.licenseStatus}
                      {mvr.violationCount === 0 ? ' • Clean record' : ` • ${mvr.violationCount} violation(s)`}
                      {mvr.totalPoints != null && mvr.totalPoints > 0 && ` • ${mvr.totalPoints} pts`}
                    </p>
                  ) : (
                    <p className='text-sm text-gray-500'>No MVR on file</p>
                  )}
                </div>
              </div>
            </div>
            {/* Stats grid */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-700/30'>
              <div className='bg-gray-800/80 p-4 text-center'>
                <p className='text-2xl font-bold text-white'>{profile.cdl.class || '—'}</p>
                <p className='text-xs text-gray-500'>CDL Class</p>
              </div>
              <div className='bg-gray-800/80 p-4 text-center'>
                <p className='text-2xl font-bold text-white'>{mvr?.totalPoints ?? '—'}</p>
                <p className='text-xs text-gray-500'>Points</p>
              </div>
              <div className='bg-gray-800/80 p-4 text-center'>
                <p className='text-2xl font-bold text-white'>{mvr?.violationCount ?? '—'}</p>
                <p className='text-xs text-gray-500'>Violations</p>
              </div>
              <div className='bg-gray-800/80 p-4 text-center'>
                <p className='text-2xl font-bold text-white'>{endorsements.length}</p>
                <p className='text-xs text-gray-500'>Endorsements</p>
              </div>
            </div>
            {/* Endorsements bar (like languages for devs) */}
            {endorsements.length > 0 && (
              <div className='p-5 border-t border-gray-700/50'>
                <p className='text-sm font-medium text-gray-300 mb-3'>Endorsements</p>
                <div className='space-y-2'>
                  {endorsements.map((endorsement) => (
                    <div key={endorsement} className='flex items-center gap-3'>
                      <div className='w-24 text-sm text-gray-400 truncate'>{endorsement}</div>
                      <div className='flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full'
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Experience years bar */}
            {profile.experienceYears != null && profile.experienceYears > 0 && (
              <div className='p-5 border-t border-gray-700/50'>
                <p className='text-sm font-medium text-gray-300 mb-3'>Experience</p>
                <div className='flex items-center gap-3'>
                  <div className='w-28 text-sm text-gray-400'>Years driving</div>
                  <div className='flex-1 h-3 bg-gray-700/50 rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full'
                      style={{ width: `${Math.min(100, (profile.experienceYears ?? 0) * 10)}%` }}
                    />
                  </div>
                  <div className='w-12 text-right text-xs text-gray-500'>{profile.experienceYears}+ yrs</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CDL & Credentials summary card */}
        <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8'>
          <h2 className='flex items-center gap-2 text-lg font-semibold text-white mb-4'>
            <Shield className='w-5 h-5 text-teal-600 dark:text-teal-400' />
            Credentials
          </h2>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4'>
            <InfoBox label='Class' value={profile.cdl.class || 'N/A'} highlight />
            <InfoBox label='State' value={profile.cdl.state || 'N/A'} />
            <InfoBox
              label='Expiration'
              value={
                profile.cdl.expiration
                  ? new Date(profile.cdl.expiration).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'N/A'
              }
            />
            <InfoBox
              label='Endorsements'
              value={endorsements.length ? endorsements.join(', ') : 'None'}
            />
          </div>
          <div className='flex flex-wrap gap-3'>
            {resume && (
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm border border-green-500/30'>
                <FileText className='w-4 h-4' /> Resume {resume.blockchainVerified && <CheckCircle className='w-3 h-3' />}
              </span>
            )}
            {dotApp && (
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm border border-purple-500/30'>
                <ClipboardCheck className='w-4 h-4' /> DOT {dotApp.isComplete ? 'Complete' : `${dotApp.completionPercentage}%`}
              </span>
            )}
            {mvr && (
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-sm border border-orange-500/30'>
                <Car className='w-4 h-4' /> MVR on file
              </span>
            )}
          </div>
        </div>

        {/* Resume — driver-specific sections (CDL, employments, skills, education) */}
        {resume && (
          <div className='mb-8 rounded-2xl border-2 border-gray-600/80 bg-gray-800/30 overflow-hidden shadow-xl'>
            <div className='p-6 sm:p-8'>
              <div className='flex items-center justify-between mb-6 pb-4 border-b border-gray-700/50'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                  <FileText className='w-5 h-5 text-teal-600 dark:text-teal-400' />
                  Resume
                </h2>
                <div className='flex items-center gap-3'>
                  {resume.blockchainVerified && (
                    <span className='flex items-center gap-1 text-xs text-green-400'>
                      <CheckCircle className='w-3 h-3' />
                      Blockchain Verified
                    </span>
                  )}
                  {resume.documentUrl && !resume.ipfsHash?.startsWith('built_') && (
                    <a
                      href={resume.documentUrl ?? '#'}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline'
                    >
                      View PDF <ExternalLink className='w-3 h-3' />
                    </a>
                  )}
                </div>
              </div>
              {resume.structuredData ? (
                <>
                  {resume.structuredData.personalInfo && (
                    <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                        <User className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Personal Information
                      </h3>
                      <p className='text-xl font-bold text-white'>
                        {resume.structuredData.personalInfo.firstName} {resume.structuredData.personalInfo.lastName}
                      </p>
                      <div className='text-sm text-gray-400 mt-1'>
                        {resume.structuredData.personalInfo.email && <p>{resume.structuredData.personalInfo.email}</p>}
                        {resume.structuredData.personalInfo.phone && <p>{resume.structuredData.personalInfo.phone}</p>}
                        {resume.structuredData.personalInfo.address && (
                          <p>{resume.structuredData.personalInfo.address}</p>
                        )}
                        {(resume.structuredData.personalInfo.city || resume.structuredData.personalInfo.state || resume.structuredData.personalInfo.zipCode) && (
                          <p>
                            {[resume.structuredData.personalInfo.city, resume.structuredData.personalInfo.state, resume.structuredData.personalInfo.zipCode].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      {resume.structuredData.personalInfo.professionalSummary && (
                        <p className='mt-3 text-gray-300'>{resume.structuredData.personalInfo.professionalSummary}</p>
                      )}
                    </div>
                  )}
                  {resume.structuredData.cdlInfo && (resume.structuredData.cdlInfo.cdlClass || resume.structuredData.cdlInfo.endorsements?.length || resume.structuredData.cdlInfo.restrictions?.length) ? (
                    <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                        <Award className='w-5 h-5 text-teal-600 dark:text-teal-400' /> CDL
                      </h3>
                      <p className='text-white'>
                        {resume.structuredData.cdlInfo.cdlClass} {resume.structuredData.cdlInfo.cdlState && `• ${resume.structuredData.cdlInfo.cdlState}`}
                        {resume.structuredData.cdlInfo.expirationDate && ` • Exp: ${new Date(resume.structuredData.cdlInfo.expirationDate).toLocaleDateString('en-US')}`}
                      </p>
                      {resume.structuredData.cdlInfo.endorsements?.length ? (
                        <p className='text-sm text-gray-400 mt-1'>Endorsements: {resume.structuredData.cdlInfo.endorsements.join(', ')}</p>
                      ) : null}
                      {resume.structuredData.cdlInfo.restrictions?.length ? (
                        <p className='text-sm text-gray-400 mt-1'>Restrictions: {resume.structuredData.cdlInfo.restrictions.join(', ')}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {resume.structuredData.employments && resume.structuredData.employments.length > 0 && (
                    <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                        <Briefcase className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Work Experience
                      </h3>
                      <div className='space-y-4'>
                        {resume.structuredData.employments.map((exp, i) => (
                          <div key={i} className='border-l-2 border-teal-500/30 pl-4'>
                            <p className='font-semibold text-white'>{exp.position}</p>
                            <p className='text-gray-400'>{exp.companyName} {exp.location && `• ${exp.location}`}</p>
                            <p className='text-sm text-gray-500'>
                              {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                            </p>
                            {exp.responsibilities?.filter(Boolean).length ? (
                              <ul className='mt-2 text-sm text-gray-300 list-disc list-inside'>
                                {exp.responsibilities.filter(Boolean).map((r, j) => (
                                  <li key={j}>{r}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {resume.structuredData.skills && (Array.isArray(resume.structuredData.skills) ? resume.structuredData.skills.length : 0) > 0 && (
                    <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 text-white'>Skills</h3>
                      <div className='flex flex-wrap gap-2'>
                        {(Array.isArray(resume.structuredData.skills) ? resume.structuredData.skills : []).map((s, i) => (
                          <span
                            key={i}
                            className='px-3 py-1 rounded-lg text-sm bg-gray-700/50 text-gray-300'
                          >
                            {typeof s === 'string' ? s : (s as { name?: string }).name ?? 'Skill'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {resume.structuredData.educations && resume.structuredData.educations.length > 0 && (
                    <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                        <GraduationCap className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Education
                      </h3>
                      <div className='space-y-2'>
                        {resume.structuredData.educations.map((edu, i) => (
                          <div key={i}>
                            <p className='font-semibold text-white'>{edu.degree} {edu.field && `in ${edu.field}`}</p>
                            <p className='text-gray-400 text-sm'>{edu.school}</p>
                            {edu.year && <p className='text-xs text-gray-500'>{edu.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {resume.structuredData.references && resume.structuredData.references.length > 0 && (
                    <div className='p-4 rounded-xl bg-gray-800/50'>
                      <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                        <User className='w-5 h-5 text-teal-600 dark:text-teal-400' /> References
                      </h3>
                      <div className='space-y-3'>
                        {resume.structuredData.references.map((ref, i) => (
                          <div key={i} className='border-l-2 border-teal-500/30 pl-4'>
                            <p className='font-semibold text-white'>{ref.name}{ref.title && `, ${ref.title}`}</p>
                            {ref.company && <p className='text-gray-400 text-sm'>{ref.company}</p>}
                            {(ref.phone || ref.email) && (
                              <p className='text-xs text-gray-500'>
                                {[ref.phone, ref.email].filter(Boolean).join(' • ')}
                              </p>
                            )}
                            {ref.relationship && (
                              <p className='text-xs text-gray-500'>{ref.relationship}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className='text-sm text-gray-400'>
                  {resume.documentUrl && !resume.ipfsHash?.startsWith('built_') ? (
                    <a
                      href={resume.documentUrl ?? '#'}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                    >
                      View resume document <ExternalLink className='w-3 h-3' />
                    </a>
                  ) : (
                    'Resume on file — view from your hub to download.'
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Contact */}
        {profile.contact && (profile.contact.email || profile.contact.phone) && (
          <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8'>
            <h2 className='text-lg font-semibold text-white mb-4'>Get in Touch</h2>
            <div className='flex flex-wrap gap-3'>
              {profile.contact.email && (
                <a
                  href={`mailto:${profile.contact.email}`}
                  className='flex items-center gap-2 px-5 py-3 bg-teal-600/20 hover:bg-teal-600/30 rounded-xl text-teal-600 dark:text-teal-400 transition-all hover:scale-105 border border-teal-500/30'
                >
                  <Mail className='w-5 h-5' />
                  {profile.contact.email}
                </a>
              )}
              {profile.contact.phone && (
                <a
                  href={`tel:${profile.contact.phone}`}
                  className='flex items-center gap-2 px-5 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                >
                  <Phone className='w-5 h-5' />
                  {profile.contact.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Connect */}
        {settings.allowConnect && !connectSuccess && (
          <div className='text-center py-8'>
            {!showConnectForm ? (
              <button
                onClick={() => setShowConnectForm(true)}
                className='inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-teal-600 to-teal-400 text-gray-900 font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-teal-600/30 transition-all hover:scale-105'
              >
                <Building2 className='w-5 h-5' />
                I'm Hiring — Connect
              </button>
            ) : (
              <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 text-left'>
                <h3 className='text-lg font-semibold text-white mb-4'>
                  Connect with {profile.firstName}
                </h3>
                <form onSubmit={handleConnect} className='space-y-4'>
                  <div className='grid sm:grid-cols-2 gap-4'>
                    <input
                      type='text'
                      placeholder='Your Name'
                      value={connectForm.employerName}
                      onChange={(e) =>
                        setConnectForm({
                          ...connectForm,
                          employerName: e.target.value,
                        })
                      }
                      className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500'
                    />
                    <input
                      type='text'
                      placeholder='Company Name'
                      value={connectForm.employerCompanyName}
                      onChange={(e) =>
                        setConnectForm({
                          ...connectForm,
                          employerCompanyName: e.target.value,
                        })
                      }
                      className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500'
                    />
                  </div>
                  <div className='grid sm:grid-cols-2 gap-4'>
                    <input
                      type='email'
                      placeholder='Email *'
                      value={connectForm.employerEmail}
                      onChange={(e) =>
                        setConnectForm({
                          ...connectForm,
                          employerEmail: e.target.value,
                        })
                      }
                      className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500'
                    />
                    <PhoneInput
                      value={connectForm.employerPhone}
                      onChange={(value) =>
                        setConnectForm({
                          ...connectForm,
                          employerPhone: value,
                        })
                      }
                      className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500'
                    />
                  </div>
                  <input
                    type='text'
                    placeholder='Event Name (e.g., Columbus Trucking Expo)'
                    value={connectForm.eventName}
                    onChange={(e) =>
                      setConnectForm({
                        ...connectForm,
                        eventName: e.target.value,
                      })
                    }
                    className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500'
                  />
                  <textarea
                    placeholder='Message (optional)'
                    rows={3}
                    value={connectForm.notes}
                    onChange={(e) =>
                      setConnectForm({ ...connectForm, notes: e.target.value })
                    }
                    className='w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 resize-none'
                  />
                  <div className='flex gap-3'>
                    <button
                      type='button'
                      onClick={() => setShowConnectForm(false)}
                      className='px-6 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={connecting}
                      className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-500 transition-colors disabled:opacity-50'
                    >
                      {connecting ? (
                        <Loader2 className='w-5 h-5 animate-spin' />
                      ) : (
                        <>
                          <Send className='w-5 h-5' />
                          Send Connection Request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Connect Success */}
        {connectSuccess && (
          <div className='bg-green-500/20 border border-green-500/30 rounded-2xl p-6 text-center'>
            <CheckCircle className='w-12 h-12 text-green-500 mx-auto mb-3' />
            <h3 className='text-lg font-semibold text-white mb-2'>
              Connection Request Sent!
            </h3>
            <p className='text-gray-400'>
              {profile.firstName} will be notified of your interest.
            </p>
          </div>
        )}

        <footer className='mt-12 text-center'>
          <p className='text-gray-500 text-sm'>
            Powered by{' '}
            <a href='/' className='text-teal-600 dark:text-teal-400 hover:underline'>
              Storm
            </a>{' '}
            • Career Card
          </p>
        </footer>
      </main>
    </div>
  )
}

// Helper Components

function InfoBox({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className='bg-gray-700/30 rounded-xl p-3'>
      <p className='text-xs text-gray-500 mb-1'>{label}</p>
      <p
        className={`font-semibold ${highlight ? 'text-teal-600 dark:text-teal-400 text-lg' : 'text-white'}`}
      >
        {value}
      </p>
    </div>
  )
}
