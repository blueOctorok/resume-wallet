'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
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
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import { getBlockColor } from '@/lib/block-registry'
import {
  Briefcase,
  Users,
  FileText,
  Plus,
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
  Trash2,
  RefreshCw,
  CreditCard,
  Wallet,
  Coins,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { navControlButtonClass } from '@/lib/navigation-styles'
import type { EmployerHubContext } from '@/lib/ava-context'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import STORMBalance from '@/components/STORMBalance'
import { CompanyWalletContent } from '@/components/employer/CompanyWallet'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import EmployerBlockPickerModal from '@/components/employer/EmployerBlockPickerModal'
import BlockRemovalConfirmModal from '@/components/ui/BlockRemovalConfirmModal'
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'
import type { EmployerInstalledHubBlock } from '@/stores/employer-blocks-store'
import { getEmployerBlockDefinition } from '@/lib/employer-block-registry'
import { useEmployerScreenings } from '@/hooks/useEmployerScreenings'

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
  /** MultiOwnerLightAccount for shared employer USDC / STORM */
  walletAddress?: string | null
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
  walletAddress: string
  onNavigate: (view: string) => void
}

/**
 * Per-block color scheme for employer tiles. Each employer block gets its own
 * distinct color so they're visually distinct instead of all teal.
 */
const EMPLOYER_TILE_COLORS: Record<
  string,
  { glowColor: string; iconText: { dark: string; light: string } }
> = {
  'employer-mvr-orders': {
    glowColor: 'rgba(59,130,246,0.20)',
    iconText: { dark: 'text-blue-400', light: 'text-blue-600' },
  },
  'employer-psp-orders': {
    glowColor: 'rgba(245,158,11,0.20)',
    iconText: { dark: 'text-amber-400', light: 'text-amber-600' },
  },
  'employer-screening-consent': {
    glowColor: 'rgba(100,116,139,0.22)',
    iconText: { dark: 'text-slate-300', light: 'text-slate-600' },
  },
  'employer-dot-screening': {
    glowColor: 'rgba(20,184,166,0.20)',
    iconText: { dark: 'text-teal-400', light: 'text-teal-600' },
  },
  'employer-employment-verification': {
    glowColor: 'rgba(100,116,139,0.15)',
    iconText: { dark: 'text-slate-400', light: 'text-slate-500' },
  },
}

const DEFAULT_EMPLOYER_TILE_COLOR = EMPLOYER_TILE_COLORS['employer-dot-screening']

