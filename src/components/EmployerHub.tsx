'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import EmployerVerificationSection from './verification/EmployerVerificationSection'
import ApplicantKanban, { type KanbanApplicant } from './employer/ApplicantKanban'
import CandidateNotesPanel from './employer/CandidateNotesPanel'
import {
  Briefcase,
  Users,
  FileText,
  Car,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  ChevronRight,
  Building2,
  Calendar,
  TrendingUp,
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
  ClipboardCheck,
  Code,
  LayoutGrid,
  List,
} from 'lucide-react'

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
  equipmentType: string | null
  experienceRequired: number | null
  routeType: string | null
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
  applicantUserId: string  // Renamed from driverUserId for generic use
  applicantName: string    // Renamed from driverName
  applicantEmail: string | null
  applicantPhone: string | null
  applicantRole: string | null  // 'driver' or 'developer'
  // Driver-specific (null for developers)
  cdlClass: string | null
  cdlState: string | null
  cdlExpiration: string | null
  experienceYears: number | null
  // Developer-specific (null for drivers)
  skills: string[] | null
  githubUrl: string | null
  portfolioUrl: string | null
  // Common
  jobPostingId: string
  jobTitle: string
  hasResume: boolean
  resumeId: string | null
  resumeVerified: boolean
}

interface HubMvrOrder {
  id: string
  status: string
  licenseState: string
  createdAt: string
  completedAt: string | null
  feeAmount: string | null
  driverUserId: string
  driverName: string
  hasResult: boolean
  licenseStatus: string | null
  totalPoints: number | null
  violationCount: number
  resultStatus: string | null
}

interface HubStats {
  activeJobs: number
  totalJobs: number
  totalApplicants: number
  pendingReview: number
  interviewing: number
  hiresThisMonth: number
  totalHires: number
  totalMvrOrders: number
  completedMvrOrders: number
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
  jobPostings: HubJobPosting[]
  applicants: HubApplicant[]
  mvrOrders: HubMvrOrder[]
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
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Detail modal states
  const [selectedApplicant, setSelectedApplicant] = useState<HubApplicant | null>(null)
  const [selectedJob, setSelectedJob] = useState<HubJobPosting | null>(null)
  const [selectedMvr, setSelectedMvr] = useState<HubMvrOrder | null>(null)

