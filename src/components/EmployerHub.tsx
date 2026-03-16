'use client'

import { useState, useEffect, useCallback } from 'react'
import * as LucideIcons from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import EmployerVerificationSection from './verification/EmployerVerificationSection'
import ApplicantKanban, { type KanbanApplicant } from './employer/ApplicantKanban'
import CandidateNotesPanel from './employer/CandidateNotesPanel'
import CandidateOutreach from './employer/CandidateOutreach'
import JobPostingsSection from './employer/JobPostingsSection'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import CareerCardModal from '@/components/employer/CareerCardModal'
import MessagingButton from '@/components/messaging/MessagingButton'
import EmployerBlockPickerModal from '@/components/employer/EmployerBlockPickerModal'
import { useUIStore } from '@/stores'
import { useAuthStore } from '@/stores'
import {
  useEmployerBlocksStore,
  useEmployerInstalledBlocks,
  useEmployerIsEditMode,
} from '@/stores/employer-blocks-store'
import {
  Briefcase,
  Users,
  FileText,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  ChevronRight,
  ChevronDown,
  Building2,
  Calendar,
  Loader2,
  X,
  MapPin,
  DollarSign,
  ExternalLink,
  UserCheck,
  UserX,
  MessageSquare,
  Phone,
  Mail,
  Shield,
  Search,
  Trash2,
  RefreshCw,
  Link2,
  Pencil,
  Package,
  CreditCard,
} from 'lucide-react'
import { getDisplayRole } from '@/lib/employer-roles'
import { cn } from '@/lib/utils'
import AskAvaButton from '@/components/ui/AskAvaButton'
import STORMBalance from '@/components/STORMBalance'

// ============================================================
// TYPES
// ============================================================

interface HubCompany {
  id: string
  name: string
  dotNumber: string | null
  mcNumber: string | null
  description: string | null
  logoUrl: string | null
  verified: boolean
  companySize: string | null
  industryType: string[] | null
  city: string | null
  state: string | null
  onboardingCompleted: boolean
}

interface HubJobPosting {
  id: string
  title: string
  description: string | null
  targetRole: string | null  // 'driver', 'developer', etc.
  locationCity: string | null
  locationState: string | null
  salaryMin: number | null
  salaryMax: number | null
  jobType: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  experienceRequired: number | null
  routeType: string | null
  remoteAllowed: boolean | null
  totalApplications: number
  newApplications: number
  viewedApplications: number
}

interface HubApplicant {
  applicationId: string
  status: string
  appliedAt: string
  viewCount: number
  lastViewedAt: string | null
  coverLetter: string | null
  reviewerNotes: string | null
  shareToken: string | null
  applicantUserId: string
  applicantName: string
  applicantEmail: string | null
  applicantPhone: string | null
  applicantRole: string | null
  avatarUrl?: string | null
  applicantHeadline?: string | null
  jobPostingId: string
  jobTitle: string
  hasResume: boolean
  resumeId: string | null
  resumeVerified: boolean
}

interface HubStats {
  activeJobs: number
  totalJobs: number
  totalApplicants: number
  pendingReview: number
  interviewing: number
  hiresThisMonth: number
  totalHires: number
}

interface HubPipeline {
  new: number
  reviewing: number
  interviewing: number
  offerSent: number
  hired: number
  rejected: number
}

interface HubData {
  success: boolean
  isNewUser: boolean
  needsCompanySetup?: boolean
  company: HubCompany | null
  /** Current user's role in this company (owner, admin, recruiter, viewer, etc.) */
  userRole?: string | null
  jobPostings: HubJobPosting[]
  applicants: HubApplicant[]
  stats: HubStats
  pipeline: HubPipeline
  memberSince?: string
}

interface EmployerHubProps {
  walletAddress: string
  onNavigate: (view: string) => void
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EmployerHub({ walletAddress, onNavigate }: EmployerHubProps) {
  const { theme } = useTheme()
  const { navigateToMessages } = useUIStore()
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Composable employer blocks
  const fetchEmployerBlocks = useEmployerBlocksStore((s) => s.fetchEmployerBlocks)
  const employerBlocks = useEmployerInstalledBlocks()
  const isEditMode = useEmployerIsEditMode()
  const setEditMode = useEmployerBlocksStore((s) => s.setEditMode)
  const removeBlock = useEmployerBlocksStore((s) => s.removeBlock)
  const openPicker = useEmployerBlocksStore((s) => s.openPicker)
  
  // Detail modal states
  const [selectedApplicant, setSelectedApplicant] = useState<HubApplicant | null>(null)
  const [careerCardApplicantId, setCareerCardApplicantId] = useState<string | null>(null)

  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)

