'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import ApplicantKanban, { type KanbanApplicant } from './employer/ApplicantKanban'
import CandidateNotesPanel from './employer/CandidateNotesPanel'
import CandidateOutreach from './employer/CandidateOutreach'
import JobPostingsSection from './employer/JobPostingsSection'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import CareerCardModal from '@/components/employer/CareerCardModal'
import MessagingButton from '@/components/messaging/MessagingButton'
import { useUIStore } from '@/stores'
import { useEmployerHiringPathStore } from '@/stores/employer-journey-snapshot-store'
import { calculateEmployerProgress, type EmployerProgressData } from '@/lib/journey-progress'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import {
  Briefcase,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Loader2,
  MapPin,
  DollarSign,
  ExternalLink,
  UserX,
  MessageSquare,
  Phone,
  Mail,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmployerHubContext } from '@/lib/ava-context'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'
import { useEmployerScreenings } from '@/hooks/useEmployerScreenings'
import DqMonitorSection from '@/components/employer/dq/DqMonitorSection'

/** Flip to true to show Activity snapshot, Job postings, and Hiring pipeline again. */
const SHOW_HUB_OPS_SECTIONS = false

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
  companyWalletAddress?: string | null
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
  contacted: number
  archived: number
  archivedThisMonth?: number
}

interface HubPipeline {
  new: number
  contacted: number
  archived: number
}

interface EmployerAccessPendingInfo {
  companyName: string
  status: string
  submittedAt: string
  reviewNote?: string | null
}