  // Pipeline view state (list vs kanban)
  const [pipelineView, setPipelineView] = useState<'list' | 'kanban'>('kanban')
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)

  // Employment verification states
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyingDriverId, setVerifyingDriverId] = useState<string | null>(null)
  const [driverEmployments, setDriverEmployments] = useState<any[]>([])
  const [loadingEmployments, setLoadingEmployments] = useState(false)
  const [initiatingVerification, setInitiatingVerification] = useState(false)

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

  useEffect(() => {
    if (walletAddress) {
      fetchHubData()
    }
  }, [walletAddress, fetchHubData])

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

  // Open employment verification modal
  const openVerifyEmploymentModal = async (driverUserId: string) => {
    setVerifyingDriverId(driverUserId)
    setShowVerifyModal(true)
    setLoadingEmployments(true)
    setDriverEmployments([])

    try {
      // Fetch driver's employment history
      const response = await fetch(`/api/driver/profile?userId=${driverUserId}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (response.ok) {
        const data = await response.json()
        setDriverEmployments(data.profile?.employmentHistory || [])
      }
    } catch (err) {
      console.error('Error fetching driver employment:', err)
    } finally {
      setLoadingEmployments(false)
    }
  }

  // Initiate verification for selected employment
  const initiateVerification = async (employmentId: string, employment: any) => {
    if (!verifyingDriverId) return

    setInitiatingVerification(true)
    try {
      const response = await fetch('/api/verification/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          driverId: verifyingDriverId,
          employmentId: employmentId,
          previousEmployerEmail: employment.supervisorEmail,
          previousEmployerPhone: employment.supervisorPhone,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('Verification request created successfully!')
        setShowVerifyModal(false)
        setSelectedApplicant(null)
        // Refresh the page to show updated verification status
        fetchHubData()
      } else {
        alert(data.error || 'Failed to create verification request')
      }
    } catch (err) {
      console.error('Error initiating verification:', err)
      alert('Failed to create verification request')
    } finally {
      setInitiatingVerification(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
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
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // No data / new user state
  if (!data) {
    return null
  }

  // Company setup required
  if (data.needsCompanySetup) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className={`rounded-2xl p-8 text-center ${
          theme === 'dark'
            ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
            : 'bg-white border border-brand-sage/20 shadow-xl'
        }`}>
          <Building2 className={`w-16 h-16 mx-auto mb-6 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`} />
          <h2 className={`text-2xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Set Up Your Company Profile
          </h2>
          <p className={`mb-8 max-w-md mx-auto ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Before you can post jobs and review applicants, you'll need to create your company profile.
          </p>
          <button
            onClick={() => onNavigate('company-setup')}
            className={`px-8 py-3 rounded-xl font-semibold text-lg ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
          >
            Create Company Profile
          </button>
        </div>
      </div>
    )
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
            theme === 'dark' ? 'bg-brand-mint/20' : 'bg-brand-sage/10'
          }`}>
            <Building2 className={`w-8 h-8 ${
              theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {data.company?.name || 'Your Company'}
              </h1>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Jobs"
          value={data.stats.activeJobs}
          subValue={`${data.stats.totalJobs} total`}
          theme={theme}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Applicants"
          value={data.stats.totalApplicants}
          subValue={`${data.stats.pendingReview} pending review`}
          theme={theme}
          highlight={data.stats.pendingReview > 0}
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Interviewing"
          value={data.stats.interviewing}
          theme={theme}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Hires"
          value={data.stats.totalHires}
          subValue={`${data.stats.hiresThisMonth} this month`}
          theme={theme}
        />
      </div>

      {/* Pipeline Section */}
      <div className={`rounded-2xl p-6 mb-8 border shadow-lg transition-all duration-200 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white/70 border-gray-200'
      }`}>
        {/* Header with View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Hiring Pipeline
          </h2>
          <div className={`flex items-center gap-1 p-1 rounded-lg ${
            theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'
          }`}>
            <button
              onClick={() => setPipelineView('list')}
              className={`p-2 rounded-md transition-colors ${
                pipelineView === 'list'
                  ? 'bg-teal-600 text-white'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPipelineView('kanban')}
              className={`p-2 rounded-md transition-colors ${
                pipelineView === 'kanban'
                  ? 'bg-teal-600 text-white'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Kanban view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List View - Compact Pipeline Summary */}
        {pipelineView === 'list' && (
          <>
            <div className="flex flex-wrap gap-2">
              <PipelineStage label="New" count={data.pipeline.new} color="blue" theme={theme} />
              <ChevronRight className={`w-5 h-5 self-center ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <PipelineStage label="Reviewing" count={data.pipeline.reviewing} color="purple" theme={theme} />
              <ChevronRight className={`w-5 h-5 self-center ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <PipelineStage label="Interviewing" count={data.pipeline.interviewing} color="orange" theme={theme} />
              <ChevronRight className={`w-5 h-5 self-center ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <PipelineStage label="Offer Sent" count={data.pipeline.offerSent} color="cyan" theme={theme} />
              <ChevronRight className={`w-5 h-5 self-center ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <PipelineStage label="Hired" count={data.pipeline.hired} color="green" theme={theme} />
            </div>
            {data.pipeline.rejected > 0 && (
              <p className={`mt-3 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {data.pipeline.rejected} rejected
              </p>
            )}
          </>
        )}

        {/* Kanban View - Full Board */}
        {pipelineView === 'kanban' && (
          <div className="-mx-2 mt-2">
            {data.applicants.length === 0 ? (
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title="No applicants yet"
                description="Post a job or search for talent to start building your pipeline"
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
                  jobTitle: a.jobTitle,
                  jobPostingId: a.jobPostingId,
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
          </div>
        )}
      </div>

      {/* Employment Verification Section */}
      <div className="mb-8">
        <EmployerVerificationSection userAddress={walletAddress} />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Applicants */}
        <Section
          title="Recent Applicants"
          icon={<Users className="w-5 h-5" />}
          count={data.applicants.length}
          theme={theme}
          action={
            data.applicants.length > 0 ? (
              <button
                onClick={() => onNavigate('applicants')}
                className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`}
              >
                View All
              </button>
            ) : null
          }
        >
          {data.applicants.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="No applicants yet"
              description="Post a job or search for talent to start building your candidate pipeline"
              actionLabel="Find Talent"
              onAction={() => onNavigate('talent-search')}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.applicants.slice(0, 5).map((applicant) => (
                <ApplicantRow
                  key={applicant.applicationId}
                  applicant={applicant}
                  onClick={() => setSelectedApplicant(applicant)}
                  theme={theme}
                />
              ))}
              {data.applicants.length > 5 && (
                <button
                  onClick={() => onNavigate('applicants')}
                  className={`w-full text-center py-2 text-sm font-medium ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  +{data.applicants.length - 5} more applicants
                </button>
              )}
            </div>
          )}
        </Section>

        {/* Job Postings */}
        <Section
          title="Job Postings"
          icon={<Briefcase className="w-5 h-5" />}
          count={data.jobPostings.length}
          theme={theme}
          action={
            <button
              onClick={() => onNavigate('post-job')}
              className={`flex items-center gap-1 text-sm font-medium ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`}
            >
              <Plus className="w-4 h-4" />
              Post Job
            </button>
          }
        >
          {data.jobPostings.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-12 h-12" />}
              title="No job postings"
              description="Create your first job posting to attract qualified candidates"
              actionLabel="Post a Job"
              onAction={() => onNavigate('post-job')}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.jobPostings.slice(0, 4).map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJob(job)}
                  theme={theme}
                />
              ))}
              {data.jobPostings.length > 4 && (
                <button
                  onClick={() => onNavigate('jobs')}
                  className={`w-full text-center py-2 text-sm font-medium ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  +{data.jobPostings.length - 4} more jobs
                </button>
              )}
            </div>
          )}
        </Section>

        {/* MVR Orders */}
        <Section
          title="MVR Orders"
          icon={<Car className="w-5 h-5" />}
          count={data.mvrOrders.length}
          theme={theme}
        >
          {data.mvrOrders.length === 0 ? (
            <EmptyState
              icon={<Car className="w-12 h-12" />}
              title="No MVR orders"
              description="Order Motor Vehicle Reports for applicants during the review process"
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.mvrOrders.slice(0, 4).map((mvr) => (
                <MvrRow
                  key={mvr.id}
                  mvr={mvr}
                  onClick={() => setSelectedMvr(mvr)}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Quick Actions */}
        <Section
          title="Quick Actions"
          icon={<TrendingUp className="w-5 h-5" />}
          theme={theme}
        >
          <div className="space-y-3">
            {/* Primary action - Find Talent */}
            <button
              onClick={() => onNavigate('talent-search')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl font-medium transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400 shadow-lg shadow-teal-500/20'
                  : 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400 shadow-lg shadow-teal-500/30'
              }`}
            >
              <div className="p-2 bg-white/20 rounded-lg">
                <Search className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-semibold">Find Talent</span>
                <span className="text-sm opacity-90">Search drivers & developers</span>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto" />
            </button>
            
            {/* Secondary actions grid */}
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                icon={<Plus className="w-5 h-5" />}
                label="Post New Job"
                onClick={() => onNavigate('post-job')}
                theme={theme}
                primary
              />
              <ActionButton
                icon={<Users className="w-5 h-5" />}
                label="View Applicants"
                onClick={() => onNavigate('applicants')}
                theme={theme}
              />
              <ActionButton
                icon={<Building2 className="w-5 h-5" />}
                label="Company Profile"
                onClick={() => onNavigate('company-profile')}
                theme={theme}
              />
              <ActionButton
                icon={<FileText className="w-5 h-5" />}
                label="View Reports"
                onClick={() => onNavigate('reports')}
                theme={theme}
              />
            </div>
          </div>
        </Section>
      </div>

      {/* Detail Modals */}
      {selectedApplicant && (
        <DetailModal
          title={selectedApplicant.applicantName || (selectedApplicant as any).driverName}
          subtitle={`Applied for ${selectedApplicant.jobTitle}`}
          onClose={() => setSelectedApplicant(null)}
          theme={theme}
        >
          <div className="grid md:grid-cols-3 gap-4">
            {/* Main Applicant Details */}
            <div className="md:col-span-2">
              <ApplicantDetailContent
                applicant={selectedApplicant}
                theme={theme}
                walletAddress={walletAddress}
                onOrderMvr={() => {
                  // TODO: Implement MVR ordering
                  console.log('Order MVR for', selectedApplicant.applicantUserId)
                }}
                onVerifyEmployment={() => {
                  openVerifyEmploymentModal(selectedApplicant.applicantUserId || (selectedApplicant as any).driverUserId)
                }}
                onStatusChange={handleStatusChange}
              />
            </div>
            {/* Notes Panel */}
            <div className="md:col-span-1">
              <CandidateNotesPanel
                candidateUserId={selectedApplicant.applicantUserId || (selectedApplicant as any).driverUserId}
                applicationId={selectedApplicant.applicationId}
                walletAddress={walletAddress}
                candidateName={selectedApplicant.applicantName || (selectedApplicant as any).driverName}
              />
            </div>
          </div>
        </DetailModal>
      )}

      {selectedJob && (
        <DetailModal
          title={selectedJob.title}
          subtitle={selectedJob.isActive ? 'Active' : 'Inactive'}
          onClose={() => setSelectedJob(null)}
          theme={theme}
        >
          <JobDetailContent job={selectedJob} theme={theme} />
        </DetailModal>
      )}

      {selectedMvr && (
        <DetailModal
          title={`MVR - ${selectedMvr.driverName}`}
          subtitle={selectedMvr.licenseState}
          onClose={() => setSelectedMvr(null)}
          theme={theme}
        >
          <MvrDetailContent mvr={selectedMvr} theme={theme} />
        </DetailModal>
      )}

      {/* Employment Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowVerifyModal(false)} 
          />
          <div className={`relative w-full max-w-lg rounded-2xl p-6 ${
            theme === 'dark'
              ? 'bg-gray-900 border border-gray-700'
              : 'bg-white shadow-2xl'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Verify Employment History
              </h3>
              <button
                onClick={() => setShowVerifyModal(false)}
                className={`p-1 rounded-lg ${
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>

            <p className={`text-sm mb-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Select an employment record to verify with the previous employer:
            </p>

            {loadingEmployments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={`w-8 h-8 animate-spin ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`} />
              </div>
            ) : driverEmployments.length === 0 ? (
              <div className={`text-center py-8 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No employment history found for this driver</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {driverEmployments.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => initiateVerification(emp.id, emp)}
                    disabled={initiatingVerification}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:border-brand-mint/50 hover:bg-gray-800'
                        : 'bg-gray-50 border-gray-200 hover:border-brand-sage/50 hover:bg-gray-100'
                    } ${initiatingVerification ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {emp.companyName}
                        </p>
                        <p className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {emp.position}
                        </p>
                        <p className={`text-xs mt-1 ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {emp.startDate} - {emp.endDate || 'Present'}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {initiatingVerification && (
              <div className={`mt-4 flex items-center justify-center gap-2 text-sm ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating verification request...
              </div>
            )}
          </div>
        </div>
      )}
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

function PipelineStage({ 
  label, 
  count, 
  color, 
  theme 
}: { 
  label: string
  count: number
  color: 'blue' | 'purple' | 'orange' | 'cyan' | 'green'
  theme: string
}) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
    green: 'bg-green-500/20 text-green-500 border-green-500/30',
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${colors[color]}`}>
      <span className="font-bold text-lg">{count}</span>
      <span className="text-sm">{label}</span>
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
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90'
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
  // Support both old field names (driverName) and new (applicantName) during transition
  const name = (applicant as any).applicantName || (applicant as any).driverName || 'Unknown'
  const role = (applicant as any).applicantRole || 'driver'
  
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
        role === 'developer'
          ? theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
          : theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
      }`}>
        <span className={`text-sm font-bold ${
          role === 'developer'
            ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            : theme === 'dark' ? 'text-teal-400' : 'text-teal-600'
        }`}>
          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {name}
          </p>
          {role && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              role === 'developer'
                ? 'bg-purple-500/10 text-purple-500'
                : 'bg-teal-500/10 text-teal-500'
            }`}>
              {role === 'developer' ? 'Dev' : 'Driver'}
            </span>
          )}
        </div>
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

function JobRow({ 
  job, 
  onClick, 
  theme 
}: { 
  job: HubJobPosting
  onClick: () => void
  theme: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
        theme === 'dark'
          ? 'hover:bg-gray-700/50'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        job.isActive
          ? theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
          : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        <Briefcase className={`w-5 h-5 ${
          job.isActive ? 'text-green-500' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {job.title}
        </p>
        <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {job.locationCity && job.locationState 
            ? `${job.locationCity}, ${job.locationState}` 
            : 'Location not set'}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${
          job.newApplications > 0 ? 'text-orange-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {job.newApplications > 0 ? `${job.newApplications} new` : `${job.totalApplications} apps`}
        </p>
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          {job.isActive ? 'Active' : 'Inactive'}
        </p>
      </div>
    </button>
  )
}

function MvrRow({ 
  mvr, 
  onClick, 
  theme 
}: { 
  mvr: HubMvrOrder
  onClick: () => void
  theme: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
        theme === 'dark'
          ? 'hover:bg-gray-700/50'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        mvr.hasResult
          ? theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
          : theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100'
      }`}>
        <Car className={`w-5 h-5 ${
          mvr.hasResult ? 'text-green-500' : 'text-yellow-500'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {mvr.driverName}
        </p>
        <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {mvr.licenseState} • {formatDate(mvr.createdAt)}
        </p>
      </div>
      <StatusBadge status={mvr.status} theme={theme} />
    </button>
  )
}

function ActionButton({ 
  icon, 
  label, 
  onClick, 
  theme, 
  primary 
}: { 
  icon: React.ReactNode
  label: string
  onClick: () => void
  theme: string
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors ${
        primary
          ? theme === 'dark'
            ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
            : 'bg-brand-sage text-white hover:bg-brand-sage/90'
          : theme === 'dark'
            ? 'bg-gray-700/50 text-white hover:bg-gray-700'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
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

function DetailModal({ 
  title, 
  subtitle, 
  onClose, 
  theme, 
  children 
}: { 
  title: string
  subtitle?: string
  onClose: () => void
  theme: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl ${
        theme === 'dark'
          ? 'bg-brand-sage-dark border border-brand-mint/30'
          : 'bg-white shadow-2xl'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700 bg-brand-sage-dark' : 'border-gray-200 bg-white'
        }`}>
          <div>
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h3>
            {subtitle && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function ApplicantDetailContent({ 
  applicant, 
  theme,
  walletAddress,
  onOrderMvr,
  onVerifyEmployment,
  onStatusChange,
}: { 
  applicant: HubApplicant
  theme: string
  walletAddress: string
  onOrderMvr: () => void
  onVerifyEmployment: () => void
  onStatusChange: (applicationId: string, newStatus: string) => Promise<void>
}) {
  const [changingStatus, setChangingStatus] = useState(false)
  
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`
  
  // Support both old and new field names during transition
  const email = (applicant as any).applicantEmail || (applicant as any).driverEmail
  const phone = (applicant as any).applicantPhone || (applicant as any).driverPhone
  const role = (applicant as any).applicantRole || 'driver'
  const isDriver = role === 'driver'

  const statusLabels: Record<string, { label: string; color: string }> = {
    submitted: { label: 'New', color: 'blue' },
    under_review: { label: 'Reviewing', color: 'yellow' },
    interview: { label: 'Interviewing', color: 'purple' },
    offer: { label: 'Offer Sent', color: 'teal' },
    hired: { label: 'Hired', color: 'green' },
    rejected: { label: 'Rejected', color: 'gray' },
    withdrawn: { label: 'Withdrawn', color: 'gray' },
  }

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
              {statusLabels[applicant.status]?.label || applicant.status}
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

      {/* Contact Info */}
      <div className="flex flex-wrap gap-3">
        {email && (
          <a
            href={`mailto:${email}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            {email}
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            {phone}
          </a>
        )}
      </div>

      {/* Driver-specific: CDL Info */}
      {isDriver && (applicant.cdlClass || applicant.cdlState) && (
        <div className={`p-4 rounded-xl ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <h4 className={`font-medium mb-3 flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <Shield className="w-4 h-4" />
            CDL Information
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {applicant.cdlClass && (
              <div>
                <p className={labelClass}>Class</p>
                <p className={valueClass}>{applicant.cdlClass}</p>
              </div>
            )}
            {applicant.cdlState && (
              <div>
                <p className={labelClass}>State</p>
                <p className={valueClass}>{applicant.cdlState}</p>
              </div>
            )}
            {applicant.experienceYears && (
              <div>
                <p className={labelClass}>Experience</p>
                <p className={valueClass}>{applicant.experienceYears} years</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Developer-specific: Skills & Links */}
      {!isDriver && (applicant.skills || applicant.githubUrl || applicant.portfolioUrl) && (
        <div className={`p-4 rounded-xl ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <h4 className={`font-medium mb-3 flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <Code className="w-4 h-4" />
            Developer Info
          </h4>
          {applicant.skills && applicant.skills.length > 0 && (
            <div className="mb-3">
              <p className={labelClass}>Skills</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {applicant.skills.map((skill, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-xs ${
                    theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            {applicant.githubUrl && (
              <a href={applicant.githubUrl} target="_blank" rel="noopener noreferrer" 
                className={`text-sm ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} hover:underline`}>
                GitHub ↗
              </a>
            )}
            {applicant.portfolioUrl && (
              <a href={applicant.portfolioUrl} target="_blank" rel="noopener noreferrer"
                className={`text-sm ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} hover:underline`}>
                Portfolio ↗
              </a>
            )}
          </div>
        </div>
      )}

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

      {/* Actions */}
      <div className="pt-4 space-y-3">
        <button
          onClick={onVerifyEmployment}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            theme === 'dark'
              ? 'bg-teal-500 text-white hover:bg-teal-400'
              : 'bg-teal-600 text-white hover:bg-teal-500'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Verify Employment History
        </button>
        {isDriver && (
          <button
            onClick={onOrderMvr}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30'
                : 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Car className="w-4 h-4" />
            Order MVR Report
          </button>
        )}
      </div>
    </div>
  )
}

function JobDetailContent({ job, theme }: { job: HubJobPosting; theme: string }) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
          job.isActive
            ? 'bg-green-500/20 text-green-500'
            : 'bg-gray-500/20 text-gray-500'
        }`}>
          {job.isActive ? 'Active' : 'Inactive'}
        </span>
        {job.jobType && (
          <span className={`px-2 py-1 rounded-lg text-xs ${
            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
          }`}>
            {job.jobType}
          </span>
        )}
      </div>

      {job.locationCity && job.locationState && (
        <div>
          <p className={labelClass}>Location</p>
          <p className={`${valueClass} flex items-center gap-1`}>
            <MapPin className="w-4 h-4" />
            {job.locationCity}, {job.locationState}
          </p>
        </div>
      )}

      {(job.salaryMin || job.salaryMax) && (
        <div>
          <p className={labelClass}>Salary Range</p>
          <p className={`${valueClass} flex items-center gap-1`}>
            <DollarSign className="w-4 h-4" />
            {formatSalary(job.salaryMin, job.salaryMax)}
          </p>
        </div>
      )}

      {job.equipmentType && (
        <div>
          <p className={labelClass}>Equipment Type</p>
          <p className={valueClass}>{job.equipmentType}</p>
        </div>
      )}

      {job.routeType && (
        <div>
          <p className={labelClass}>Route Type</p>
          <p className={valueClass}>{job.routeType}</p>
        </div>
      )}

      <div>
        <p className={labelClass}>Posted</p>
        <p className={valueClass}>{formatDate(job.createdAt)}</p>
      </div>

      {/* Stats */}
      <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Application Stats
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-500">{job.totalApplications}</p>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{job.newApplications}</p>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>New</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{job.viewedApplications}</p>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Viewed</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MvrDetailContent({ mvr, theme }: { mvr: HubMvrOrder; theme: string }) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>Status</p>
        <StatusBadge status={mvr.status} theme={theme} />
      </div>
      <div>
        <p className={labelClass}>License State</p>
        <p className={valueClass}>{mvr.licenseState}</p>
      </div>
      <div>
        <p className={labelClass}>Ordered</p>
        <p className={valueClass}>{formatDate(mvr.createdAt)}</p>
      </div>
      {mvr.completedAt && (
        <div>
          <p className={labelClass}>Completed</p>
          <p className={valueClass}>{formatDate(mvr.completedAt)}</p>
        </div>
      )}

      {mvr.hasResult && (
        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
          <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            MVR Results
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelClass}>License Status</p>
              <p className={`${valueClass} ${
                mvr.licenseStatus === 'Valid' ? 'text-green-500' : 'text-red-500'
              }`}>
                {mvr.licenseStatus || 'Unknown'}
              </p>
            </div>
            <div>
              <p className={labelClass}>Total Points</p>
              <p className={valueClass}>{mvr.totalPoints ?? 'N/A'}</p>
            </div>
            <div>
              <p className={labelClass}>Violations</p>
              <p className={`${valueClass} ${
                mvr.violationCount > 0 ? 'text-orange-500' : 'text-green-500'
              }`}>
                {mvr.violationCount}
              </p>
            </div>
            <div>
              <p className={labelClass}>Result Status</p>
              <p className={valueClass}>{mvr.resultStatus || 'Pending'}</p>
            </div>
          </div>
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