  // Section-specific loading states for granular refresh
  const [refreshingPipeline, setRefreshingPipeline] = useState(false)

  // Collapsible section state — persisted in localStorage
  const SECTIONS_KEY = 'employer-hub-sections'
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const defaults = { jobs: true, pipeline: true, verification: false, outreach: false }
    if (typeof window === 'undefined') return defaults
    try {
      const stored = localStorage.getItem(SECTIONS_KEY)
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults
    } catch {
      return defaults
    }
  })

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  // Fetch hub data
  const fetchHubData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/employer/hub', {
        headers: {
          'x-wallet-address': walletAddress,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch hub data')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching employer hub data:', err)
      setError('Failed to load your hub data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  // Section-specific refresh functions - only fetch and update the relevant section
  const refreshPipeline = useCallback(async () => {
    if (!walletAddress) return
    setRefreshingPipeline(true)
    try {
      const response = await fetch('/api/employer/hub', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (response.ok) {
        const result = await response.json()
        setData(prev => prev ? { ...prev, applicants: result.applicants, pipeline: result.pipeline } : null)
      }
    } catch (err) {
      console.error('Error refreshing pipeline:', err)
    } finally {
      setRefreshingPipeline(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress) {
      fetchHubData()
      fetchEmployerBlocks(walletAddress)
    }
  }, [walletAddress, fetchHubData, fetchEmployerBlocks])

  // Auto-refresh when tab becomes visible (solves stale data after changes in other tabs)
  const { refresh: triggerRefresh, isStale } = useVisibilityRefresh(fetchHubData, {
    staleTime: 30000, // Consider data stale after 30 seconds
    enabled: !!walletAddress,
  })

  // Redirect to company setup if onboarding is incomplete (must be in useEffect, not during render)
  useEffect(() => {
    if (!data || loading) return
    // No company at all — owner needs to create one
    if (data.needsCompanySetup) {
      onNavigate('company-setup')
      return
    }
    // Company exists but owner hasn't completed onboarding form
    if (data.company && !data.company.onboardingCompleted && data.userRole === 'owner') {
      onNavigate('company-setup')
    }
  }, [data, loading, onNavigate])

  // Handle application status change (for Kanban drag-drop)
  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      setUpdatingApplicationId(applicationId)
      
      const response = await fetch(`/api/employer/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to update status')
      }

      // Refresh data to get updated pipeline counts
      await fetchHubData()
    } catch (err) {
      console.error('Error updating application status:', err)
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingApplicationId(null)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${
            theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
          }`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading your employer hub...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`text-center p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
        }`}>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
            {error}
          </p>
          <button
            onClick={fetchHubData}
            className={`mt-4 px-6 py-2 rounded-lg font-medium ${
              theme === 'dark'
                ? 'bg-teal-500 text-white hover:bg-teal-600'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // No data yet or needs redirect to company setup (handled by useEffect above)
  if (!data) {
    return null
  }

  // While redirecting to company-setup, show nothing (prevents flash of hub content)
  if (data.needsCompanySetup || (data.company && !data.company.onboardingCompleted && data.userRole === 'owner')) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Company Header */}
      <div className={`rounded-2xl p-6 mb-8 border shadow-lg transition-all duration-200 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          : 'bg-white/70 border-gray-200 hover:border-gray-300'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
          }`}>
            <Building2 className={`w-8 h-8 ${
              theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {data.company?.name || 'Your Company'}
              </h1>
              {/* Role badge: applied per wallet in this company; only admins can change it */}
              {data.userRole && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  data.userRole === 'owner'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : data.userRole === 'admin'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : data.userRole === 'viewer'
                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                        : 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                }`}>
                  {getDisplayRole(data.userRole)}
                </span>
              )}
              {/* Manual refresh button */}
              <button
                onClick={triggerRefresh}
                disabled={loading}
                title={isStale ? 'Data may be stale - click to refresh' : 'Refresh data'}
                className={`p-1.5 rounded-lg transition-all ${
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {data.company?.verified && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {data.company?.city && data.company?.state 
                ? `${data.company.city}, ${data.company.state}` 
                : 'Location not set'}
              {data.company?.dotNumber && ` • DOT #${data.company.dotNumber}`}
            </p>
          </div>
          <div className={`text-right text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <p>Member since</p>
            <p className="font-medium">{formatDate(data.memberSince || '')}</p>
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="In Pipeline"
          value={data.stats.totalApplicants}
          subValue={data.stats.pendingReview > 0 ? `${data.stats.pendingReview} need review` : 'All reviewed'}
          theme={theme}
          highlight={data.stats.pendingReview > 0}
        />
        <StatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Jobs"
          value={data.stats.activeJobs}
          subValue={`${data.stats.totalJobs} total`}
          theme={theme}
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Interviewing"
          value={data.stats.interviewing}
          theme={theme}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Hired"
          value={data.stats.totalHires}
          subValue={`${data.stats.hiresThisMonth} this month`}
          theme={theme}
        />
      </div>

      {/* Quick Actions */}
      <div className={`flex flex-wrap items-center gap-2 mb-8 p-3 rounded-xl border ${
        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        {/* Primary: outreach */}
        <button
          onClick={() => document.getElementById('candidate-outreach')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all bg-teal-600 text-white hover:bg-teal-500"
        >
          <Link2 className="w-4 h-4" />
          New Outreach
        </button>
        <button
          onClick={() => onNavigate('talent-search')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Search className="w-4 h-4" />
          Find Talent
        </button>
        <button
          onClick={() => onNavigate('post-job')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Post Job
        </button>
        <button
          onClick={() => onNavigate('applicants')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Applicants
        </button>
        <button
          onClick={() => onNavigate('company-profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Company
        </button>
        {employerBlocks.some(b => b.blockType === 'employer-compliance-reports') && (
          <button
            onClick={() => onNavigate('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>
        )}
        <button
          onClick={() => onNavigate('team')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          Team
        </button>
      </div>

      {/* Ask AvA — prominent CTA for employer guidance */}
      <div className='mb-8'>
        <AskAvaButton label='Ask AvA — What should I do next?' />
      </div>

      {/* Job Postings — kanban by status */}
      <JobPostingsSection
        jobs={data.jobPostings}
        walletAddress={walletAddress}
        theme={theme}
        onPostJob={() => onNavigate('post-job')}
        onRefresh={fetchHubData}
        isCollapsed={!openSections.jobs}
        onToggle={() => toggleSection('jobs')}
      />

      {/* Hiring Pipeline — full-width kanban */}
      <div className={`rounded-2xl p-6 mb-8 border shadow-lg transition-all duration-200 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white/70 border-gray-200'
      }`}>
        <div className={`flex items-center justify-between ${openSections.pipeline ? 'mb-4' : ''}`}>
          <button
            onClick={() => toggleSection('pipeline')}
            className="flex items-center gap-2 text-left group"
          >
            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Hiring Pipeline
            </h2>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            } ${!openSections.pipeline ? '-rotate-90' : ''}`} />
          </button>
          {openSections.pipeline && (
            <button
              onClick={refreshPipeline}
              disabled={refreshingPipeline}
              title="Refresh pipeline"
              className={`p-2 rounded-lg transition-all ${
                refreshingPipeline ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              } ${isStale ? 'text-amber-500' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshingPipeline ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {openSections.pipeline && <div className="-mx-2 mt-2">
          {data.applicants.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="No applicants yet"
              description="Use New Outreach to invite candidates, or Find Talent to pull them in directly"
              actionLabel="Find Talent"
              onAction={() => onNavigate('talent-search')}
              theme={theme}
            />
          ) : (
            <ApplicantKanban
              applicants={data.applicants.map(a => ({
                applicationId: a.applicationId,
                status: a.status,
                appliedAt: a.appliedAt,
                applicantUserId: a.applicantUserId,
                applicantName: a.applicantName,
                applicantRole: a.applicantRole,
                avatarUrl: a.avatarUrl ?? null,
                jobTitle: a.jobTitle,
                jobPostingId: a.jobPostingId,
                hasResume: a.hasResume ?? false,
                resumeVerified: a.resumeVerified ?? false,
              }))}
              walletAddress={walletAddress}
              onStatusChange={handleStatusChange}
              onSelectApplicant={(applicant) => {
                const fullApplicant = data.applicants.find(
                  a => a.applicationId === applicant.applicationId
                )
                if (fullApplicant) setSelectedApplicant(fullApplicant)
              }}
              isUpdating={updatingApplicationId}
            />
          )}
        </div>}
      </div>

      {/* ── Composable Employer Blocks ──────────────────────────────── */}
      <EmployerBlockPickerModal />
      <EmployerBlockGrid
        blocks={employerBlocks}
        isEditMode={isEditMode}
        theme={theme}
        onOpen={(pageRoute) => { if (pageRoute) onNavigate(pageRoute) }}
        onRemove={(blockId) => removeBlock(blockId, walletAddress)}
        onEdit={() => setEditMode(!isEditMode)}
        onAdd={() => openPicker()}
      />

      {/* Employment Verification Section */}
      <div className="mb-8">
        <EmployerVerificationSection
          userAddress={walletAddress}
          isCollapsed={!openSections.verification}
          onToggle={() => toggleSection('verification')}
        />
      </div>

      {/* Candidate Outreach */}
      <div id="candidate-outreach" className="mb-8">
        <CandidateOutreach
          walletAddress={walletAddress}
          isCollapsed={!openSections.outreach}
          onToggle={() => toggleSection('outreach')}
        />
      </div>

      {/* Candidate card modal — z-index 1000 */}
      {selectedApplicant && (
        <Modal
          onClose={() => setSelectedApplicant(null)}
          maxWidth="max-w-4xl"
          zIndex={1000}
        >
          <ModalHeader
            title={selectedApplicant.applicantName || ''}
            subtitle={`Applied for ${selectedApplicant.jobTitle}`}
            onClose={() => setSelectedApplicant(null)}
          />
          {/* Career Card quick-action row */}
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
            <button
              onClick={() => setCareerCardApplicantId(selectedApplicant.applicantUserId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              View Career Card
            </button>
            <MessagingButton
              otherUserId={selectedApplicant.applicantUserId}
              applicationId={selectedApplicant.applicationId}
              subject={`Re: ${selectedApplicant.jobTitle} – ${selectedApplicant.applicantName}`}
              walletAddress={walletAddress}
              onThreadOpen={(threadId) => {
                setSelectedApplicant(null)
                navigateToMessages(threadId)
              }}
            />
          </div>
          <div className="p-4 grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <ApplicantDetailContent
                applicant={selectedApplicant}
                theme={theme}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className="md:col-span-1">
              <CandidateNotesPanel
                candidateUserId={selectedApplicant.applicantUserId}
                applicationId={selectedApplicant.applicationId}
                walletAddress={walletAddress}
                candidateName={selectedApplicant.applicantName || ''}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Career Card modal — z-index 10000, above the applicant modal */}
      {careerCardApplicantId && (
        <CareerCardModal
          candidateUserId={careerCardApplicantId}
          walletAddress={walletAddress}
          onClose={() => setCareerCardApplicantId(null)}
        />
      )}

      {/* ── STORM Token Footer ── */}
      <div className='pt-4'>
        <STORMBalance
          walletAddress={walletAddress}
          onReadWhitepaper={() => onNavigate('stormchain')}
        />
      </div>

    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  theme, 
  highlight 
}: { 
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  theme: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 border transition-all duration-200 ${
      theme === 'dark'
        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        : 'bg-white/70 border-gray-200 hover:border-gray-300 shadow-sm'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${
          theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
        }`}>
          <span className={theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}>
            {icon}
          </span>
        </div>
        <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${
        highlight
          ? 'text-orange-500'
          : theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        {value}
      </p>
      {subValue && (
        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          {subValue}
        </p>
      )}
    </div>
  )
}


function Section({ 
  title, 
  icon, 
  count, 
  theme, 
  action, 
  children 
}: { 
  title: string
  icon: React.ReactNode
  count?: number
  theme: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-200 ${
      theme === 'dark'
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-white/70 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
          }`}>
            <span className={theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}>
              {icon}
            </span>
          </div>
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          {count !== undefined && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${
              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction, 
  theme 
}: { 
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  theme: string
}) {
  return (
    <div className={`text-center py-8 px-4 rounded-xl border-2 border-dashed ${
      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className={`mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
        {icon}
      </div>
      <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
        {title}
      </h4>
      <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            theme === 'dark'
              ? 'bg-teal-500 text-white hover:bg-teal-600'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function ApplicantRow({ 
  applicant, 
  onClick, 
  theme 
}: { 
  applicant: HubApplicant
  onClick: () => void
  theme: string
}) {
  const name = applicant.applicantName || 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
        theme === 'dark'
          ? 'hover:bg-gray-700/50'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
      }`}>
        <span className={`text-sm font-bold ${
          theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
        }`}>
          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </p>
        <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {applicant.jobTitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={applicant.status} theme={theme} />
        <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
      </div>
    </button>
  )
}

function StatusBadge({ status, theme }: { status: string; theme: string }) {
  const config = getStatusConfig(status)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  )
}

function ApplicantDetailContent({
  applicant,
  theme,
  onStatusChange,
}: {
  applicant: HubApplicant
  theme: string
  onStatusChange: (applicationId: string, newStatus: string) => Promise<void>
}) {
  const [changingStatus, setChangingStatus] = useState(false)

  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === applicant.status) return
    setChangingStatus(true)
    try {
      await onStatusChange(applicant.applicationId, newStatus)
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Section */}
      <div className={`p-4 rounded-xl ${
        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Application Status</p>
            <p className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {applicant.status}
            </p>
          </div>
          <select
            value={applicant.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={changingStatus}
            className={`px-3 py-2 text-sm rounded-lg border ${
              changingStatus ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              theme === 'dark'
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="submitted">New</option>
            <option value="under_review">Reviewing</option>
            <option value="interview">Interviewing</option>
            <option value="offer">Offer Sent</option>
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Headline */}
      {applicant.applicantHeadline && (
        <div>
          <p className={labelClass}>Headline</p>
          <p className={valueClass}>{applicant.applicantHeadline}</p>
        </div>
      )}

      {/* Contact Info */}
      <div className="flex flex-wrap gap-3">
        {applicant.applicantEmail && (
          <a
            href={`mailto:${applicant.applicantEmail}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            {applicant.applicantEmail}
          </a>
        )}
        {applicant.applicantPhone && (
          <a
            href={`tel:${applicant.applicantPhone}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            {applicant.applicantPhone}
          </a>
        )}
      </div>

      {/* Application Details */}
      <div>
        <p className={labelClass}>Applied</p>
        <p className={valueClass}>{formatDate(applicant.appliedAt)}</p>
      </div>
      <div>
        <p className={labelClass}>Status</p>
        <StatusBadge status={applicant.status} theme={theme} />
      </div>
      <div>
        <p className={labelClass}>View Count</p>
        <p className={valueClass}>{applicant.viewCount} views</p>
      </div>

      {/* Resume */}
      <div>
        <p className={labelClass}>Resume</p>
        {applicant.hasResume ? (
          <div className="flex items-center gap-2 mt-1">
            <FileText className={`w-4 h-4 ${
              applicant.resumeVerified ? 'text-green-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <span className={valueClass}>
              {applicant.resumeVerified ? 'Verified Resume' : 'Resume Attached'}
            </span>
          </div>
        ) : (
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            No resume attached
          </p>
        )}
      </div>

      {/* Cover Letter */}
      {applicant.coverLetter && (
        <div>
          <p className={labelClass}>Cover Letter</p>
          <p className={`${valueClass} mt-1 p-3 rounded-lg ${
            theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
          }`}>
            {applicant.coverLetter}
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// EMPLOYER BLOCK GRID
// ============================================================

function resolveIcon(name: string) {
  const Icon = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[name]
  return Icon ?? LucideIcons.Box
}

interface EmployerBlockGridProps {
  blocks: { id: string; blockType: string; definition: { label: string; description: string; icon: string; pageRoute: string | null } | null }[]
  isEditMode: boolean
  theme: string
  onOpen: (pageRoute: string | null) => void
  onRemove: (blockId: string) => void
  onEdit: () => void
  onAdd: () => void
}

function EmployerBlockGrid({ blocks, isEditMode, theme, onOpen, onRemove, onEdit, onAdd }: EmployerBlockGridProps) {
  const isDark = theme === 'dark'

  return (
    <div className={cn(
      'rounded-2xl p-6 mb-8 border shadow-lg transition-all duration-200',
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
    )}>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-3'>
          <div className={cn('p-2 rounded-lg', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
            <Package className={cn('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
          </div>
          <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Industry Tools
          </h3>
          {blocks.length > 0 && (
            <span className={cn('text-sm px-2.5 py-0.5 rounded-full font-medium', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
              {blocks.length}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {blocks.length > 0 && (
            <button
              onClick={onEdit}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isEditMode
                  ? 'bg-blue-500 text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Pencil className='w-3.5 h-3.5' />
              {isEditMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button
            onClick={onAdd}
            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors'
          >
            <Plus className='w-3.5 h-3.5' />
            Add
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className={cn(
          'text-center py-8 px-4 rounded-xl border-2 border-dashed',
          isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
        )}>
          <Package className={cn('w-12 h-12 mx-auto mb-2', isDark ? 'text-gray-600' : 'text-gray-400')} />
          <h4 className={cn('font-semibold mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            No industry tools added yet
          </h4>
          <p className={cn('text-sm mb-4', isDark ? 'text-gray-500' : 'text-gray-500')}>
            Add tools specific to your hiring needs — driver compliance, code assessments, and more.
          </p>
          <button
            onClick={onAdd}
            className='px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors'
          >
            Browse Tools
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
          {blocks.map((block) => {
            const def = block.definition
            if (!def) return null
            const BlockIcon = resolveIcon(def.icon)

            return (
              <div
                key={block.id}
                className={cn(
                  'relative group rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                  isDark
                    ? 'bg-gray-700/30 border-gray-600 hover:border-blue-500/40 hover:bg-gray-700/50'
                    : 'bg-white border-gray-200 hover:border-blue-400/50 hover:bg-blue-50/30',
                  isEditMode && '[animation:jiggle_0.3s_ease-in-out_infinite]'
                )}
                onClick={() => {
                  if (isEditMode) return
                  onOpen(def.pageRoute)
                }}
              >
                {isEditMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(block.id) }}
                    className='absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 z-10'
                  >
                    <X className='w-3.5 h-3.5' />
                  </button>
                )}
                <div className='flex items-center gap-3'>
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                  )}>
                    <BlockIcon className={cn('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
                  </div>
                  <div className='min-w-0'>
                    <p className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-gray-900')}>
                      {def.label}
                    </p>
                    <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {def.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateString))
  } catch {
    return dateString
  }
}

function formatSalary(min: number | null, max: number | null): string {
  if (min && max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`
  }
  if (min) {
    return `$${min.toLocaleString()}+`
  }
  if (max) {
    return `Up to $${max.toLocaleString()}`
  }
  return 'Not specified'
}

function getStatusConfig(status: string): { label: string; icon: React.ReactNode; className: string } {
  const normalized = status?.toLowerCase() || ''
  
  switch (normalized) {
    case 'submitted':
    case 'new':
      return {
        label: 'New',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      }
    case 'viewed':
    case 'reviewing':
      return {
        label: 'Reviewing',
        icon: <Eye className="w-3 h-3" />,
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      }
    case 'interview':
    case 'interviewing':
      return {
        label: 'Interviewing',
        icon: <MessageSquare className="w-3 h-3" />,
        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      }
    case 'offer':
    case 'offer_sent':
      return {
        label: 'Offer Sent',
        icon: <FileText className="w-3 h-3" />,
        className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      }
    case 'hired':
      return {
        label: 'Hired',
        icon: <UserCheck className="w-3 h-3" />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        icon: <UserX className="w-3 h-3" />,
        className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      }
    case 'completed':
      return {
        label: 'Completed',
        icon: <CheckCircle className="w-3 h-3" />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'pending':
      return {
        label: 'Pending',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      }
    case 'processing':
      return {
        label: 'Processing',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      }
    default:
      return {
        label: status || 'Unknown',
        icon: <AlertCircle className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
  }
}