interface HubData {
  success: boolean
  isNewUser: boolean
  needsCompanySetup?: boolean
  /** Pending Stormi / admin employer access — show waiting state instead of company-setup loop */
  employerAccessPending?: EmployerAccessPendingInfo | null
  /** DB `users.ava_auto_welcome_employer_at` — cross-device Stormi auto-welcome idempotency */
  avaAutoWelcomeEmployerDone?: boolean
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
  sessionUserId: string
  onNavigate: (view: string) => void
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EmployerHub({ sessionUserId, onNavigate }: EmployerHubProps) {
  const { theme } = useTheme()
  // Paper hub — candidate Build / career card already ignore dark theme.
  const isDark = false
  const { navigateToMessages } = useUIStore()
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)
  const setEmployerNavSnapshot = useUIStore((s) => s.setEmployerNavSnapshot)
  const lastHubRefreshNonce = useRef<number | null>(null)
  const setEmployerHiringPath = useEmployerHiringPathStore((s) => s.setEmployerHiringPath)
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail modal states
  const [selectedApplicant, setSelectedApplicant] = useState<HubApplicant | null>(null)
  const [careerCardApplicantId, setCareerCardApplicantId] = useState<string | null>(null)

  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)
  const [removingApplicationId, setRemovingApplicationId] = useState<string | null>(null)

  // Section-specific loading states for granular refresh
  const [refreshingPipeline, setRefreshingPipeline] = useState(false)

  // Employer blocks are preinstalled — the fetch auto-provisions server-side.
  // CandidateOutreach reads the resulting installed list from this store itself.
  const fetchEmployerBlocks = useEmployerBlocksStore((s) => s.fetchEmployerBlocks)

  // One screenings fetch shared across the Active outreach (per-card files) and
  // the Files vault tab. Anchored to `driver_user_id` at the DB level so files
  // outlive any invite state — even after an invite is cancelled/removed.
  const screenings = useEmployerScreenings(sessionUserId)
  const refreshScreenings = screenings.refresh

  // Company + role live in global nav — keep store in sync whenever hub payload changes.
  useEffect(() => {
    if (!data?.company) {
      setEmployerNavSnapshot(null)
      return
    }
    const subtitle =
      [
        data.company.city && data.company.state ? `${data.company.city}, ${data.company.state}` : null,
        data.company.dotNumber ? `DOT #${data.company.dotNumber}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null
    setEmployerNavSnapshot({
      companyName: data.company.name,
      userRole: data.userRole ?? null,
      verified: Boolean(data.company.verified),
      subtitle,
      memberSinceLabel: data.memberSince ? `Member since ${formatDate(data.memberSince)}` : null,
    })
  }, [data, setEmployerNavSnapshot])

  // Collapsible section state — persisted in localStorage
  const SECTIONS_KEY = 'employer-hub-sections'

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const defaults = { jobs: true, pipeline: true }
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

  /** Snapshot for Stormi system prompt (employer hiring context — not candidate blocks) */
  const employerStormiContext = useMemo((): EmployerHubContext | null => {
    if (!data) return null
    return {
      needsCompanySetup: Boolean(data.needsCompanySetup) && !data.employerAccessPending,
      hasCompany: Boolean(data.company),
      companyName: data.company?.name ?? null,
      activeJobs: data.stats.activeJobs,
      totalJobs: data.stats.totalJobs,
      totalApplicants: data.stats.totalApplicants,
      pipeline: { ...data.pipeline },
      userRole: data.userRole ?? null,
    }
  }, [data])

  /** Employer hiring snapshot for `useEmployerHiringPathStore` / journey helpers (hub no longer shows job-path rail). */
  const hiringPayload = useMemo(() => {
    if (!data?.company) return null
    const snapshot: EmployerProgressData = {
      isWalletConnected: true,
      hasCompanyProfile: true,
      companyProfileComplete: data.company.onboardingCompleted,
      hasPostedJob: data.stats.totalJobs > 0,
      jobPostCount: data.stats.totalJobs,
      applicantCount: data.stats.totalApplicants,
      hasReviewedApplicants: data.stats.contacted > 0 || data.stats.archived > 0,
      hasRequestedVerification: false,
    }
    return {
      snapshot,
      progress: calculateEmployerProgress(snapshot),
      pathSummary: {
        companyProfileComplete: snapshot.companyProfileComplete,
        hasPostedJob: snapshot.hasPostedJob,
      },
      companyName: data.company.name,
      activeJobs: data.stats.activeJobs,
      totalApplicants: data.stats.totalApplicants,
      pendingReview: data.stats.pendingReview,
    }
  }, [data])

  useEffect(() => {
    if (!hiringPayload) {
      setEmployerHiringPath(null)
      return
    }
    setEmployerHiringPath({
      snapshot: hiringPayload.snapshot,
      companyName: hiringPayload.companyName,
      activeJobs: hiringPayload.activeJobs,
      totalApplicants: hiringPayload.totalApplicants,
      pendingReview: hiringPayload.pendingReview,
    })
  }, [hiringPayload, setEmployerHiringPath])

  useEffect(() => () => setEmployerHiringPath(null), [setEmployerHiringPath])

  // Fetch hub data.
  //
  // `silent` skips the loading skeleton — used for background refreshes
  // (visibility/focus, polling) so the entire hub UI doesn't tear down and
  // rebuild every 30s, which felt like a "full page refresh" to users.
  // Initial load and explicit Refresh-button clicks pass silent=false so the
  // loading skeleton still appears when there's no existing data to show.
  const fetchHubData = useCallback(async (silent = false) => {
    if (!sessionUserId) return
    try {
      if (!silent) setLoading(true)
      setError(null)

      const response = await fetch('/api/employer/hub')

      // 401 = session ended (logout). A visibility refresh can still be in
      // flight; don't throw — Next overlays console.error(Error) as a crash.
      if (response.status === 401) return

      if (!response.ok) {
        throw new Error('Failed to fetch hub data')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching employer hub data:', err)
      setError('Failed to load your hub data. Please try again.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sessionUserId])

  // Section-specific refresh functions - only fetch and update the relevant section
  const refreshPipeline = useCallback(async () => {
    if (!sessionUserId) return
    setRefreshingPipeline(true)
    try {
      const response = await fetch('/api/employer/hub')
      if (response.ok) {
        const result = await response.json()
        setData(prev =>
          prev
            ? {
                ...prev,
                applicants: result.applicants,
                pipeline: result.pipeline,
                stats: result.stats,
              }
            : null,
        )
      }
    } catch (err) {
      console.error('Error refreshing pipeline:', err)
    } finally {
      setRefreshingPipeline(false)
    }
  }, [sessionUserId])

  useEffect(() => {
    if (sessionUserId) {
      fetchHubData()
    }
  }, [sessionUserId, fetchHubData])

  useEffect(() => {
    if (!sessionUserId || !data?.company?.id) return
    void fetchEmployerBlocks(sessionUserId)
  }, [sessionUserId, data?.company?.id, fetchEmployerBlocks])

  // Full hub refresh: main hub API + employer blocks store + screenings + invites (nonce).
  const pullLatestEmployerHub = useCallback(async () => {
    if (!sessionUserId) return
    await fetchHubData(true)
    if (sessionUserId) {
      await Promise.all([
        fetchEmployerBlocks(sessionUserId),
        refreshScreenings(true),
      ])
    }
  }, [sessionUserId, fetchHubData, fetchEmployerBlocks, refreshScreenings])

  // Auto-refresh when tab becomes visible (solves stale data after changes in
  // other tabs). Always silent — we don't want a focus event to wipe the hub
  // and show a loading skeleton; the user keeps seeing the existing data
  // while it refreshes in the background.
  const { refresh: triggerRefresh, isStale } = useVisibilityRefresh(pullLatestEmployerHub, {
    staleTime: 30000,
    enabled: !!sessionUserId,
  })

  // Nav-bar hub refresh — Navigation calls `requestHubRefresh()` which bumps `hubRefreshNonce`.
  // Call `pullLatestEmployerHub` directly rather than going through `triggerRefresh` from
  // useVisibilityRefresh — that hook's `isRefreshing` guard can silently drop manual calls.
  const setEmployerHubRefreshing = useUIStore((s) => s.setEmployerHubRefreshing)
  useEffect(() => {
    if (lastHubRefreshNonce.current === null) {
      lastHubRefreshNonce.current = hubRefreshNonce
      return
    }
    if (hubRefreshNonce === lastHubRefreshNonce.current) return
    lastHubRefreshNonce.current = hubRefreshNonce
    if (!sessionUserId) return
    setEmployerHubRefreshing(true)
    void pullLatestEmployerHub().finally(() => setEmployerHubRefreshing(false))
  }, [hubRefreshNonce, sessionUserId, pullLatestEmployerHub, setEmployerHubRefreshing])

  // Redirect to company setup if onboarding is incomplete (must be in useEffect, not during render)
  useEffect(() => {
    if (!data || loading) return
    if (data.employerAccessPending) return
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
        headers: { 'Content-Type': 'application/json',
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

  const handleRemoveFromPipeline = async (applicant: KanbanApplicant) => {
    const name = applicant.applicantName?.trim() || 'this candidate'
    if (
      !confirm(
        `Remove ${name} from your hiring pipeline? You can add them again from Find Talent.`
      )
    ) {
      return
    }
    try {
      setRemovingApplicationId(applicant.applicationId)
      const response = await fetch(`/api/employer/applications/${applicant.applicationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(
          typeof errData.error === 'string' ? errData.error : 'Failed to remove from pipeline'
        )
      }
      if (selectedApplicant?.applicationId === applicant.applicationId) {
        setSelectedApplicant(null)
      }
      await fetchHubData()
    } catch (err) {
      console.error('Error removing from pipeline:', err)
      alert(err instanceof Error ? err.message : 'Failed to remove from pipeline')
    } finally {
      setRemovingApplicationId(null)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${
            isDark ? 'text-teal-400' : 'text-teal-600'
          }`} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Loading your employer hub...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <HubSectionPanel isDark={isDark} accent="teal" className="max-w-md w-full">
          <BlockCard
            variant="embed"
            paper
            icon={AlertCircle}
            title="Couldn’t load hub"
            description="Check your connection and try again."
          >
            <p className={`text-center text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="primary" size="md" onClick={() => fetchHubData()}>
                Try again
              </Button>
            </div>
          </BlockCard>
        </HubSectionPanel>
      </div>
    )
  }

  // No data yet or needs redirect to company setup (handled by useEffect above)
  if (!data) {
    return null
  }

  // Waiting on admin / Stormi for employer access (row in employer_access_requests)
  if (data.employerAccessPending && !data.company) {
    const p = data.employerAccessPending
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <HubSectionPanel isDark={isDark} accent="amber" className="max-w-lg w-full">
          <BlockCard
            variant="embed"
            paper
            icon={Clock}
            title="Employer access pending"
            description={`Your request to join ${p.companyName} is in the queue. Provven admin will approve it.`}
          >
            <p className={`mb-4 text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Status: {p.status === 'flagged' ? 'Flagged for review' : 'Pending'}
              {p.submittedAt ? ` · Submitted ${new Date(p.submittedAt).toLocaleString()}` : ''}
            </p>
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => fetchHubData()}>
                Refresh status
              </Button>
            </div>
          </BlockCard>
        </HubSectionPanel>
      </div>
    )
  }

  // While redirecting to company-setup, show nothing (prevents flash of hub content)
  if (data.needsCompanySetup || (data.company && !data.company.onboardingCompleted && data.userRole === 'owner')) {
    return null
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 pb-28 max-xl:pb-32 xl:pb-0">
      {/* ── Candidate outreach ───────────────────────────────────────────
           All employer capabilities (consent, MVR, PSP, DOT) are preinstalled
           server-side, so outreach is the first thing on the hub — no block
           management UI in between.
      ──────────────────────────────────────────────────────────────── */}
      <div id="candidate-outreach" className="mb-8">
        <CandidateOutreach
          sessionUserId={sessionUserId}
          screeningsRows={screenings.rows}
          screeningsByUserId={screenings.byUserId}
          screeningsLoading={screenings.loading}
          screeningsError={screenings.error}
          consentBundles={screenings.consentBundles}
          consentBundleByUserId={screenings.consentBundleByUserId}
          onRefreshScreenings={() => void screenings.refresh(true)}
          employerContext={employerStormiContext}
          companyId={data.company.id}
          companyWalletAddress={data.company.companyWalletAddress ?? null}
        />
      </div>

      {/* DQ monitor — roster by name; click opens person detail + DQ checklist */}
      <DqMonitorSection sessionUserId={sessionUserId} />

      {SHOW_HUB_OPS_SECTIONS && (
      <>
      <HubSectionPanel isDark={isDark} accent="teal" className="mb-6">
        <BlockCard
          variant="embed"
          paper
          icon={Users}
          title="Activity snapshot"
          description="Pipeline, jobs, and applicants after outreach and screenings."
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
              label="Contacted"
              value={data.stats.contacted}
              theme={theme}
            />
            <StatCard
              icon={<UserX className="w-5 h-5" />}
              label="Archived"
              value={data.stats.archived}
              subValue={
                data.stats.archivedThisMonth != null && data.stats.archivedThisMonth > 0
                  ? `${data.stats.archivedThisMonth} this month`
                  : 'Closed / not pursuing'
              }
              theme={theme}
            />
          </div>
        </BlockCard>
      </HubSectionPanel>

      {/* Quick actions removed — these page-level destinations now live in the Employer Hub
          dropdown in the global nav (Find Talent, Post Job, Applicants, Company, Team). The
          "New outreach" CTA lives in the Candidate outreach section header above. */}

      {/* Job Postings — kanban by status */}
      <JobPostingsSection
        jobs={data.jobPostings}
        sessionUserId={sessionUserId}
        theme={theme}
        onPostJob={() => onNavigate('post-job')}
        onRefresh={fetchHubData}
        isCollapsed={!openSections.jobs}
        onToggle={() => toggleSection('jobs')}
      />

      <HubSectionPanel isDark={isDark} accent="teal" className="mb-8">
        <BlockCard
          variant="embed"
          paper
          icon={Users}
          title="Hiring pipeline"
          description="Move applicants between New, Contacted, and Archived."
          headerActions={
            <div className="flex items-center gap-1">
              {openSections.pipeline && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refreshPipeline}
                  disabled={refreshingPipeline}
                  title="Refresh pipeline"
                  aria-label="Refresh pipeline"
                  className={cn(isStale && 'text-amber-600 dark:text-amber-400')}
                >
                  <RefreshCw className={cn('w-4 h-4', refreshingPipeline && 'animate-spin')} />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('pipeline')}
                aria-expanded={openSections.pipeline}
                aria-label={openSections.pipeline ? 'Collapse hiring pipeline' : 'Expand hiring pipeline'}
              >
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    !openSections.pipeline && '-rotate-90',
                  )}
                />
              </Button>
            </div>
          }
        >
          {openSections.pipeline && (
            <div className="-mx-2 mt-0">
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
                  applicants={data.applicants.map((a) => ({
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
                  sessionUserId={sessionUserId}
                  onStatusChange={handleStatusChange}
                  onSelectApplicant={(applicant) => {
                    const fullApplicant = data.applicants.find(
                      (x) => x.applicationId === applicant.applicationId,
                    )
                    if (fullApplicant) setSelectedApplicant(fullApplicant)
                  }}
                  onRemoveFromPipeline={handleRemoveFromPipeline}
                  isUpdating={updatingApplicationId}
                  isRemoving={removingApplicationId}
                />
              )}
            </div>
          )}
        </BlockCard>
      </HubSectionPanel>
      </>
      )}

      {/* CandidateOutreach is now embedded inside the "Blocks & outreach" section above */}

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
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCareerCardApplicantId(selectedApplicant.applicantUserId)}
              className="border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-200 dark:hover:bg-teal-500/30"
            >
              <CreditCard className="w-3.5 h-3.5" />
              View Career Card
            </Button>
            <MessagingButton
              otherUserId={selectedApplicant.applicantUserId}
              applicationId={selectedApplicant.applicationId}
              subject={`Re: ${selectedApplicant.jobTitle} – ${selectedApplicant.applicantName}`}
              sessionUserId={sessionUserId}
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
                sessionUserId={sessionUserId}
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
          sessionUserId={sessionUserId}
          onClose={() => setCareerCardApplicantId(null)}
        />
      )}

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
  const isDark = false
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-4 transition-all duration-300 border',
        'border-gray-200/90 dark:border-gray-600/70 bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-gray-900/90 dark:to-gray-950/90 shadow-[0_8px_28px_-14px_rgba(156,119,64,0.14)] dark:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.45)] ring-1 ring-teal-500/[0.06] dark:ring-teal-400/[0.08] hover:border-teal-500/25 dark:hover:border-teal-400/30',
      )}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent dark:via-teal-400/28'
      />
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'p-1.5 rounded-lg ring-1',
            'bg-gradient-to-br from-teal-500/15 to-cyan-500/10 dark:from-teal-400/20 dark:to-violet-500/10 ring-teal-500/20 dark:ring-teal-400/25',
          )}
        >
          <span className={isDark ? 'text-teal-400' : 'text-teal-600'}>{icon}</span>
        </div>
        <span className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>
          {label}
        </span>
      </div>
      <p
        className={cn(
          'text-2xl font-bold tracking-tight',
          highlight
            ? 'text-orange-500 dark:text-orange-400'
            : isDark
              ? 'text-white'
              : 'text-gray-900',
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
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
  const isDark = false
  return (
    <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-200 ${
      isDark
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-white/70 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isDark ? 'bg-teal-500/20' : 'bg-teal-100'
          }`}>
            <span className={isDark ? 'text-teal-400' : 'text-teal-600'}>
              {icon}
            </span>
          </div>
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          {count !== undefined && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${
              isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
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
  const isDark = false
  return (
    <div className={`text-center py-8 px-4 rounded-xl border-2 border-dashed ${
      isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className={`mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        {icon}
      </div>
      <h4 className={`font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        {title}
      </h4>
      <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button type="button" variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
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
  const isDark = false
  const name = applicant.applicantName || 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
        isDark
          ? 'hover:bg-gray-700/50'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        isDark ? 'bg-teal-500/20' : 'bg-teal-100'
      }`}>
        <span className={`text-sm font-bold ${
          isDark ? 'text-teal-400' : 'text-teal-600'
        }`}>
          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </p>
        <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {applicant.jobTitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={applicant.status} theme={theme} />
        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
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
  const isDark = false
  const [changingStatus, setChangingStatus] = useState(false)

  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    isDark ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${isDark ? 'text-white' : 'text-gray-900'}`

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
        isDark ? 'bg-gray-800/50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Application Status</p>
            <p className={`text-sm font-medium ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {getStatusConfig(applicant.status).label}
            </p>
          </div>
          <select
            value={applicant.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={changingStatus}
            className={`px-3 py-2 text-sm rounded-lg border ${
              changingStatus ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              isDark
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="submitted">New</option>
            <option value="contacted">Contacted</option>
            <option value="archived">Archived</option>
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
              isDark
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
              isDark
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
              applicant.resumeVerified ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <span className={valueClass}>
              {applicant.resumeVerified ? 'Verified Resume' : 'Resume Attached'}
            </span>
          </div>
        ) : (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            No resume attached
          </p>
        )}
      </div>

      {/* Cover Letter */}
      {applicant.coverLetter && (
        <div>
          <p className={labelClass}>Cover Letter</p>
          <p className={`${valueClass} mt-1 p-3 rounded-lg ${
            isDark ? 'bg-gray-800/50' : 'bg-gray-50'
          }`}>
            {applicant.coverLetter}
          </p>
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
    case 'contacted':
      return {
        label: 'Contacted',
        icon: <MessageSquare className="w-3 h-3" />,
        className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      }
    case 'archived':
      return {
        label: 'Archived',
        icon: <UserX className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
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
