'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import {
  careerCardShellClass,
  careerCardHairlineTop,
  careerCardAmbientBlobClass,
  careerCardHeroClass,
  careerCardHeroWashClass,
  careerCardInsetPanelClass,
} from '@/lib/career-card-styles'
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  FileText,
  ClipboardCheck,
  Car,
  Shield,
  ExternalLink,
  CheckCircle,
  Clock,
  TrendingUp,
  Github,
  Linkedin,
  Globe,
  Eye,
  Loader2,
  AlertCircle,
  User,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import Avatar from '@/components/ui/Avatar'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'

// ─── Shared type ─────────────────────────────────────────────────────────────
// Exported so CareerCardModal (employer view) and DriverCareerCardSection
// (self view) both use the identical shape. The shape mirrors the response from
// /api/employer/talent/[userId] and /api/driver/career-card.
export interface CareerCardData {
  userId: string
  role: string
  name: string
  /** Profile photo URL from Supabase Storage. Null falls back to initials. */
  avatarUrl?: string | null
  email: string | null
  phone: string | null
  location: string | null
  memberSince: string
  profile: {
    fullName: string
    professionalSummary?: string
    city?: string
    state?: string
    cdl_class?: string
    cdl_state?: string
    cdl_number?: string
    cdl_expiration?: string
    endorsements?: string[]
    cdl_endorsements?: string[]
    restrictions?: string[]
    experience_years?: number
    years_experience?: number
    title?: string
    github_url?: string
    linkedin_url?: string
    portfolio_url?: string
    skills?: Array<{ name: string; category?: string }> | string[]
    employment_history?: Array<{
      companyName?: string
      position?: string
      startDate?: string
      endDate?: string
      isCurrent?: boolean
    }>
    education?: Array<{
      school?: string
      degree?: string
      field?: string
      year?: string
    }>
    share_token?: string
  } | null
  resume: {
    id: string
    title: string
    filename: string
    ipfsHash: string
    verificationStatus: string
    structuredData: Record<string, unknown> | null
    createdAt: string
  } | null
  driverApplication: {
    id: string
    status: string
    isComplete: boolean
    createdAt: string
  } | null
  // Self-ordered MVR — shareable, visible to driver and all employers
  mvr: {
    orderId: string
    orderStatus: string
    licenseState: string
    orderedAt: string
    completedAt: string | null
    wasOrderedByEmployer: boolean
    results: {
      licenseStatus: string
      licenseClass: string
      totalPoints: number
      violationCount: number
    } | null
  } | null
  // Employer's private MVR order — only populated when the viewing employer
  // is the one who ordered it. Never sent to the driver or other employers.
  companyMvr?: {
    orderId: string
    orderStatus: string
    licenseState: string
    orderedAt: string
    completedAt: string | null
    results: {
      licenseStatus: string
      licenseClass: string
      totalPoints: number
      violationCount: number
    } | null
  } | null
  workHistory: Array<{
    companyName?: string
    position?: string
    startDate?: string
    endDate?: string
    isCurrent?: boolean
  }>
  verifications: Array<{
    id: string
    employer: string
    position: string
    startDate: string
    endDate: string | null
    status: string
    verifiedAt: string | null
  }>
  completenessScore: number
  workHistoryCount: number
  verifiedJobsCount: number
  hasProfile: boolean
  hasResume: boolean
  hasDriverApp: boolean
  hasMvr: boolean
  hasWorkHistory: boolean
  // Employer-facing context — empty for self-view
  pendingRequests: Array<{
    id: string
    request_type: string
    document_type: string | null
    target_block_type: string | null
    status: string
    created_at: string
  }>
  existingApplication: {
    id: string
    status: string
    created_at: string
  } | null
  hasBgcheckConsent: boolean
  bgcheckConsentSignedAt: string | null
  /** Driver personal info from the signed disclosure — used to auto-fill MVR order */
  bgcheckConsentFormData?: {
    firstName: string
    lastName: string
    dateOfBirth: string
    address: string
    city: string
    state: string
    zip: string
    dlNumber: string
    dlState: string
    email: string
  } | null
  /** Block types the candidate has installed — used by employers to gate request actions */
  installedBlockTypes?: string[]
}

