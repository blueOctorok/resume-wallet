'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import { careerCardInsetPanelClass } from '@/lib/career-card-styles'
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
  User,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import Avatar from '@/components/ui/Avatar'
import {
  formatDotAppHonestyLabel,
  resolveDotAppHonestyStatus,
} from '@/lib/dot-app-honesty'

/** Normalize employer / title strings for matching verified jobs to work history rows. */
function normEmploymentField(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

// ─── Shared type ─────────────────────────────────────────────────────────────
// Legacy shell: DriverCareerCardSection + /api/driver/career-card.
// Employer modal uses ProjectedCareerCard + /api/employer/talent/[userId] (projected card).
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
    storagePath?: string | null
    documentUrl?: string | null
    verificationStatus: string
    blockchainTxHash?: string | null
    structuredData: Record<string, unknown> | null
    createdAt: string
  } | null
  driverApplication: {
    id: string
    status: string
    isComplete: boolean
    createdAt: string
    /** @deprecated Legacy Base hash-seal — never surface as issuer/blockchain verified */
    blockchainTxHash?: string | null
    verifiedPercent?: number
    verifiedTotalCount?: number
    majorityVerified?: boolean
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
  sessionUserId?: string
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
  sessionUserId,
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

  const isDark = isDarkTheme(theme)

  return (
    <VaultHorizontalVaultShell isDark={isDark} layout='panel' contentClassName='relative overflow-hidden'>
      <div className="relative z-[1] p-6 sm:p-7 space-y-6">
      {/* Title row — on vault face (no separate hero gradient band) */}
      <div className="mb-1">
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
                isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Phone className="w-4 h-4" />
              {data.phone}
            </a>
          )}
          {data.location && (
            <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              isDarkTheme(theme) ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              <MapPin className="w-4 h-4" />
              {data.location}
            </span>
          )}
          {data.memberSince && (
            <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              isDarkTheme(theme) ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
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
              <p className={`text-sm mb-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Endorsements
              </p>
              <div className="flex flex-wrap gap-2">
                {(profile.endorsements || profile.cdl_endorsements || []).map((e, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs font-medium ${
                    isDarkTheme(theme) ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
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
                      isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Github className="w-4 h-4" />GitHub<ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Linkedin className="w-4 h-4" />LinkedIn<ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.portfolio_url && (
                  <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    isDarkTheme(theme) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
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
            data.resume.documentUrl ? (
              <a
                href={data.resume.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-sm ${
                  isDarkTheme(theme) ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => setShowResumePreview(true)}
                className={`flex items-center gap-1 text-sm ${
                  isDarkTheme(theme) ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            )
          ) : resumeAction ?? null
        }
      >
        {data.resume ? (
          <div className={`p-3 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                {data.resume.title || data.resume.filename}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                On file
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
            <div className={`p-4 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}`}>
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
              isDarkTheme(theme) ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
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
                isDarkTheme(theme) ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-teal-500" />
                  <span className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-800'}`}>
                    Disclosure signed
                  </span>
                </div>
                <p className={`text-xs ${isDarkTheme(theme) ? 'text-teal-400/70' : 'text-teal-600'}`}>
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
                onClick={() => setShowDotPreview(true)}
                className={`flex items-center gap-1 text-sm ${
                  isDarkTheme(theme) ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            ) : dotAppAction ?? null
          }
        >
          {data.driverApplication ? (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'
            }`}>
              {data.driverApplication.isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500" />
              )}
              <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                {data.driverApplication.isComplete ? 'Complete' : 'In Progress'}
              </span>
              {(() => {
                const honesty = resolveDotAppHonestyStatus(data.driverApplication)
                const label = formatDotAppHonestyLabel(honesty)
                const strong =
                  honesty === 'majority_verified' || honesty === 'partially_verified'
                return (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      strong
                        ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                        : data.driverApplication.isComplete
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {label}
                  </span>
                )
              })()}
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
          <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
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
                <div key={i} className={`p-3 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                        {job.position || 'Unknown Position'}
                      </p>
                      <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                        {job.companyName || 'Unknown Company'}
                      </p>
                      <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
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
              <p className={`text-sm text-center ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
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
          theme={theme}
          zIndex={10100}
        />
      )}

      <DotAppPreviewModal
        isOpen={showDotPreview && Boolean(data.driverApplication)}
        onClose={() => setShowDotPreview(false)}
        userId={data.userId}
        sessionUserId={sessionUserId ?? null}
        isDark={false}
      />

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
    </VaultHorizontalVaultShell>
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
  const isDark = isDarkTheme(theme)
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


export function PreviewSection({ title, children, theme }: { title: string; children: React.ReactNode; theme: string }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>{title}</p>
      {children}
    </div>
  )
}

export function InfoItem({ label, value, theme }: { label: string; value: string; theme: string }) {
  return (
    <div>
      <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>{label}</p>
      <p className={isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'}>{value}</p>
    </div>
  )
}

export function Badge({ label, color, theme }: { label: string; color: 'green' | 'yellow' | 'red'; theme: string }) {
  const colors = {
    green:
      isDarkTheme(theme)
        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25'
        : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15',
    yellow:
      isDarkTheme(theme)
        ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25'
        : 'bg-amber-50 text-amber-900 ring-1 ring-amber-600/15',
    red:
      isDarkTheme(theme)
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
  const isDark = isDarkTheme(theme)
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