/** Installed capability — vault chrome + label; separators come from the list `divide-x`, not a per-tile box. */
function EmployerInstalledBlockTile({
  row,
  theme,
  canManage,
  onRemove,
}: {
  row: EmployerInstalledHubBlock
  theme: string
  canManage: boolean
  onRemove: () => void
}) {
  const isDark = isDarkTheme(theme)
  const def = getEmployerBlockDefinition(row.blockType)
  const blockLabel = def?.label ?? row.blockType
  const colors = EMPLOYER_TILE_COLORS[row.blockType] ?? DEFAULT_EMPLOYER_TILE_COLOR
  const Icon = def?.icon ?? Package

  return (
    <li
      title={`Installed ${new Date(row.addedAt).toLocaleDateString()}`}
      className="flex min-w-[7.5rem] flex-col items-center gap-2.5 px-5 py-1.5 text-center sm:min-w-[8.5rem] sm:px-6 sm:py-2"
    >
      <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
        <VaultCredentialChrome
          isDark={isDark}
          glowColor={colors.glowColor}
          hasRoute
          showSigil={false}
          className="h-full min-h-12 sm:min-h-14"
        >
          <div className="flex h-full items-center justify-center p-0.5">
            <Icon
              className={cn('h-6 w-6 sm:h-7 sm:w-7', isDark ? colors.iconText.dark : colors.iconText.light)}
              aria-hidden
            />
          </div>
        </VaultCredentialChrome>
      </div>
      <p
        className={cn(
          'line-clamp-2 max-w-[11rem] text-xs font-semibold leading-snug sm:text-sm',
          isDark ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100',
        )}
      >
        {blockLabel}
      </p>
      {canManage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!h-9 !w-9 !p-0 text-gray-500 hover:bg-red-500/10 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          onClick={onRemove}
          aria-label={`Remove ${blockLabel}`}
          title="Remove block"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </li>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EmployerHub({ walletAddress, onNavigate }: EmployerHubProps) {
  const { theme } = useTheme()
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
  const [companyWalletProvisioning, setCompanyWalletProvisioning] = useState(false)
  const [companyWalletModalOpen, setCompanyWalletModalOpen] = useState(false)
  const companyEnsureAttemptedId = useRef<string | null>(null)

  const employerInstalledBlocks = useEmployerBlocksStore((s) => s.installedBlocks)
  const employerCanManageBlocks = useEmployerBlocksStore((s) => s.canManageEmployerBlocks)
  const employerPickerOpen = useEmployerBlocksStore((s) => s.isPickerOpen)
  const openEmployerBlockPicker = useEmployerBlocksStore((s) => s.openPicker)
  const closeEmployerBlockPicker = useEmployerBlocksStore((s) => s.closePicker)
  const fetchEmployerBlocks = useEmployerBlocksStore((s) => s.fetchEmployerBlocks)
  const installEmployerBlock = useEmployerBlocksStore((s) => s.installBlock)
  const removeEmployerBlock = useEmployerBlocksStore((s) => s.removeBlock)
  const employerRecentAudit = useEmployerBlocksStore((s) => s.recentAudit)

  // One screenings fetch shared across the Active outreach (per-card files) and
  // the Files vault tab. Anchored to `driver_user_id` at the DB level so files
  // outlive any invite state — even after an invite is cancelled/removed.
  const screenings = useEmployerScreenings(walletAddress)
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

  const [employerBlockToRemove, setEmployerBlockToRemove] = useState<{ id: string; label: string } | null>(null)

  // Collapsible section state — persisted in localStorage
  const SECTIONS_KEY = 'employer-hub-sections'
  // v2 keys: default is now collapsed; old keys are ignored so everyone gets the new default once.
  const RAIL_WALLET_LS = 'employer-hub-rail-wallet-open-v2'
  const RAIL_STORMI_LS = 'employer-hub-rail-stormi-open-v2'

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const defaults = { jobs: true, pipeline: true, outreach: false }
    if (typeof window === 'undefined') return defaults
    try {
      const stored = localStorage.getItem(SECTIONS_KEY)
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults
    } catch {
      return defaults
    }
  })

  /** Desktop xl+ side rails — default collapsed so the hub leads with main work; expand when needed (persisted). */
  const [walletRailOpen, setWalletRailOpen] = useState(false)
  const [stormiRailOpen, setStormiRailOpen] = useState(false)
  useEffect(() => {
    try {
      const w = localStorage.getItem(RAIL_WALLET_LS)
      if (w !== null) setWalletRailOpen(w === '1' || w === 'true')
      const s = localStorage.getItem(RAIL_STORMI_LS)
      if (s !== null) setStormiRailOpen(s === '1' || s === 'true')
    } catch {
      /* keep defaults */
    }
  }, [])

  const persistWalletRail = useCallback((open: boolean) => {
    setWalletRailOpen(open)
    try {
      localStorage.setItem(RAIL_WALLET_LS, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const persistStormiRail = useCallback((open: boolean) => {
    setStormiRailOpen(open)
    try {
      localStorage.setItem(RAIL_STORMI_LS, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

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

  /** Wallet rail rim — neutral glow so it pairs with the main column + Stormi column */
  const employerRailVaultGlow = useMemo(() => getBlockColor('general-resume').glowColor, [])

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

  // Legacy companies: one ensure-wallet attempt per company per session (avoids 503 loops)
  useEffect(() => {
    if (!data?.company?.id || data.company.walletAddress || !walletAddress) return
    if (data.needsCompanySetup) return
    if (companyEnsureAttemptedId.current === data.company.id) return
    companyEnsureAttemptedId.current = data.company.id
    let cancelled = false
    setCompanyWalletProvisioning(true)
    void (async () => {
      try {
        const r = await fetch('/api/employer/company/ensure-wallet', {
          method: 'POST',
          headers: { 'x-wallet-address': walletAddress },
        })
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (r.ok && j.walletAddress) {
          setData((prev) =>
            prev?.company
              ? {
                  ...prev,
                  company: { ...prev.company, walletAddress: j.walletAddress },
                }
              : prev,
          )
        }
      } catch (e) {
        console.warn('[EmployerHub] ensure-wallet failed:', e)
      } finally {
        if (!cancelled) setCompanyWalletProvisioning(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data?.company?.id, data?.company?.walletAddress, data?.needsCompanySetup, walletAddress])

  // Fetch hub data.
  //
  // `silent` skips the loading skeleton — used for background refreshes
  // (visibility/focus, polling) so the entire hub UI doesn't tear down and
  // rebuild every 30s, which felt like a "full page refresh" to users.
  // Initial load and explicit Refresh-button clicks pass silent=false so the
  // loading skeleton still appears when there's no existing data to show.
  const fetchHubData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
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
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress) {
      fetchHubData()
    }
  }, [walletAddress, fetchHubData])

  useEffect(() => {
    if (!walletAddress || !data?.company?.id) return
    void fetchEmployerBlocks(walletAddress)
  }, [walletAddress, data?.company?.id, fetchEmployerBlocks])

  // Full hub refresh: main hub API + employer blocks store + screenings + invites (nonce).
  const pullLatestEmployerHub = useCallback(async () => {
    await fetchHubData(true)
    if (walletAddress) {
      await Promise.all([
        fetchEmployerBlocks(walletAddress),
        refreshScreenings(true),
      ])
    }
  }, [walletAddress, fetchHubData, fetchEmployerBlocks, refreshScreenings])

  // Auto-refresh when tab becomes visible (solves stale data after changes in
  // other tabs). Always silent — we don't want a focus event to wipe the hub
  // and show a loading skeleton; the user keeps seeing the existing data
  // while it refreshes in the background.
  const { refresh: triggerRefresh, isStale } = useVisibilityRefresh(pullLatestEmployerHub, {
    staleTime: 30000,
    enabled: !!walletAddress,
  })

  // Nav-bar hub refresh — Navigation calls `requestHubRefresh()` which bumps `hubRefreshNonce`.
  // Call `pullLatestEmployerHub` directly rather than going through `triggerRefresh` from
  // useVisibilityRefresh — that hook's `isRefreshing` guard can silently drop manual calls.
  useEffect(() => {
    if (lastHubRefreshNonce.current === null) {
      lastHubRefreshNonce.current = hubRefreshNonce
      return
    }
    if (hubRefreshNonce === lastHubRefreshNonce.current) return
    lastHubRefreshNonce.current = hubRefreshNonce
    if (!walletAddress) return
    void pullLatestEmployerHub()
  }, [hubRefreshNonce, walletAddress, pullLatestEmployerHub])

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
        headers: { 'x-wallet-address': walletAddress },
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
            isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
          }`} />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
            Loading your employer hub...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="max-w-md w-full">
          <BlockCard
            variant="embed"
            icon={AlertCircle}
            title="Couldn’t load hub"
            description="Check your connection and try again."
          >
            <p className={`text-center text-sm ${isDarkTheme(theme) ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
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
        <HubSectionPanel isDark={isDarkTheme(theme)} accent="amber" className="max-w-lg w-full">
          <BlockCard
            variant="embed"
            icon={Clock}
            title="Employer access pending"
            description={`Your request to join ${p.companyName} is in the queue. Storm admin will approve it.`}
          >
            <p className={`mb-4 text-center text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
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
      {/* xl+: 3-column grid — wallet, priority (row 1 col 2), Stormi (row 1 col 3), then
          rest of hub (row 2 col 2). All four are *direct* children of this grid (no
          `display:contents` wrapper) so row-1 tops share one formatting context. Mobile:
          same DOM order as flex column → priority → Stormi → rest. */}
      <div
        className={cn(
          // Mobile: flex column (wallet hidden on small screens). Desktop: plain 3-column grid
          // with NO `display:contents` — wallet, priority, Stormi, and rest are *direct* grid
          // children so row-1 tops share one layout box (contents flattening was leaving the
          // rails misaligned vs the center column in production).
          'flex flex-col gap-8 pb-28 max-xl:pb-32 xl:grid xl:items-start xl:gap-x-8 xl:gap-y-8 xl:pb-0',
          stormiRailOpen
            ? 'xl:grid-cols-[auto_minmax(0,1fr)_26rem]'
            : 'xl:grid-cols-[auto_minmax(0,1fr)_auto]',
        )}
      >
        {data.company &&
          (walletRailOpen ? (
            <aside
              className="hidden w-80 shrink-0 self-start p-0 xl:sticky xl:top-24 xl:col-start-1 xl:row-start-1 xl:block xl:self-start"
              aria-label="Company wallet"
            >
              <VaultCredentialChrome
                isDark={isDarkTheme(theme)}
                glowColor={employerRailVaultGlow}
                hasRoute
                showSigil={false}
                className="w-full max-w-full min-w-0"
                style={{
                  filter:
                    isDarkTheme(theme)
                      ? 'drop-shadow(0 4px 22px rgba(0,0,0,0.5))'
                      : 'drop-shadow(0 4px 14px rgba(15,23,42,0.1))',
                }}
              >
                <div className="relative flex min-h-0 min-w-0 flex-col gap-3 pl-10 pr-3.5 pb-[14px] pt-3.5">
                  <div className="absolute left-3 top-3 z-20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        '!h-8 !w-8 !p-1.5 shadow-sm backdrop-blur-sm',
                        navControlButtonClass(isDarkTheme(theme), theme),
                      )}
                      onClick={() => persistWalletRail(false)}
                      aria-label="Collapse company wallet panel"
                      title="Collapse company wallet"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden />
                    </Button>
                  </div>
                  <CompanyWalletContent
                    layout="rail"
                    companyName={data.company.name}
                    companyWalletAddress={data.company.walletAddress ?? null}
                    walletProvisioning={companyWalletProvisioning}
                  />
                </div>
              </VaultCredentialChrome>
            </aside>
          ) : (
            <aside
              className={cn(
                'hidden w-11 shrink-0 self-start xl:sticky xl:top-24 xl:col-start-1 xl:row-start-1 xl:flex xl:self-start flex-col items-center justify-center py-4 min-h-[11rem] max-h-[min(60vh,20rem)]',
                'rounded-2xl border shadow-sm backdrop-blur-sm',
                theme === 'ink'
                  ? 'border-zinc-600/80 bg-zinc-900/95'
                  : 'border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90',
              )}
              aria-label="Company wallet collapsed"
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => persistWalletRail(true)}
                className="!p-0 h-auto w-full touch-manipulation"
                aria-label="Expand company wallet panel"
                title="Expand company wallet"
              >
                <span className="flex items-center gap-2 -rotate-90 whitespace-nowrap py-6">
                  <Wallet
                    className={cn(
                      'h-4 w-4 shrink-0',
                      theme === 'ink' ? 'text-zinc-300' : 'text-teal-600 dark:text-teal-400',
                    )}
                    aria-hidden
                  />
                  <span className="text-[10px] font-bold tracking-wide text-gray-700 dark:text-gray-200">
                    Company wallet
                  </span>
                </span>
              </Button>
            </aside>
          ))}
        {/* Priority column (row 1) — DOM order on mobile: wallet → this → Stormi → rest */}
          <div className="w-full min-w-0 space-y-8 xl:col-start-2 xl:row-start-1 xl:max-w-7xl xl:justify-self-center xl:min-w-0">
      {/* ── Blocks & Outreach — unified section ─────────────────────────
           Top: installed employer blocks (what capabilities does this company have?)
           Bottom: candidate outreach (create invites using those capabilities)
           The outreach dropdown mirrors only the blocks installed above.
      ──────────────────────────────────────────────────────────────── */}
      <HubSectionPanel isDark={isDarkTheme(theme)} accent="amber" className="mb-8">
        <BlockCard
          variant="embed"
          icon={Package}
          title="Blocks & outreach"
          description="Install blocks to unlock screening and outreach capabilities, then invite candidates below."
          headerActions={
            employerCanManageBlocks ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => openEmployerBlockPicker()}>
                <Plus className="h-4 w-4" />
                Add block
              </Button>
            ) : undefined
          }
        >
          {/* ── Installed blocks ─────────────────────────────────────── */}
          {employerInstalledBlocks.length === 0 ? (
            <div className="py-6 text-center">
              <Package className={cn('w-8 h-8 mx-auto mb-2', isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300')} />
              <p className={cn('text-sm font-medium', isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500')}>
                No blocks installed yet
              </p>
              <p className={cn('text-xs mt-1', isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400')}>
                Add blocks to unlock candidate outreach and screening features.
              </p>
            </div>
          ) : (
            <div>
              <p
                className={cn(
                  'mb-3 text-xs font-semibold uppercase tracking-wide',
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400',
                )}
              >
                Installed capabilities
              </p>
            <ul
                className={cn(
                  'flex flex-nowrap items-stretch justify-center divide-x divide-dotted overflow-x-auto pb-1 pt-0.5',
                  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
                  isDarkTheme(theme)
                    ? 'divide-gray-600/50'
                    : 'divide-gray-300/80 dark:divide-gray-600/50',
                )}
              >
                {employerInstalledBlocks.map((row) => {
                  const blockLabel = getEmployerBlockDefinition(row.blockType)?.label ?? row.blockType
                  return (
                    <EmployerInstalledBlockTile
                      key={row.id}
                      row={row}
                      theme={theme}
                      canManage={employerCanManageBlocks}
                      onRemove={() => setEmployerBlockToRemove({ id: row.id, label: blockLabel })}
                    />
                  )
                })}
              </ul>
            </div>
          )}

          {/* ── Candidate outreach — inset panel so it reads as its own step, not a cramped footer ─ */}
          {employerInstalledBlocks.length > 0 && (
            <div
              id="candidate-outreach"
              className={cn(
                'mt-6 min-w-0 max-w-full overflow-x-hidden rounded-xl border p-4 sm:mt-8 sm:p-5',
                isDarkTheme(theme)
                  ? 'border-amber-500/20 bg-gray-950/50 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.08)]'
                  : 'border-amber-200/80 bg-amber-50/50 dark:border-amber-500/25 dark:bg-gray-950/40',
              )}
            >
              <p
                className={cn(
                  'mb-3 text-xs leading-relaxed sm:mb-4',
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-600 dark:text-gray-400',
                )}
              >
                Active outreach, files vault, and archive — switch with the tabs below. Files are
                tied to the candidate (not the invite), so they stay safe even if the invite is removed.
              </p>
              <CandidateOutreach
                walletAddress={walletAddress}
                isCollapsed={!openSections.outreach}
                onToggle={() => toggleSection('outreach')}
                embedded
                screeningsRows={screenings.rows}
                screeningsByUserId={screenings.byUserId}
                screeningsLoading={screenings.loading}
                screeningsError={screenings.error}
                consentBundles={screenings.consentBundles}
                consentBundleByUserId={screenings.consentBundleByUserId}
                onRefreshScreenings={() => void screenings.refresh(true)}
                employerContext={employerStormiContext}
                companyId={data.company.id}
                companyWalletAddress={data.company.walletAddress ?? null}
              />
            </div>
          )}

          {employerRecentAudit.length > 0 && (
            <div className={cn('mt-4 border-t pt-3', isDarkTheme(theme) ? 'border-gray-700/80' : 'border-gray-200')}>
              <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500')}>
                Recent activity
              </p>
              <ul className="space-y-1 text-xs">
                {employerRecentAudit.slice(0, 5).map((a) => (
                  <li key={a.id} className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{a.block_type}</span>
                    {' · '}
                    {a.action}
                    {' · '}
                    {new Date(a.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </BlockCard>
      </HubSectionPanel>

      {/* (Purchased screenings panel removed — its data now lives inside the
          Blocks & outreach section's "Files vault" tab, plus per-candidate file
          pills on each Active outreach card.) */}

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="mb-6">
        <BlockCard
          variant="embed"
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
          "New outreach" CTA still lives inside the Blocks & Outreach section above. */}
          </div>

        {employerStormiContext &&
          (stormiRailOpen ? (
            <aside
              id="employer-hub-stormi-panel"
              className="min-w-0 max-w-full scroll-mt-24 xl:sticky xl:top-24 xl:col-start-3 xl:row-start-1 xl:block xl:self-start"
              aria-label="Ask Stormi hiring coach"
            >
              <HubSectionPanel
                isDark={isDarkTheme(theme)}
                accent="violet"
                contentClassName="relative pr-10 xl:pr-12"
              >
                {/* Collapse handle — desktop only; mirrors wallet rail's collapse-to-edge pattern. */}
                <div className="hidden xl:block absolute right-3 top-3 z-20">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      '!h-8 !w-8 !p-1.5 shadow-sm backdrop-blur-sm',
                      navControlButtonClass(isDarkTheme(theme), theme),
                    )}
                    onClick={() => persistStormiRail(false)}
                    aria-label="Collapse Ask Stormi panel"
                    title="Collapse Ask Stormi"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  </Button>
                </div>
                <BlockCard
                  variant="embed"
                  headerIconSlot={
                    <Image
                      src="/ava-robot.png"
                      alt=""
                      width={36}
                      height={36}
                      className={cn('object-contain', !isDarkTheme(theme) && 'invert')}
                    />
                  }
                  title="Ask Stormi"
                  description="Hiring coach — outreach, talent search, pipeline, and what to do next."
                >
                  <StormiChatPanel
                    mode="employer"
                    walletAddress={walletAddress}
                    employerContext={employerStormiContext}
                    stormiAutoWelcomeEmployerDone={data.avaAutoWelcomeEmployerDone ?? false}
                    onStormiAutoWelcomeSynced={() =>
                      setData((prev) => (prev ? { ...prev, avaAutoWelcomeEmployerDone: true } : null))
                    }
                    hubEmbedSurface
                  />
                </BlockCard>
              </HubSectionPanel>
            </aside>
          ) : (
            <aside
              id="employer-hub-stormi-panel"
              className={cn(
                'hidden w-11 shrink-0 self-start xl:sticky xl:top-24 xl:col-start-3 xl:row-start-1 xl:flex xl:self-start flex-col items-center justify-center py-4 min-h-[11rem] max-h-[min(60vh,20rem)]',
                'rounded-2xl border shadow-sm backdrop-blur-sm',
                theme === 'ink'
                  ? 'border-zinc-600/80 bg-zinc-900/95'
                  : 'border-violet-200/70 dark:border-violet-700/60 bg-white/90 dark:bg-gray-900/90',
              )}
              aria-label="Ask Stormi collapsed"
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => persistStormiRail(true)}
                className="!p-0 h-auto w-full touch-manipulation"
                aria-label="Expand Ask Stormi panel"
                title="Expand Ask Stormi"
              >
                {/* Rotated label mirrors collapsed wallet rail. Image inverts on light themes
                    because the source PNG is white-on-transparent. */}
                <span className="flex items-center gap-2 -rotate-90 whitespace-nowrap py-6">
                  <Image
                    src="/ava-robot.png"
                    alt=""
                    width={16}
                    height={16}
                    className={cn(
                      'h-4 w-4 shrink-0 object-contain',
                      !isDarkTheme(theme) && 'invert',
                    )}
                  />
                  <span className="text-[10px] font-bold tracking-wide text-gray-700 dark:text-gray-200">
                    Stormi
                  </span>
                </span>
              </Button>
            </aside>
          ))}

          <div className="w-full min-w-0 space-y-8 xl:col-start-2 xl:row-start-2 xl:max-w-7xl xl:justify-self-center xl:min-w-0">

      <EmployerBlockPickerModal
        open={employerPickerOpen}
        onClose={() => closeEmployerBlockPicker()}
        installedTypes={new Set(employerInstalledBlocks.map((b) => b.blockType))}
        canInstall={employerCanManageBlocks}
        onInstallBlock={async (blockType) => installEmployerBlock(walletAddress, blockType, null)}
      />

      <BlockRemovalConfirmModal
        open={Boolean(employerBlockToRemove)}
        onClose={() => setEmployerBlockToRemove(null)}
        blockLabel={employerBlockToRemove?.label ?? ''}
        onConfirm={async (reason) => {
          if (!employerBlockToRemove) return
          const ok = await removeEmployerBlock(walletAddress, employerBlockToRemove.id, reason)
          if (!ok) throw new Error('Remove failed')
        }}
      />

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

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="mb-8">
        <BlockCard
          variant="embed"
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
                  walletAddress={walletAddress}
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
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-100'}`}>
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

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="indigo" className="pt-4">
        <BlockCard
          variant="embed"
          icon={Coins}
          title="STORM token"
          description="Your wallet balance on Base — Sepolia and mainnet."
        >
          <STORMBalance
            walletAddress={walletAddress}
            onReadWhitepaper={() => onNavigate('stormchain')}
            hubEmbed
          />
        </BlockCard>
      </HubSectionPanel>

          </div>
      </div>

      {data.company && (
        <>
          {companyWalletModalOpen && (
            <Modal
              onClose={() => setCompanyWalletModalOpen(false)}
              maxWidth="max-w-lg"
              zIndex={95}
            >
              <ModalHeader
                title="Company wallet"
                subtitle={`${data.company.name} · shared team address`}
                onClose={() => setCompanyWalletModalOpen(false)}
              />
              <div className="p-4 max-h-[min(85vh,720px)] overflow-y-auto overscroll-contain">
                <CompanyWalletContent
                  layout="modal"
                  omitHero
                  companyName={data.company.name}
                  companyWalletAddress={data.company.walletAddress ?? null}
                  walletProvisioning={companyWalletProvisioning}
                />
              </div>
            </Modal>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={() => setCompanyWalletModalOpen(true)}
            className={cn(
              'xl:hidden fixed z-30 top-1/2 -translate-y-1/2',
              'left-[max(0px,env(safe-area-inset-left,0px))]',
              'h-[min(60vh,20rem)] w-11 min-h-[11rem] max-h-[320px]',
              'rounded-none rounded-r-2xl border border-l-0 border-gray-300/40 dark:border-gray-600/50',
              'shadow-lg !p-0 touch-manipulation active:opacity-90',
            )}
            aria-label="Open company wallet"
          >
            <span className="flex items-center gap-2 -rotate-90 whitespace-nowrap">
              <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[11px] font-bold tracking-wide">Company wallet</span>
            </span>
          </Button>
        </>
      )}

      {employerStormiContext && (
        <Button
          type="button"
          variant="primary"
          onClick={() =>
            document.getElementById('employer-hub-stormi-panel')?.scrollIntoView({ behavior: 'smooth' })
          }
          className={cn(
            'xl:hidden fixed z-30 top-1/2 -translate-y-1/2',
            'right-[max(0px,env(safe-area-inset-right,0px))]',
            'h-[min(60vh,20rem)] w-11 min-h-[11rem] max-h-[320px]',
            'rounded-none rounded-l-2xl border border-r-0 border-gray-300/40 dark:border-gray-600/50',
            'shadow-lg !p-0 touch-manipulation active:opacity-90',
            theme === 'ink'
              ? '!bg-violet-700 hover:!bg-violet-600 dark:!bg-violet-700 dark:hover:!bg-violet-600 !text-white'
              : '!bg-violet-600 hover:!bg-violet-500 dark:!bg-violet-600 dark:hover:!bg-violet-500 !text-white',
          )}
          aria-label="Scroll to Ask Stormi"
        >
          <span className="flex items-center gap-2 rotate-90 whitespace-nowrap">
            <Image
              src="/ava-robot.png"
              alt=""
              width={16}
              height={16}
              className={cn('h-4 w-4 shrink-0 object-contain', !isDarkTheme(theme) && 'invert')}
            />
            <span className="text-[11px] font-bold tracking-wide">Stormi</span>
          </span>
        </Button>
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
  const isDark = isDarkTheme(theme)
  const ink = theme === 'ink'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-4 transition-all duration-300 border',
        ink
          ? 'border-zinc-600/70 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.5)] ring-1 ring-zinc-500/[0.14] hover:border-zinc-500/45'
          : 'border-gray-200/90 dark:border-gray-600/70 bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-gray-900/90 dark:to-gray-950/90 shadow-[0_8px_28px_-14px_rgba(13,148,136,0.14)] dark:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.45)] ring-1 ring-teal-500/[0.06] dark:ring-teal-400/[0.08] hover:border-teal-500/25 dark:hover:border-teal-400/30',
      )}
    >
      <div
        aria-hidden
        className={
          ink
            ? 'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/35 to-transparent'
            : 'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent dark:via-teal-400/28'
        }
      />
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'p-1.5 rounded-lg ring-1',
            ink
              ? 'bg-gradient-to-br from-zinc-700/45 to-zinc-800/35 ring-zinc-500/30'
              : 'bg-gradient-to-br from-teal-500/15 to-cyan-500/10 dark:from-teal-400/20 dark:to-violet-500/10 ring-teal-500/20 dark:ring-teal-400/25',
          )}
        >
          <span className={ink ? 'text-zinc-200' : isDark ? 'text-teal-400' : 'text-teal-600'}>{icon}</span>
        </div>
        <span className={cn('text-sm font-medium', ink ? 'text-zinc-400' : isDark ? 'text-gray-400' : 'text-gray-600')}>
          {label}
        </span>
      </div>
      <p
        className={cn(
          'text-2xl font-bold tracking-tight',
          highlight
            ? ink
              ? 'text-amber-200'
              : 'text-orange-500 dark:text-orange-400'
            : ink
              ? 'text-zinc-50'
              : isDark
                ? 'text-white'
                : 'text-gray-900',
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className={cn('text-xs mt-1', ink ? 'text-zinc-500' : isDark ? 'text-gray-500' : 'text-gray-400')}>
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
      isDarkTheme(theme)
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-white/70 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isDarkTheme(theme) ? 'bg-teal-500/20' : 'bg-teal-100'
          }`}>
            <span className={isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}>
              {icon}
            </span>
          </div>
          <h3 className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          {count !== undefined && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${
              isDarkTheme(theme) ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
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
      isDarkTheme(theme) ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className={`mb-4 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
        {icon}
      </div>
      <h4 className={`font-semibold mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
        {title}
      </h4>
      <p className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
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
  const name = applicant.applicantName || 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
        isDarkTheme(theme)
          ? 'hover:bg-gray-700/50'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        isDarkTheme(theme) ? 'bg-teal-500/20' : 'bg-teal-100'
      }`}>
        <span className={`text-sm font-bold ${
          isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'
        }`}>
          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </p>
        <p className={`text-sm truncate ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
          {applicant.jobTitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={applicant.status} theme={theme} />
        <ChevronRight className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`} />
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
    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`

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
        isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Application Status</p>
            <p className={`text-sm font-medium ${
              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
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
              isDarkTheme(theme)
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
              isDarkTheme(theme)
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
              isDarkTheme(theme)
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
              applicant.resumeVerified ? 'text-green-500' : isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <span className={valueClass}>
              {applicant.resumeVerified ? 'Verified Resume' : 'Resume Attached'}
            </span>
          </div>
        ) : (
          <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
            No resume attached
          </p>
        )}
      </div>

      {/* Cover Letter */}
      {applicant.coverLetter && (
        <div>
          <p className={labelClass}>Cover Letter</p>
          <p className={`${valueClass} mt-1 p-3 rounded-lg ${
            isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
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