// ─── Props ───────────────────────────────────────────────────────────────────
// Action slots allow the caller (employer modal vs driver self-view) to inject
// context-appropriate buttons without this component knowing who's viewing.
interface CareerCardProps {
  data: CareerCardData
  // Needed to authenticate the DOT app preview fetch
  walletAddress?: string
  // Section-level action slots (e.g. "Request Resume" or "Edit Resume")
  resumeAction?: React.ReactNode
  dotAppAction?: React.ReactNode
  mvrAction?: React.ReactNode
  // Footer area (e.g. "Recruit Candidate" or "Share Profile")
  footerActions?: React.ReactNode
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CareerCard({
  data,
  walletAddress,
  resumeAction,
  dotAppAction,
  mvrAction,
  footerActions,
}: CareerCardProps) {
  const { theme } = useTheme()
  const profile = data.profile

  // Block-aware section visibility: installed blocks take priority over role.
  // A 'candidate' with driver-mvr block should see MVR sections just like a 'driver'.
  const blocks = data.installedBlockTypes || []
  const hasDriverBlocks = blocks.some(b => b.startsWith('driver-'))
  const isDriver = data.role === 'driver' || hasDriverBlocks

  const [showResumePreview, setShowResumePreview] = useState(false)
  const [showDotPreview, setShowDotPreview] = useState(false)

  // Full DOT app data — fetched on demand when the employer clicks Preview
  const [dotAppData, setDotAppData] = useState<{
    form1: DotForm1Data | null
    form2: DotForm2Data | null
    form3: DotForm3Data | null
    isComplete: boolean
    createdAt: string
  } | null>(null)
  const [dotAppLoading, setDotAppLoading] = useState(false)
  const [dotAppError, setDotAppError] = useState<string | null>(null)

  const openDotPreview = async () => {
    setShowDotPreview(true)
    if (dotAppData) return // already fetched
    setDotAppLoading(true)
    setDotAppError(null)
    try {
      const res = await fetch(`/api/employer/talent/${data.userId}/dot-app`, {
        headers: walletAddress ? { 'x-wallet-address': walletAddress } : {},
      })
      if (!res.ok) throw new Error('Failed to load DOT application')
      const json = await res.json()
      setDotAppData(json)
    } catch (err) {
      setDotAppError(err instanceof Error ? err.message : 'Failed to load DOT application')
    } finally {
      setDotAppLoading(false)
    }
  }

  const isDark = theme === 'dark'

  return (
    <div className={cn(careerCardShellClass(isDark))}>
      <div className={careerCardHairlineTop()} aria-hidden />
      <div className={careerCardAmbientBlobClass(isDark)} aria-hidden />

      {/* Hero — document identity (name also appears in employer modal chrome; this anchors the card as an artifact) */}
      <div className={careerCardHeroClass(isDark)}>
        <div className={careerCardHeroWashClass(isDark)} aria-hidden />
        <div
          className={cn(
            'absolute inset-x-6 sm:inset-x-8 bottom-3 flex flex-col gap-0.5',
            'z-[1]',
          )}
        >
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.2em]',
              isDark ? 'text-teal-300/80' : 'text-teal-800/70',
            )}
          >
            Career card
          </p>
          <p
            className={cn(
              'text-lg sm:text-xl font-bold tracking-tight truncate pr-4',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {data.name}
          </p>
        </div>
      </div>

      <div className="relative z-[1] p-6 sm:p-7 space-y-6">
      {/* Profile Score Banner */}
      <div className={careerCardInsetPanelClass(isDark)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-teal-500/20 to-cyan-500/10 dark:from-teal-400/25 dark:to-violet-500/15',
                'ring-1 ring-teal-500/25 dark:ring-teal-400/30',
              )}
            >
              <TrendingUp
                className={cn(
                  'w-5 h-5',
                  data.completenessScore >= 80
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : data.completenessScore >= 60
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-orange-500 dark:text-orange-400',
                )}
              />
            </div>
            <div className="min-w-0">
              <p className={cn('font-semibold tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>
                Profile completeness · {data.completenessScore}%
              </p>
              <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                {data.verifiedJobsCount > 0 ? (
                  <>
                    <span className={cn('font-medium', isDark ? 'text-emerald-400' : 'text-emerald-700')}>
                      {data.verifiedJobsCount} employer{data.verifiedJobsCount === 1 ? '' : 's'} confirmed employment
                    </span>
                    <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                      {' · '}
                      {data.workHistoryCount} work {data.workHistoryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </>
                ) : (
                  <>
                    No employer confirmations yet
                    <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                      {' · '}
                      {data.workHistoryCount} work {data.workHistoryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </>
                )}
              </p>
              {data.verifiedJobsCount > 0 && (
                <p
                  className={cn(
                    'text-xs mt-1.5 flex items-center gap-1.5',
                    isDark ? 'text-emerald-300/90' : 'text-emerald-700/90',
                  )}
                >
                  <ShieldCheck className='w-3.5 h-3.5 flex-shrink-0' aria-hidden />
                  Confirmed by past employers — stronger than self-reported history alone.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.hasResume && <Badge label="Resume" color="green" theme={theme} />}
            {data.hasDriverApp && <Badge label="DOT" color="green" theme={theme} />}
            {data.hasMvr && <Badge label="MVR" color="green" theme={theme} />}
          </div>
        </div>
      </div>

      {/* Contact */}
      <Section title="Contact" theme={theme}>
        <div className="flex flex-wrap gap-3">
          {data.email && (
            <a
              href={`mailto:${data.email}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Mail className="w-4 h-4" />
              {data.email}
            </a>
          )}
          {data.phone && (
            <a
              href={`tel:${data.phone}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Phone className="w-4 h-4" />
              {data.phone}
            </a>
          )}
          {data.location && (
            <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              <MapPin className="w-4 h-4" />
              {data.location}
            </span>
          )}
          {data.memberSince && (
            <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              <Calendar className="w-4 h-4" />
              Member since {new Date(data.memberSince).toLocaleDateString()}
            </span>
          )}
        </div>
      </Section>

      {/* CDL Info — drivers only */}
      {isDriver && profile && (
        <Section title="CDL Information" icon={<Award className="w-4 h-4" />} theme={theme}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <InfoItem label="Class" value={profile.cdl_class || 'N/A'} theme={theme} />
            <InfoItem label="State" value={profile.cdl_state || 'N/A'} theme={theme} />
            <InfoItem
              label="Experience"
              value={`${profile.experience_years || profile.years_experience || 0} years`}
              theme={theme}
            />
            <InfoItem
              label="Expiration"
              value={profile.cdl_expiration ? new Date(profile.cdl_expiration).toLocaleDateString() : 'N/A'}
              theme={theme}
            />
          </div>
          {(profile.endorsements?.length || profile.cdl_endorsements?.length) ? (
            <div className="mt-3">
              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Endorsements
              </p>
              <div className="flex flex-wrap gap-2">
                {(profile.endorsements || profile.cdl_endorsements || []).map((e, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
                  }`}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Section>
      )}

      {/* Links & Skills — developers only */}
      {!isDriver && profile && (
        <>
          {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
            <Section title="Links" theme={theme}>
              <div className="flex flex-wrap gap-3">
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Github className="w-4 h-4" />GitHub<ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Linkedin className="w-4 h-4" />LinkedIn<ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.portfolio_url && (
                  <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Globe className="w-4 h-4" />Portfolio<ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </Section>
          )}
          {profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
            <Section title="Skills" theme={theme}>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, i) => (
                  <span key={i} className={`px-3 py-1 rounded-full text-xs font-medium ${
                    theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {typeof skill === 'string' ? skill : skill.name}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Resume */}
      <Section
        title="Resume"
        icon={<FileText className="w-4 h-4" />}
        theme={theme}
        action={
          data.resume ? (
            // IPFS-stored resume → external link; built resume → inline preview
            data.resume.ipfsHash && !data.resume.ipfsHash.startsWith('built_') ? (
              <a
                href={`https://gateway.pinata.cloud/ipfs/${data.resume.ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-sm ${
                  theme === 'dark' ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => setShowResumePreview(true)}
                className={`flex items-center gap-1 text-sm ${
                  theme === 'dark' ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            )
          ) : resumeAction ?? null
        }
      >
        {data.resume ? (
          <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                {data.resume.title || data.resume.filename}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                data.resume.verificationStatus === 'VERIFIED'
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {data.resume.verificationStatus}
              </span>
            </div>
          </div>
        ) : (
          <EmptyState message="No resume on file" theme={theme} />
        )}
      </Section>

      {/* MVR — drivers only */}
      {isDriver && (
        <Section
          title="Motor Vehicle Record"
          icon={<Car className="w-4 h-4" />}
          theme={theme}
          // Hide action buttons once either a self-ordered or company-ordered MVR exists
          action={(!data.hasMvr && !data.companyMvr) ? mvrAction : null}
        >
          {/* Self-ordered MVR — shareable, shown to everyone */}
          {data.mvr ? (
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-500">
                  <User className="w-3 h-3" />
                  Self-Ordered
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <InfoItem label="License Status" value={data.mvr.results?.licenseStatus || 'Pending'} theme={theme} />
                <InfoItem label="Class" value={data.mvr.results?.licenseClass || 'N/A'} theme={theme} />
                <InfoItem label="Points" value={String(data.mvr.results?.totalPoints ?? 'N/A')} theme={theme} />
                <InfoItem label="Violations" value={String(data.mvr.results?.violationCount ?? 'N/A')} theme={theme} />
              </div>
            </div>
          ) : null}

          {/* Company-ordered MVR — private to this employer only */}
          {data.companyMvr ? (
            <div className={`p-4 rounded-lg border ${
              theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
            } ${data.mvr ? 'mt-3' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500">
                  <Lock className="w-3 h-3" />
                  Private to Your Company
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <InfoItem label="License Status" value={data.companyMvr.results?.licenseStatus || 'Pending'} theme={theme} />
                <InfoItem label="Class" value={data.companyMvr.results?.licenseClass || 'N/A'} theme={theme} />
                <InfoItem label="Points" value={String(data.companyMvr.results?.totalPoints ?? 'N/A')} theme={theme} />
                <InfoItem label="Violations" value={String(data.companyMvr.results?.violationCount ?? 'N/A')} theme={theme} />
              </div>
            </div>
          ) : null}

          {/* Neither ordered yet — show disclosure status or empty state */}
          {!data.mvr && !data.companyMvr && (
            data.hasBgcheckConsent ? (
              <div className={`p-4 rounded-lg border ${
                theme === 'dark' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-teal-500" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-teal-300' : 'text-teal-800'}`}>
                    Disclosure signed
                  </span>
                </div>
                <p className={`text-xs ${theme === 'dark' ? 'text-teal-400/70' : 'text-teal-600'}`}>
                  Signed {data.bgcheckConsentSignedAt
                    ? new Date(data.bgcheckConsentSignedAt).toLocaleDateString()
                    : ''} — MVR order can be initiated
                </p>
              </div>
            ) : (
              <EmptyState message="No MVR on file" theme={theme} />
            )
          )}
        </Section>
      )}

      {/* DOT Application — drivers only */}
      {isDriver && (
        <Section
          title="DOT Application"
          icon={<ClipboardCheck className="w-4 h-4" />}
          theme={theme}
          action={
            data.driverApplication ? (
              <button
                onClick={openDotPreview}
                className={`flex items-center gap-1 text-sm ${
                  theme === 'dark' ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            ) : dotAppAction ?? null
          }
        >
          {data.driverApplication ? (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}>
              {data.driverApplication.isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500" />
              )}
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                {data.driverApplication.isComplete ? 'Complete' : 'In Progress'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                data.driverApplication.status === 'VERIFIED'
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {data.driverApplication.status}
              </span>
            </div>
          ) : (
            <EmptyState message="No DOT application on file" theme={theme} />
          )}
        </Section>
      )}

      {/* Work History */}
      <Section
        title="Work History"
        icon={<Briefcase className="w-4 h-4" />}
        theme={theme}
        action={
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            {data.verifiedJobsCount > 0
              ? `${data.verifiedJobsCount} employer-confirmed`
              : 'No employer confirmations'}
          </span>
        }
      >
        {data.workHistory && data.workHistory.length > 0 ? (
          <div className="space-y-3">
            {data.workHistory.slice(0, 5).map((job, i) => {
              const verification = data.verifications?.find(
                v =>
                  normEmploymentField(v.employer) === normEmploymentField(job.companyName) &&
                  normEmploymentField(v.position) === normEmploymentField(job.position),
              )
              return (
                <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {job.position || 'Unknown Position'}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {job.companyName || 'Unknown Company'}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        {job.startDate || '?'} – {job.isCurrent ? 'Present' : job.endDate || '?'}
                      </p>
                    </div>
                    {verification?.status === 'VERIFIED' && (
                      <span className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400 flex-shrink-0">
                        <ShieldCheck className="w-3 h-3" aria-hidden />
                        Employer confirmed
                      </span>
                    )}
                    {verification?.status === 'PARTIALLY_VERIFIED' && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                        <Shield className="w-3 h-3" aria-hidden />
                        Employer confirmed (adjusted dates)
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {data.workHistory.length > 5 && (
              <p className={`text-sm text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                +{data.workHistory.length - 5} more entries
              </p>
            )}
          </div>
        ) : (
          <EmptyState message="No work history on file" theme={theme} />
        )}
      </Section>

      {/* ── Resume Preview Modal ─────────────────────────────────────── */}
      {showResumePreview && data.resume && (
        <ResumePreviewModal
          title={data.resume.title || 'Resume'}
          structuredData={data.resume.structuredData as Parameters<typeof ResumePreviewModal>[0]['structuredData']}
          onClose={() => setShowResumePreview(false)}
          onDownload={() => {}}
          theme={theme}
          zIndex={10100}
        />
      )}

      {/* ── DOT App Preview Modal ─────────────────────────────────────── */}
      {showDotPreview && data.driverApplication && (
        <Modal onClose={() => setShowDotPreview(false)} maxWidth="max-w-2xl" zIndex={10100}>
          <ModalHeader
            title="DOT Application"
            subtitle={data.name}
            onClose={() => setShowDotPreview(false)}
          />
          <div className="overflow-y-auto max-h-[75vh]">
            {dotAppLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className={`w-6 h-6 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
            )}
            {dotAppError && (
              <div className={`m-6 flex items-center gap-2 p-4 rounded-xl text-sm ${theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {dotAppError}
              </div>
            )}
            {!dotAppLoading && !dotAppError && dotAppData && (
              <DotAppPreviewContent data={dotAppData} theme={theme} />
            )}
          </div>
        </Modal>
      )}

      {/* Footer */}
      {(footerActions || profile?.share_token) && (
        <div
          className={cn(
            'pt-6 border-t',
            isDark ? 'border-gray-600/60' : 'border-gray-200/90',
          )}
        >
          <div
            className="h-px w-full mb-6 bg-gradient-to-r from-transparent via-teal-400/30 to-transparent dark:via-teal-400/20"
            aria-hidden
          />
          <div className="flex flex-wrap gap-3">
            {profile?.share_token && (
              <a
                href={`/${isDriver ? 'd' : 'dev-card'}/${profile.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors',
                  'ring-1 ring-teal-500/25 dark:ring-teal-400/30',
                  isDark
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/35 hover:bg-teal-500/25'
                    : 'bg-teal-50 text-teal-800 border border-teal-200/90 hover:bg-teal-100/90',
                )}
              >
                <ExternalLink className="w-4 h-4" />
                View public profile
              </a>
            )}
            {footerActions}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
// Exported so employer modal and driver self-view can use them for consistent
// inline action buttons that match the card's visual language.

export function Section({
  title,
  icon,
  action,
  children,
  theme,
}: {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  theme: string
}) {
  const isDark = theme === 'dark'
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4
          className={cn(
            'font-semibold text-sm tracking-tight flex items-center gap-2 min-w-0',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          <span
            className="w-1 h-5 rounded-full bg-gradient-to-b from-teal-400 to-cyan-500 dark:from-teal-400 dark:to-violet-400 shrink-0"
            aria-hidden
          />
          {icon}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  )
}

// ─── DOT App full preview ─────────────────────────────────────────────────────

function DotField({ label, value, theme }: { label: string; value?: string | null; theme: string }) {
  if (!value) return null
  return (
    <div>
      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

function DotSection({ title, children, theme }: { title: string; children: React.ReactNode; theme: string }) {
  return (
    <div className={`border-b px-6 py-5 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
      {children}
    </div>
  )
}

function YesNo({ value }: { value?: string | boolean | null }) {
  if (value == null) return <span className="text-gray-400">—</span>
  const yes = value === true || value === 'yes' || value === 'true'
  return (
    <span className={yes ? 'text-yellow-500 font-medium' : 'text-gray-400'}>
      {yes ? 'Yes' : 'No'}
    </span>
  )
}

function DotAppPreviewContent({
  data,
  theme,
}: {
  data: { form1: DotForm1Data | null; form2: DotForm2Data | null; form3: DotForm3Data | null; isComplete: boolean; createdAt: string }
  theme: string
}) {
  const f1 = data.form1
  const f2 = data.form2
  const f3 = data.form3
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  return (
    <div>
      {/* Status banner */}
      <div className={`px-6 py-4 flex items-center gap-3 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
        {data.isComplete
          ? <CheckCircle className="w-4 h-4 text-green-500" />
          : <Clock className="w-4 h-4 text-yellow-500" />
        }
        <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {data.isComplete ? 'Complete' : 'In Progress'} · Submitted {fmt(data.createdAt)}
        </span>
      </div>

      {/* ── Form 1: Personal / License / Medical ─────────────────────── */}
      {f1 && (
        <>
          <DotSection title="Personal Information" theme={theme}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <DotField label="Name" value={[f1.firstName, f1.middleName, f1.lastName].filter(Boolean).join(' ')} theme={theme} />
              <DotField label="Date of Birth" value={fmt(f1.dateOfBirth)} theme={theme} />
              <DotField label="Phone" value={f1.phone} theme={theme} />
              <DotField label="Email" value={f1.email} theme={theme} />
              <DotField label="Position Applied For" value={f1.positionAppliedFor} theme={theme} />
              <DotField label="Date Available" value={fmt(f1.dateAvailableForWork)} theme={theme} />
            </div>
            {f1.currentMailing && (
              <div className="mt-3">
                <DotField
                  label="Current Address"
                  value={[f1.currentMailing.street, f1.currentMailing.city, f1.currentMailing.state, f1.currentMailing.zipCode].filter(Boolean).join(', ')}
                  theme={theme}
                />
              </div>
            )}
          </DotSection>

          {f1.currentLicenses && f1.currentLicenses.length > 0 && (
            <DotSection title="Driver's Licenses" theme={theme}>
              <div className="space-y-3">
                {f1.currentLicenses.map((lic, i) => (
                  <div key={i} className={`p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <DotField label="State" value={lic.state} theme={theme} />
                    <DotField label="License #" value={lic.licenseNumber} theme={theme} />
                    <DotField label="Class" value={lic.typeClass} theme={theme} />
                    <DotField label="Endorsements" value={lic.endorsements} theme={theme} />
                    <DotField label="Expires" value={fmt(lic.expirationDate)} theme={theme} />
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.disqualificationHistory && (
            <DotSection title="License Disqualification History" theme={theme}>
              <div className="space-y-2 text-sm">
                {[
                  { q: 'License suspended/revoked?', v: f1.disqualificationHistory.hasLicenseSuspension, detail: f1.disqualificationHistory.licenseSuspensionDetails },
                  { q: 'Disqualifying offense?',     v: f1.disqualificationHistory.hasDisqualifyingOffense, detail: f1.disqualificationHistory.disqualifyingOffenseDetails },
                  { q: 'Out-of-service violation?',  v: f1.disqualificationHistory.hasOutOfServiceViolation, detail: f1.disqualificationHistory.outOfServiceViolationDetails },
                  { q: 'Mobile device violation?',   v: f1.disqualificationHistory.hasMobileDeviceViolation, detail: f1.disqualificationHistory.mobileDeviceViolationDetails },
                ].map(({ q, v, detail }) => (
                  <div key={q} className="flex gap-3">
                    <span className={`flex-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{q}</span>
                    <span><YesNo value={v} /></span>
                    {detail && <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{detail}</span>}
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.medicalQualification && (
            <DotSection title="Medical Qualification" theme={theme}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <DotField label="Valid Medical Certificate?" value={f1.medicalQualification.hasValidMedicalCertificate} theme={theme} />
                <DotField label="Certificate Expiration" value={fmt(f1.medicalQualification.medicalCertificateExpiration)} theme={theme} />
                <DotField label="Exam Date" value={fmt(f1.medicalQualification.medicalExamDate)} theme={theme} />
                <DotField label="Examiner Name" value={f1.medicalQualification.medicalExaminerName} theme={theme} />
                <DotField label="Examiner Phone" value={f1.medicalQualification.medicalExaminerPhone} theme={theme} />
              </div>
            </DotSection>
          )}
        </>
      )}

      {/* ── Form 2: Driving Experience / Accidents / Convictions ─────── */}
      {f2 && (
        <>
          {f2.drivingExperience && f2.drivingExperience.length > 0 && (
            <DotSection title="Driving Experience" theme={theme}>
              <div className="space-y-2">
                {f2.drivingExperience.map((exp, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{exp.equipmentType}</span>
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{exp.yearsOfExperience} yrs</span>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          <DotSection title="Accident History (Past 5 Years)" theme={theme}>
            {f2.hasNoAccidents || !f2.accidents?.length ? (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No accidents reported</p>
            ) : (
              <div className="space-y-3">
                {f2.accidents.map((acc, i) => (
                  <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <DotField label="Date" value={fmt(acc.date)} theme={theme} />
                      <DotField label="Nature" value={acc.nature} theme={theme} />
                      <DotField label="Fatalities" value={acc.fatalities} theme={theme} />
                      <DotField label="Injuries" value={acc.injuries} theme={theme} />
                      <DotField label="At Fault" value={acc.atFault} theme={theme} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DotSection>

          {/* Drug & Alcohol pre-employment (49 CFR 40.25) */}
          {f2.drugTestPositive && (
            <DotSection title="Drug & Alcohol Pre-Employment — 49 CFR 40.25 (Past 2 Years)" theme={theme}>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  f2.drugTestPositive === 'yes'
                    ? 'bg-red-500/20 text-red-500'
                    : theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                }`}>
                  {f2.drugTestPositive === 'yes' ? 'YES — Positive / Refused' : 'NO'}
                </span>
              </div>
              {f2.drugTestPositiveExplain && (
                <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{f2.drugTestPositiveExplain}</p>
              )}
            </DotSection>
          )}

          {/* 49 CFR 391.15 disqualifying convictions */}
          {f2.cfr391ConvictedYesNo && (
            <DotSection title="Disqualifying Convictions — 49 CFR 391.15 (Past 3 Years)" theme={theme}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  f2.cfr391ConvictedYesNo === 'yes'
                    ? 'bg-red-500/20 text-red-500'
                    : theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                }`}>
                  {f2.cfr391ConvictedYesNo === 'yes' ? 'YES — Convicted' : 'NO'}
                </span>
              </div>
              {f2.cfr391ConvictedYesNo === 'yes' && f2.cfr391ConvictedOffenses && f2.cfr391ConvictedOffenses.length > 0 && (
                <ul className={`text-sm space-y-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  {f2.cfr391ConvictedOffenses.map((key, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{key}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f2.cfr391ConvictedExplain && (
                <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{f2.cfr391ConvictedExplain}</p>
              )}
            </DotSection>
          )}

          <DotSection title="Traffic Convictions (Past 3 Years)" theme={theme}>
            {f2.hasNoConvictions || !f2.convictions?.length ? (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No convictions reported</p>
            ) : (
              <div className="space-y-3">
                {f2.convictions.map((c, i) => (
                  <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <DotField label="Date" value={fmt(c.dateConvicted)} theme={theme} />
                      <DotField label="Violation" value={c.violation} theme={theme} />
                      <DotField label="State" value={c.stateOfViolation} theme={theme} />
                      <DotField label="Penalty" value={c.penalty} theme={theme} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DotSection>
        </>
      )}

      {/* ── Form 3: Employment / Education / Signature ───────────────── */}
      {f3 && (
        <>
          {f3.employers && f3.employers.length > 0 && (
            <DotSection title="Employment History (10 Years)" theme={theme}>
              <div className="space-y-4">
                {f3.employers.filter(e => !e.isUnemployment).map((emp, i) => (
                  <div key={i} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{emp.positionHeld}</p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{emp.name}</p>
                      </div>
                      <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {emp.fromDate} – {emp.toDate || 'Present'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      <DotField label="Address" value={emp.address} theme={theme} />
                      <DotField label="Phone" value={emp.phone} theme={theme} />
                      <DotField label="Reason for Leaving" value={emp.reasonForLeaving} theme={theme} />
                      <DotField label="Subject to FMCSR" value={emp.subjectToFMCSR} theme={theme} />
                      <DotField label="Safety-Sensitive" value={emp.safetySensitiveFunction} theme={theme} />
                    </div>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f3.education && f3.education.length > 0 && (
            <DotSection title="Education & Training" theme={theme}>
              <div className="space-y-3">
                {f3.education.map((edu, i) => (
                  <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <DotField label="Type" value={edu.schoolType} theme={theme} />
                      <DotField label="School / Location" value={edu.nameAndLocation} theme={theme} />
                      <DotField label="Course of Study" value={edu.courseOfStudy} theme={theme} />
                      <DotField label="Years Completed" value={edu.yearsCompleted} theme={theme} />
                      <DotField label="Graduated" value={edu.graduated} theme={theme} />
                    </div>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {(f3.applicantSignature || f3.applicantNamePrinted) && (
            <DotSection title="Electronic Signature" theme={theme}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <DotField label="Signed As" value={f3.applicantSignature} theme={theme} />
                <DotField label="Printed Name" value={f3.applicantNamePrinted} theme={theme} />
                <DotField label="Signature Date" value={fmt(f3.signatureDate)} theme={theme} />
                {f3.signedAt && (
                  <DotField
                    label="Signed Date/Time"
                    value={new Date(f3.signedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    theme={theme}
                  />
                )}
                {f3.ipAddress && <DotField label="IP Address" value={f3.ipAddress} theme={theme} />}
                {f3.fcraAcknowledgement && (
                  <div className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                    <CheckCircle className="w-3 h-3" /> FCRA Rights Acknowledged
                  </div>
                )}
              </div>
            </DotSection>
          )}
        </>
      )}
    </div>
  )
}

export function PreviewSection({ title, children, theme }: { title: string; children: React.ReactNode; theme: string }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{title}</p>
      {children}
    </div>
  )
}

export function InfoItem({ label, value, theme }: { label: string; value: string; theme: string }) {
  return (
    <div>
      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{label}</p>
      <p className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{value}</p>
    </div>
  )
}

export function Badge({ label, color, theme }: { label: string; color: 'green' | 'yellow' | 'red'; theme: string }) {
  const colors = {
    green:
      theme === 'dark'
        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25'
        : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15',
    yellow:
      theme === 'dark'
        ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25'
        : 'bg-amber-50 text-amber-900 ring-1 ring-amber-600/15',
    red:
      theme === 'dark'
        ? 'bg-red-500/15 text-red-400 ring-1 ring-red-400/25'
        : 'bg-red-50 text-red-800 ring-1 ring-red-600/15',
  }
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', colors[color])}>
      {label}
    </span>
  )
}

export function EmptyState({ message, subtext, theme }: { message: string; subtext?: string; theme: string }) {
  const isDark = theme === 'dark'
  return (
    <div
      className={cn(
        'p-4 rounded-xl text-center border border-dashed',
        isDark
          ? 'border-gray-600/60 bg-gray-800/30 text-gray-400'
          : 'border-gray-300/80 bg-slate-50/80 text-gray-500',
      )}
    >
      <p className="text-sm font-medium">{message}</p>
      {subtext && (
        <p className={cn('text-xs mt-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>{subtext}</p>
      )}
    </div>
  )
}
