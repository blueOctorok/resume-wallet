'use client'

import { useTheme } from '@/contexts/ThemeContext'
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
  Code,
  ExternalLink,
  CheckCircle,
  Clock,
  TrendingUp,
  Github,
  Linkedin,
  Globe,
} from 'lucide-react'

// ─── Shared type ─────────────────────────────────────────────────────────────
// Exported so CareerCardModal (employer view) and DriverCareerCardSection
// (self view) both use the identical shape. The shape mirrors the response from
// /api/employer/talent/[userId] and /api/driver/career-card.
export interface CareerCardData {
  userId: string
  role: string
  name: string
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
}

// ─── Props ───────────────────────────────────────────────────────────────────
// Action slots allow the caller (employer modal vs driver self-view) to inject
// context-appropriate buttons without this component knowing who's viewing.
interface CareerCardProps {
  data: CareerCardData
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
  resumeAction,
  dotAppAction,
  mvrAction,
  footerActions,
}: CareerCardProps) {
  const { theme } = useTheme()
  const isDriver = data.role === 'driver'
  const profile = data.profile

  return (
    <div className="space-y-6">
      {/* Profile Score Banner */}
      <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className={`w-5 h-5 ${
              data.completenessScore >= 80 ? 'text-green-500' :
              data.completenessScore >= 60 ? 'text-yellow-500' :
              'text-orange-500'
            }`} />
            <div>
              <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Profile Completeness: {data.completenessScore}%
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {data.verifiedJobsCount} verified jobs · {data.workHistoryCount} work entries
              </p>
            </div>
          </div>
          <div className="flex gap-2">
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
          data.resume && data.resume.ipfsHash && !data.resume.ipfsHash.startsWith('built_') ? (
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
          ) : !data.hasResume ? resumeAction : null
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
          action={!data.hasMvr ? mvrAction : null}
        >
          {data.mvr ? (
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <InfoItem label="License Status" value={data.mvr.results?.licenseStatus || 'Pending'} theme={theme} />
                <InfoItem label="Class" value={data.mvr.results?.licenseClass || 'N/A'} theme={theme} />
                <InfoItem label="Points" value={String(data.mvr.results?.totalPoints ?? 'N/A')} theme={theme} />
                <InfoItem label="Violations" value={String(data.mvr.results?.violationCount ?? 'N/A')} theme={theme} />
              </div>
              {data.mvr.wasOrderedByEmployer && (
                <p className={`mt-3 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  * MVR ordered by employer
                </p>
              )}
            </div>
          ) : data.hasBgcheckConsent ? (
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
          )}
        </Section>
      )}

      {/* DOT Application — drivers only */}
      {isDriver && (
        <Section
          title="DOT Application"
          icon={<ClipboardCheck className="w-4 h-4" />}
          theme={theme}
          action={!data.hasDriverApp ? dotAppAction : null}
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
            {data.verifiedJobsCount} verified
          </span>
        }
      >
        {data.workHistory && data.workHistory.length > 0 ? (
          <div className="space-y-3">
            {data.workHistory.slice(0, 5).map((job, i) => {
              const verification = data.verifications?.find(
                v => v.employer === job.companyName && v.position === job.position
              )
              return (
                <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between">
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
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <Shield className="w-3 h-3" />
                        Verified
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

      {/* Footer */}
      {(footerActions || profile?.share_token) && (
        <div className={`pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex flex-wrap gap-3">
            {profile?.share_token && (
              <a
                href={`/${isDriver ? 'd' : 'dev-card'}/${profile.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm ${
                  theme === 'dark'
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30'
                    : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                View Public Profile
              </a>
            )}
            {footerActions}
          </div>
        </div>
      )}
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
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {icon}
          {title}
        </h4>
        {action}
      </div>
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
    green: theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
    yellow: theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700',
    red: theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[color]}`}>
      {label}
    </span>
  )
}

export function EmptyState({ message, subtext, theme }: { message: string; subtext?: string; theme: string }) {
  return (
    <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{message}</p>
      {subtext && (
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{subtext}</p>
      )}
    </div>
  )
}
