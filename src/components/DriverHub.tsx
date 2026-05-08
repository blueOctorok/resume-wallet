'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import StormTokenMark from '@/components/ui/StormTokenMark'
import ShareProfileCard from './ShareProfileCard'
import AvatarUpload from './ui/AvatarUpload'
import DriverVerificationSection from './verification/DriverVerificationSection'
import DriverEmploymentVerificationSection from './verification/DriverEmploymentVerificationSection'
import CandidateRequestsSection from './CandidateRequestsSection'
import ResumePreviewModal from './ResumePreviewModal'
import UploadResumeModal from './UploadResumeModal'
import Modal, { ModalHeader } from './ui/Modal'
import {
  FileText,
  ClipboardList,
  Car,
  Briefcase,
  CreditCard,
  Plus,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  ExternalLink,
  Eye,
  ChevronRight,
  User,
  Calendar,
  TrendingUp,
  Loader2,
  X,
  Trash2,
  Edit,
  Sparkles,
  RefreshCw,
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface HubResume {
  id: string
  title: string
  filename: string
  ipfsHash: string
  verificationStatus: string
  blockchainTxHash: string | null
  createdAt: string
  fileSize: number
  resumeType: 'uploaded' | 'built'
  isPaid: boolean
}

interface HubDotApplication {
  id: string
  createdAt: string
  verificationStatus: string
  blockchainTxHash: string | null
  blockchainApplicationId: string | null
  isComplete: boolean
  currentStep: number
  applicantName?: string | null
  isInProgress?: boolean
}

interface HubMvrRecord {
  id: string
  orderStatus: string
  licenseState: string
  createdAt: string
  completedAt: string | null
  // Fee info for transaction history
  feeAmount: string | null
  feeCurrency: string
  orderedAt: string | null
  // Result data
  hasResult: boolean
  resultId: string | null
  licenseStatus: string | null
  totalPoints: number | null
  violationCount: number
  resultStatus: string | null
}

interface HubJobApplication {
  id: string
  status: string
  appliedAt: string
  viewCount: number
  jobTitle: string
  companyName: string
}

interface HubPayment {
  id: string
  type: string
  amountUSDC: string
  txHash: string | null
  status: string
  createdAt: string
}

interface HubTransaction {
  id: string
  type: string
  description: string
  amount: number | null
  currency: string
  status: string
  createdAt: string
}

interface HubStats {
  profileCompleteness: number
  totalResumes: number
  verifiedResumes: number
  totalDotApps: number
  verifiedDotApps: number
  completedDotApps: number
  inProgressDotApps: number
  totalMvrRecords: number
  validMvrRecords: number
  totalJobApplications: number
  pendingApplications: number
  viewedApplications: number
  contactedApplications: number
  totalSpentUSDC: number
  totalTransactions: number
}

interface HubData {
  success: boolean
  isNewUser: boolean
  profile: any
  displayNameFallback?: string | null
  resumes: HubResume[]
  dotApplications: HubDotApplication[]
  mvrRecords: HubMvrRecord[]
  jobApplications: HubJobApplication[]
  payments: HubPayment[]
  transactions: HubTransaction[]
  stats: HubStats
  memberSince?: string
}

interface DriverHubProps {
  userAddress: string | null
  onNavigate: (
    page: 'resume' | 'dotapp' | 'mvr' | 'jobs' | 'applications' | 'stormchain' | 'career-card' | 'profile-setup',
  ) => void
  onStartDotApp?: () => void
  onViewMvr?: (orderId: string) => void
  /** Called when user discards an in-progress (unsaved) DOT application. Should clear profile + localStorage + form state. */
  onDeleteInProgressDotApp?: () => Promise<void>
  /** Called when user wants to edit a resume in the Resume Builder */
  onEditResume?: (resumeId: string) => void
  /** Called when user wants to verify a resume (upload to IPFS/blockchain) */
  onVerifyResume?: (resumeId: string) => void
  /** Called when user wants to complete employment verification for a submitted DOT app */
  onStartEmploymentVerification?: () => void
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DriverHub({
  userAddress,
  onNavigate,
  onStartDotApp,
  onViewMvr,
  onDeleteInProgressDotApp,
  onEditResume,
  onVerifyResume,
  onStartEmploymentVerification,
}: DriverHubProps) {
  const { theme } = useTheme()
  const [hubData, setHubData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [selectedResume, setSelectedResume] = useState<HubResume | null>(null)
  const [selectedResumeData, setSelectedResumeData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [loadingResumeData, setLoadingResumeData] = useState(false)
  const [selectedDotApp, setSelectedDotApp] =
    useState<HubDotApplication | null>(null)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [deletingResume, setDeletingResume] = useState<HubResume | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletingInProgressDotApp, setDeletingInProgressDotApp] =
    useState(false)
  const [verifyingResume, setVerifyingResume] = useState(false)
  const [verifyingDotApp, setVerifyingDotApp] = useState(false)
  const [deletingDotApp, setDeletingDotApp] = useState(false)
  const [resumeActionMessage, setResumeActionMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [dotAppActionMessage, setDotAppActionMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [showUploadResumeModal, setShowUploadResumeModal] = useState(false)

  // Section-specific loading states for granular refresh
  const [refreshingResumes, setRefreshingResumes] = useState(false)
  const [refreshingDotApps, setRefreshingDotApps] = useState(false)
  const [refreshingMvr, setRefreshingMvr] = useState(false)
  const [refreshingJobApps, setRefreshingJobApps] = useState(false)

  // Handle resume deletion
  const handleDeleteResume = async (resume: HubResume) => {
    if (!userAddress) return

    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/resumes/${resume.id}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': userAddress,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete resume')
      }

      // Close modals and refresh data
      setDeletingResume(null)
      setSelectedResume(null)
      // Refresh hub data
      fetchHubData()
    } catch (err: unknown) {
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete resume')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle verify resume (upload to IPFS and blockchain)
  const handleVerifyResume = async (resume: HubResume) => {
    if (!userAddress) return

    setVerifyingResume(true)
    setResumeActionMessage({
      type: 'success',
      text: 'Generating PDF and uploading to blockchain...',
    })

    try {
      const response = await fetch(`/api/resumes/${resume.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setResumeActionMessage({
        type: 'success',
        text: `Resume verified! Transaction: ${data.txHash?.slice(0, 10)}...`,
      })

      // Clear message after 5 seconds and refresh data
      setTimeout(() => {
        setResumeActionMessage(null)
        setSelectedResume(null)
        fetchHubData()
      }, 5000)
    } catch (err: unknown) {
      console.error('Verify error:', err)
      setResumeActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification failed',
      })
    } finally {
      setVerifyingResume(false)
    }
  }

  // Handle verify DOT application (submit to blockchain)
  const handleVerifyDotApp = async (dotApp: HubDotApplication) => {
    if (!userAddress) return

    setVerifyingDotApp(true)
    setDotAppActionMessage({
      type: 'success',
      text: 'Submitting to blockchain...',
    })

    try {
      const response = await fetch(
        `/api/driver-applications/${dotApp.id}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': userAddress,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        // Handle duplicate case gracefully
        if (response.status === 409) {
          setDotAppActionMessage({
            type: 'success',
            text: 'Application already verified on blockchain',
          })
          // Still refresh to show updated status
          setTimeout(() => {
            setDotAppActionMessage(null)
            fetchHubData()
          }, 3000)
          return
        }
        throw new Error(data.details || data.error || 'Verification failed')
      }

      setDotAppActionMessage({
        type: 'success',
        text: `Application verified! Transaction: ${data.transactionHash?.slice(0, 10)}...`,
      })

      // Clear message after 5 seconds and refresh data
      setTimeout(() => {
        setDotAppActionMessage(null)
        setSelectedDotApp(null)
        fetchHubData()
      }, 5000)
    } catch (err: unknown) {
      console.error('DOT verify error:', err)
      setDotAppActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification failed',
      })
    } finally {
      setVerifyingDotApp(false)
    }
  }

  // Handle delete DOT application (only for apps not yet on blockchain)
  const handleDeleteDotApp = async (dotApp: HubDotApplication) => {
    if (!userAddress) return

    // Double-check: don't allow deleting apps already on blockchain
    if (dotApp.blockchainTxHash) {
      setDotAppActionMessage({
        type: 'error',
        text: 'Cannot delete an application that has been verified on blockchain',
      })
      return
    }

    if (
      !window.confirm('Delete this DOT application? This cannot be undone.')
    ) {
      return
    }

    setDeletingDotApp(true)
    setDotAppActionMessage({ type: 'success', text: 'Deleting application...' })

    try {
      const response = await fetch(`/api/driver-applications/${dotApp.id}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': userAddress,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(
          data.details || data.error || 'Failed to delete application',
        )
      }

      setDotAppActionMessage({ type: 'success', text: 'Application deleted' })

      // Close modal and refresh data
      setTimeout(() => {
        setDotAppActionMessage(null)
        setSelectedDotApp(null)
        fetchHubData()
      }, 1500)
    } catch (err: unknown) {
      console.error('DOT delete error:', err)
      setDotAppActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Delete failed',
      })
    } finally {
      setDeletingDotApp(false)
    }
  }

  // Handle selecting a resume - fetch structured data for preview
  const handleSelectResume = async (resume: HubResume) => {
    // Only built resumes have structured data for preview
    if (resume.resumeType !== 'built') {
      // For uploaded resumes, just open in browser if we have IPFS hash
      const hasRealIpfsHash =
        resume.ipfsHash && !resume.ipfsHash.startsWith('built_')
      if (hasRealIpfsHash) {
        window.open(
          `https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`,
          '_blank',
        )
      } else {
        setResumeActionMessage({
          type: 'error',
          text: 'Cannot preview uploaded resume without IPFS hash',
        })
      }
      return
    }

    setSelectedResume(resume)
    setLoadingResumeData(true)
    setSelectedResumeData(null)

    try {
      const response = await fetch(`/api/resumes/${resume.id}`, {
        headers: {
          'x-wallet-address': userAddress || '',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch resume data')
      }

      const data = await response.json()
      setSelectedResumeData(data.structured_data || null)
    } catch (err) {
      console.error('Error fetching resume data:', err)
      setResumeActionMessage({
        type: 'error',
        text: 'Failed to load resume preview',
      })
      setSelectedResume(null)
    } finally {
      setLoadingResumeData(false)
    }
  }

  // Close resume preview modal
  const handleCloseResumePreview = () => {
    setSelectedResume(null)
    setSelectedResumeData(null)
  }

  // `silent` skips the loading skeleton — used for background refreshes
  // (visibility/focus) so the hub doesn't tear down and rebuild every 30s,
  // which felt like a "full page refresh" to users. Initial load and explicit
  // retries pass silent=false so the skeleton still appears when there's no
  // existing data to show.
  const fetchHubData = useCallback(async (silent = false) => {
    if (!userAddress) {
      if (!silent) setLoading(false)
      return
    }

    try {
      if (!silent) setLoading(true)
      setError(null)

      const response = await fetch('/api/driver/hub', {
        headers: {
          'x-wallet-address': userAddress,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load hub data')
      }

      const data = await response.json()
      console.log('[DRIVER HUB CLIENT] Received data:', {
        dotApplicationsCount: data.dotApplications?.length,
        dotApplications: data.dotApplications?.map(
          (app: HubDotApplication) => ({
            id: app.id,
            applicantName: app.applicantName,
            isInProgress: app.isInProgress,
            currentStep: app.currentStep,
          }),
        ),
        hasProfile: !!data.profile,
      })
      setHubData(data)
      
      // Sync to Zustand store so journey progress updates
      useDriverHubStore.getState().loadHubData({
        profile: data.profile,
        displayNameFallback: data.displayNameFallback,
        resumes: data.resumes,
        dotApplications: data.dotApplications,
        mvrRecords: data.mvrRecords || [],
        jobApplications: data.jobApplications || [],
        stats: data.stats,
      })
    } catch (err) {
      console.error('Error fetching hub data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userAddress])

  // Section-specific refresh functions - only fetch and update the relevant section
  const refreshResumes = useCallback(async () => {
    if (!userAddress) return
    setRefreshingResumes(true)
    try {
      const response = await fetch('/api/resumes', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const resumes = await response.json()
        setHubData(prev => prev ? { ...prev, resumes } : null)
      }
    } catch (err) {
      console.error('Error refreshing resumes:', err)
    } finally {
      setRefreshingResumes(false)
    }
  }, [userAddress])

  const refreshDotApplications = useCallback(async () => {
    if (!userAddress) return
    setRefreshingDotApps(true)
    try {
      // Re-fetch from hub endpoint but only update dot applications
      const response = await fetch('/api/driver/hub', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        setHubData(prev => prev ? { 
          ...prev, 
          dotApplications: data.dotApplications,
          stats: { ...prev.stats, ...data.stats }
        } : null)
      }
    } catch (err) {
      console.error('Error refreshing DOT applications:', err)
    } finally {
      setRefreshingDotApps(false)
    }
  }, [userAddress])

  const refreshMvrRecords = useCallback(async () => {
    if (!userAddress) return
    setRefreshingMvr(true)
    try {
      // Re-fetch from hub endpoint but only update MVR records
      const response = await fetch('/api/driver/hub', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        setHubData(prev => prev ? { 
          ...prev, 
          mvrRecords: data.mvrRecords,
          stats: { ...prev.stats, ...data.stats }
        } : null)
      }
    } catch (err) {
      console.error('Error refreshing MVR records:', err)
    } finally {
      setRefreshingMvr(false)
    }
  }, [userAddress])

  const refreshJobApplications = useCallback(async () => {
    if (!userAddress) return
    setRefreshingJobApps(true)
    try {
      const response = await fetch('/api/applications/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress }),
      })
      if (response.ok) {
        const data = await response.json()
        // Transform to match HubJobApplication format
        const jobApplications = (data.applications || []).map((app: Record<string, unknown>) => ({
          id: app.id,
          status: app.status,
          appliedAt: app.applied_at,
          viewCount: app.view_count || 0,
          jobTitle: app.job_title,
          companyName: app.employer_name,
        }))
        setHubData(prev => prev ? { ...prev, jobApplications } : null)
      }
    } catch (err) {
      console.error('Error refreshing job applications:', err)
    } finally {
      setRefreshingJobApps(false)
    }
  }, [userAddress])

  const handleDiscardInProgressDotApp = useCallback(
    async (app: HubDotApplication) => {
      if (!onDeleteInProgressDotApp) return
      if (
        !window.confirm(
          'Discard this in-progress application? Your unsaved form data will be removed.',
        )
      )
        return

      setDeletingInProgressDotApp(true)
      setSelectedDotApp(null)
      try {
        await onDeleteInProgressDotApp()
        // Update only DOT applications in state so the rest of the hub doesn't refetch
        const appId = app.id
        setHubData((prev) => {
          if (!prev) return null
          const newApps = prev.dotApplications.filter((a) => a.id !== appId)
          return {
            ...prev,
            dotApplications: newApps,
            stats: {
              ...prev.stats,
              totalDotApps: newApps.length,
              inProgressDotApps: newApps.filter((a) => a.isInProgress).length,
              completedDotApps: newApps.filter((a) => a.isComplete).length,
              verifiedDotApps: newApps.filter(
                (a) => a.verificationStatus === 'VERIFIED',
              ).length,
            },
          }
        })
      } catch (err) {
        console.error('Discard in-progress error:', err)
        alert(
          err instanceof Error ? err.message : 'Failed to discard application',
        )
      } finally {
        setDeletingInProgressDotApp(false)
      }
    },
    [onDeleteInProgressDotApp],
  )

  useEffect(() => {
    fetchHubData()
  }, [fetchHubData])

  // Auto-refresh when tab becomes visible (solves stale data after admin changes
  // in other tabs). Always silent — focus events shouldn't tear down the hub.
  const silentRefresh = useCallback(() => fetchHubData(true), [fetchHubData])
  const { refresh: triggerRefresh, isStale } = useVisibilityRefresh(silentRefresh, {
    staleTime: 30000,
    enabled: !!userAddress,
  })

  // Card styling: match employment verification (color-mix semi-transparent gray)
  const cardClass = `rounded-2xl border shadow-lg transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
      : 'bg-white/70 border-gray-200 hover:border-gray-300'
  }`

  const sectionHeaderClass = `text-lg font-bold flex items-center gap-3 mb-4 ${
    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
  }`

  if (loading) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <Loader2
            className={`w-12 h-12 animate-spin mx-auto mb-4 ${
              isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          />
          <p className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}>
            Loading your Driver Hub...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div
          className={`text-center p-8 rounded-2xl ${
            isDarkTheme(theme) ? 'bg-red-900/20' : 'bg-red-50'
          }`}
        >
          <AlertCircle className='w-12 h-12 text-red-500 mx-auto mb-4' />
          <p className='text-red-500 font-medium'>{error}</p>
          <button
            onClick={() => fetchHubData()}
            className={`mt-4 px-4 py-2 rounded-lg font-medium ${
              isDarkTheme(theme)
                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const data = hubData || {
    success: true,
    isNewUser: true,
    profile: null,
    displayNameFallback: null,
    resumes: [],
    dotApplications: [],
    mvrRecords: [],
    jobApplications: [],
    payments: [],
    transactions: [],
    stats: {
      profileCompleteness: 0,
      totalResumes: 0,
      verifiedResumes: 0,
      totalDotApps: 0,
      verifiedDotApps: 0,
      completedDotApps: 0,
      inProgressDotApps: 0,
      totalMvrRecords: 0,
      validMvrRecords: 0,
      totalJobApplications: 0,
      pendingApplications: 0,
      viewedApplications: 0,
      contactedApplications: 0,
      totalSpentUSDC: 0,
      totalTransactions: 0,
    },
  }

  // Display name: profile first+last, else fallback from submitted app, else 'Driver'
  const profileName =
    data.profile?.first_name || data.profile?.last_name
      ? `${data.profile.first_name ?? ''} ${data.profile.last_name ?? ''}`.trim()
      : ''
  const displayName =
    profileName || (data.displayNameFallback ?? '') || 'Driver'

  const cdlSummary = data.profile?.cdl_class
    ? `CDL Class ${data.profile.cdl_class}${data.profile.endorsements?.length ? ' • ' + data.profile.endorsements.join(', ') : ''}`
    : null

  return (
    <div className='w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6'>
      {/* ============================================================ */}
      {/* HEADER & PROFILE COMPLETENESS */}
      {/* ============================================================ */}
      <div className={`${cardClass} p-6`}>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6'>
          {/* Profile Info */}
          <div className='flex items-center gap-4'>
            <AvatarUpload
              name={displayName}
              avatarUrl={data.profile?.avatar_url ?? null}
              size="xl"
              color="teal"
              uploadEndpoint="/api/driver/avatar"
              walletAddress={userAddress}
              onSuccess={(url) =>
                setHubData(prev =>
                  prev?.profile
                    ? { ...prev, profile: { ...prev.profile, avatar_url: url } }
                    : prev
                )
              }
            />
            <div>
              <div className='flex items-center gap-2'>
                <h1
                  className={`text-2xl sm:text-3xl font-bold ${
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {displayName}'s Driver Hub
                </h1>
                {/* Manual refresh button */}
                <button
                  onClick={triggerRefresh}
                  disabled={loading}
                  title={isStale ? 'Data may be stale - click to refresh' : 'Refresh data'}
                  className={`p-1.5 rounded-lg transition-all ${
                    loading
                      ? 'opacity-50 cursor-not-allowed'
                      : isDarkTheme(theme)
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  } ${isStale ? 'text-amber-500' : ''}`}
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {cdlSummary && (
                <p
                  className={`text-sm mt-1 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                >
                  {cdlSummary}
                </p>
              )}
              {!cdlSummary && (
                <p
                  className={`text-sm mt-1 ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Your professional driver profile
                </p>
              )}
            </div>
          </div>

          {/* Profile Completeness */}
          <div className='flex-shrink-0 w-full lg:w-72'>
            <div className='flex items-center justify-between mb-2'>
              <span
                className={`text-sm font-semibold ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Profile Completeness
              </span>
              <span
                className={`text-lg font-bold ${
                  data.stats.profileCompleteness >= 80
                    ? 'text-green-500'
                    : data.stats.profileCompleteness >= 50
                      ? 'text-yellow-500'
                      : isDarkTheme(theme)
                        ? 'text-gray-400'
                        : 'text-gray-500'
                }`}
              >
                {data.stats.profileCompleteness}%
              </span>
            </div>
            <div
              className={`h-3 rounded-full overflow-hidden ${
                isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.stats.profileCompleteness >= 80
                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                    : data.stats.profileCompleteness >= 50
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                      : 'bg-indigo-500/50'
                }`}
                style={{ width: `${data.stats.profileCompleteness}%` }}
              />
            </div>
            {data.stats.profileCompleteness < 100 && (
              <p
                className={`text-xs mt-2 ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {getCompletenessHint(data)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PROFILE SETUP PROMPT (shows when no name is set) */}
      {/* ============================================================ */}
      {!profileName && (
        <div className={`${cardClass} p-4 border-l-4 border-l-teal-500`}>
          <div className='flex items-center gap-4'>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDarkTheme(theme) ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}>
              <Sparkles className={`w-5 h-5 ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div className='flex-1 min-w-0'>
              <h3 className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                Who are you? Set up your profile
              </h3>
              <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                A quick form so employers can find you. Name, contact, and CDL — under a minute.
              </p>
            </div>
            <button
              onClick={() => onNavigate('profile-setup')}
              className='flex-shrink-0 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition-colors text-sm'
            >
              Set Up Profile
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* QUICK STATS */}
      {/* ============================================================ */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <QuickStatCard
          icon={<FileText className='w-5 h-5' />}
          label='Resumes'
          value={data.stats.totalResumes}
          subValue={
            data.stats.verifiedResumes > 0
              ? `${data.stats.verifiedResumes} verified`
              : undefined
          }
          theme={theme}
          color='blue'
        />
        <QuickStatCard
          icon={<ClipboardList className='w-5 h-5' />}
          label='DOT Apps'
          value={data.stats.totalDotApps}
          subValue={
            data.stats.inProgressDotApps > 0
              ? `${data.stats.inProgressDotApps} in progress`
              : data.stats.verifiedDotApps > 0
                ? `${data.stats.verifiedDotApps} verified`
                : data.stats.completedDotApps > 0
                  ? `${data.stats.completedDotApps} completed`
                  : undefined
          }
          theme={theme}
          color='purple'
        />
        <QuickStatCard
          icon={<Briefcase className='w-5 h-5' />}
          label='Applications'
          value={data.stats.totalJobApplications}
          subValue={
            data.stats.contactedApplications > 0
              ? `${data.stats.contactedApplications} employer contacted`
              : data.stats.viewedApplications > 0
                ? `${data.stats.viewedApplications} profile views`
                : undefined
          }
          theme={theme}
          color='green'
        />
        <QuickStatCard
          icon={<Car className='w-5 h-5' />}
          label='MVR Records'
          value={data.stats.totalMvrRecords}
          subValue={
            data.stats.validMvrRecords > 0
              ? `${data.stats.validMvrRecords} valid`
              : undefined
          }
          theme={theme}
          color='orange'
        />
      </div>

      {/* ============================================================ */}
      {/* STORMCHAIN TOKENS SECTION */}
      {/* ============================================================ */}
      <div className={`${cardClass} p-6`}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <StormTokenMark size='lg' />
            <div>
              <h2
                className={`text-lg font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
              >
                Storm Tokens
              </h2>
              <div className='flex items-center gap-2 mt-1'>
                <span
                  className={`text-3xl font-bold ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
                >
                  0
                </span>
                <span
                  className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  STORM
                </span>
              </div>
            </div>
          </div>

          <div className='flex flex-col items-end gap-2'>
            {/* Coming Soon Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}
            >
              <Sparkles className='w-3 h-3' />
              Coming Soon
            </div>

            {/* Learn More Button */}
            <button
              onClick={() => onNavigate('stormchain')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                isDarkTheme(theme)
                  ? 'text-indigo-400 hover:text-indigo-300'
                  : 'text-indigo-600 hover:text-indigo-500'
              }`}
            >
              Learn about STORM →
            </button>
          </div>
        </div>

        {/* Teaser info */}
        <p
          className={`mt-4 text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}
        >
          Earn STORM tokens every time you verify your resume or use premium
          features. Early adopters earn the most rewards!
        </p>
      </div>

      {/* ============================================================ */}
      {/* STORMCHAIN CARD - QR SHARE SECTION */}
      {/* ============================================================ */}
      <div className='mb-6'>
        <ShareProfileCard
          walletAddress={userAddress}
          driverName={profileName || (data.displayNameFallback ?? '') || undefined}
          onViewCareerCard={() => onNavigate('career-card')}
        />
      </div>

      {/* ============================================================ */}
      {/* EMPLOYMENT VERIFICATION - Driver only (DOT / resume data) */}
      {/* ============================================================ */}
      <div className='mb-6'>
        <DriverEmploymentVerificationSection userAddress={userAddress} />
      </div>

      {/* ============================================================ */}
      {/* EMPLOYER REQUESTS - Requests from interested employers */}
      {/* ============================================================ */}
      <div className='mb-6'>
        <CandidateRequestsSection
          userAddress={userAddress}
          onNavigateToResume={() => onNavigate('resume')}
          onNavigateToDotApp={() => onNavigate('dotapp')}
        />
      </div>

      {/* ============================================================ */}
      {/* MAIN SECTIONS GRID */}
      {/* ============================================================ */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* RESUMES SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  isDarkTheme(theme) ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}
              >
                <FileText className='w-5 h-5 text-blue-500' />
              </div>
              Resumes
              {data.resumes.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  ({data.resumes.length})
                </span>
              )}
            </h2>
            <div className='flex items-center gap-2'>
              <button
                onClick={refreshResumes}
                disabled={refreshingResumes}
                title='Refresh resumes'
                className={`p-2 rounded-lg transition-all ${
                  refreshingResumes ? 'opacity-50 cursor-not-allowed' : isDarkTheme(theme)
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingResumes ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowUploadResumeModal(true)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkTheme(theme)
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Upload className='w-4 h-4' />
                Upload Resume
              </button>
              <button
                onClick={() => onNavigate('resume')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkTheme(theme)
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Plus className='w-4 h-4' />
                {data.resumes.length > 0 ? 'New Resume' : 'Add Resume'}
              </button>
            </div>
          </div>

          {data.resumes.length === 0 ? (
            <EmptyState
              icon={<FileText className='w-8 h-8' />}
              title='No resumes yet'
              description='Upload or build your professional resume to get started'
              actionLabel='Add Resume'
              onAction={() => onNavigate('resume')}
              theme={theme}
            />
          ) : (
            <div className='space-y-3'>
              {data.resumes.slice(0, 3).map((resume) => {
                // Check if resume has real IPFS hash or just a placeholder
                const hasRealIpfs =
                  resume.ipfsHash && !resume.ipfsHash.startsWith('built_')
                // Determine actual status: verified if has blockchain tx hash
                const isVerified = resume.verificationStatus === 'VERIFIED' || resume.blockchainTxHash
                // Can verify if has real IPFS hash but not yet verified on blockchain
                const canVerify = hasRealIpfs && !resume.blockchainTxHash
                // Can edit if it's a built resume
                const canEdit = resume.resumeType === 'built'

                return (
                  <div
                    key={resume.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 hover:bg-gray-600/50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p
                          className={`font-medium truncate ${
                            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {resume.title || resume.filename}
                        </p>
                        {isVerified && (
                          <span className='flex items-center gap-1 text-xs text-green-400'>
                            <CheckCircle className='w-3 h-3' />
                            Verified
                          </span>
                        )}
                        {resume.resumeType === 'built' && !isVerified && (
                          <span
                            className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
                              isDarkTheme(theme)
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            Built
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        Created {formatDate(resume.createdAt)}
                      </p>
                    </div>
                    <div className='flex items-center gap-2 ml-3'>
                      {/* View button */}
                      <button
                        onClick={() => handleSelectResume(resume)}
                        className={`p-2 rounded-lg ${
                          isDarkTheme(theme)
                            ? 'hover:bg-gray-600 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title='Preview'
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      {/* Edit button - only for built resumes */}
                      {canEdit && (
                        <button
                          onClick={() => {
                            // Navigate to resume builder with this resume
                            onNavigate('resume')
                          }}
                          className={`p-2 rounded-lg ${
                            isDarkTheme(theme)
                              ? 'hover:bg-gray-600 text-gray-400'
                              : 'hover:bg-gray-200 text-gray-600'
                          }`}
                          title='Edit'
                        >
                          <Edit className='w-4 h-4' />
                        </button>
                      )}
                      {/* Verify button - only for resumes with IPFS hash but not yet on blockchain */}
                      {canVerify && (
                        <button
                          onClick={() => handleSelectResume(resume)}
                          className='p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                          title='Verify on Blockchain'
                        >
                          <Shield className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {data.resumes.length > 3 && (
                <button
                  onClick={() => onNavigate('resume')}
                  className={`w-full rounded-lg border py-2 text-sm font-medium transition-colors ${
                    isDarkTheme(theme)
                      ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                      : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  View all {data.resumes.length} resumes →
                </button>
              )}
            </div>
          )}
        </section>

        {/* DOT APPLICATIONS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  isDarkTheme(theme) ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}
              >
                <ClipboardList className='w-5 h-5 text-purple-500' />
              </div>
              DOT Applications
              {data.dotApplications.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  ({data.dotApplications.length})
                </span>
              )}
            </h2>
            <div className='flex items-center gap-2'>
              <button
                onClick={refreshDotApplications}
                disabled={refreshingDotApps}
                title='Refresh DOT applications'
                className={`p-2 rounded-lg transition-all ${
                  refreshingDotApps ? 'opacity-50 cursor-not-allowed' : isDarkTheme(theme)
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingDotApps ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onStartDotApp || (() => onNavigate('dotapp'))}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkTheme(theme)
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Plus className='w-4 h-4' />
                {data.dotApplications.length > 0 ? 'New Application' : 'Start Application'}
              </button>
            </div>
          </div>

          {data.dotApplications.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className='w-8 h-8' />}
              title='No DOT applications'
              description='Complete a DOT application to verify your qualifications'
              actionLabel='Start DOT Application'
              onAction={onStartDotApp || (() => onNavigate('dotapp'))}
              theme={theme}
            />
          ) : (
            <div className='space-y-3'>
              {data.dotApplications.slice(0, 3).map((app, index) => {
                // Build title: use applicant name if available, otherwise generic
                const appTitle = app.applicantName
                  ? `${app.applicantName}'s Application`
                  : `DOT Application ${data.dotApplications.length - index}`

                // Determine actual status: if has blockchain tx hash, it's VERIFIED
                const actualStatus = app.blockchainTxHash
                  ? 'VERIFIED'
                  : app.isComplete
                    ? 'PENDING'
                    : 'IN_PROGRESS'

                // Can verify if complete but not yet on blockchain
                const canVerify = app.isComplete && !app.blockchainTxHash

                return (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 hover:bg-gray-600/50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p
                          className={`font-medium truncate ${
                            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {appTitle}
                        </p>
                        {actualStatus === 'VERIFIED' && (
                          <span className='flex items-center gap-1 text-xs text-green-400'>
                            <CheckCircle className='w-3 h-3' />
                            Verified
                          </span>
                        )}
                        {!app.isComplete && (
                          <span
                            className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
                              isDarkTheme(theme)
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            Form {app.currentStep} of 3
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {app.isInProgress
                          ? 'Continue where you left off'
                          : formatDate(app.createdAt)}
                      </p>
                    </div>
                    <div className='flex items-center gap-2 ml-3'>
                      {/* View button */}
                      <button
                        onClick={() => setSelectedDotApp(app)}
                        className={`p-2 rounded-lg ${
                          isDarkTheme(theme)
                            ? 'hover:bg-gray-600 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title='View Details'
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      {/* Edit button - only for in-progress or complete but not verified */}
                      {(app.isInProgress || canVerify) && (
                        <button
                          onClick={() => onNavigate('dotapp')}
                          className={`p-2 rounded-lg ${
                            isDarkTheme(theme)
                              ? 'hover:bg-gray-600 text-gray-400'
                              : 'hover:bg-gray-200 text-gray-600'
                          }`}
                          title={app.isInProgress ? 'Continue' : 'Edit'}
                        >
                          <Edit className='w-4 h-4' />
                        </button>
                      )}
                      {/* Verify button - only for complete apps not yet on blockchain */}
                      {canVerify && (
                        <button
                          onClick={() => handleVerifyDotApp(app)}
                          className='p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                          title='Verify on Blockchain'
                        >
                          <Shield className='w-4 h-4' />
                        </button>
                      )}
                      {/* Delete button - only for in-progress */}
                      {app.isInProgress && onDeleteInProgressDotApp && (
                        <button
                          onClick={() => handleDiscardInProgressDotApp(app)}
                          disabled={deletingInProgressDotApp}
                          className={`p-2 rounded-lg ${
                            isDarkTheme(theme)
                              ? 'hover:bg-red-900/30 text-red-400 disabled:opacity-50'
                              : 'hover:bg-red-50 text-red-500 disabled:opacity-50'
                          }`}
                          title='Discard'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {data.dotApplications.length > 3 && (
                <button
                  onClick={() => onNavigate('dotapp')}
                  className={`w-full rounded-lg border py-2 text-sm font-medium transition-colors ${
                    isDarkTheme(theme)
                      ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                      : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  View all {data.dotApplications.length} applications →
                </button>
              )}
            </div>
          )}
        </section>

        {/* MVR RECORDS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  isDarkTheme(theme) ? 'bg-orange-500/20' : 'bg-orange-100'
                }`}
              >
                <Car className='w-5 h-5 text-orange-500' />
              </div>
              MVR Records
              {data.mvrRecords.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  ({data.mvrRecords.length})
                </span>
              )}
            </h2>
            <div className='flex items-center gap-2'>
              <button
                onClick={refreshMvrRecords}
                disabled={refreshingMvr}
                title='Refresh MVR records'
                className={`p-2 rounded-lg transition-all ${
                  refreshingMvr ? 'opacity-50 cursor-not-allowed' : isDarkTheme(theme)
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingMvr ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('mvr')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkTheme(theme)
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Plus className='w-4 h-4' />
                Order MVR
              </button>
            </div>
          </div>

          {data.mvrRecords.length === 0 ? (
            <EmptyState
              icon={<Car className='w-8 h-8' />}
              title='No MVR records'
              description='Order your Motor Vehicle Record to verify your driving history'
              actionLabel='Order MVR'
              onAction={() => onNavigate('mvr')}
              theme={theme}
            />
          ) : (
            <div className='space-y-3'>
              {data.mvrRecords.slice(0, 3).map((mvr) => (
                <ItemRow
                  key={mvr.id}
                  title={`${mvr.licenseState} MVR`}
                  subtitle={formatDate(mvr.createdAt)}
                  status={getMvrStatus(mvr)}
                  badge={
                    mvr.hasResult && mvr.totalPoints !== null
                      ? `${mvr.totalPoints} pts`
                      : undefined
                  }
                  onClick={() => onViewMvr?.(mvr.id)}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>

        {/* JOB APPLICATIONS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  isDarkTheme(theme) ? 'bg-green-500/20' : 'bg-green-100'
                }`}
              >
                <Briefcase className='w-5 h-5 text-green-500' />
              </div>
              Job Applications
              {data.jobApplications.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  ({data.jobApplications.length})
                </span>
              )}
            </h2>
            <div className='flex items-center gap-2'>
              <button
                onClick={refreshJobApplications}
                disabled={refreshingJobApps}
                title='Refresh job applications'
                className={`p-2 rounded-lg transition-all ${
                  refreshingJobApps ? 'opacity-50 cursor-not-allowed' : isDarkTheme(theme)
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingJobApps ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('jobs')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkTheme(theme)
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Plus className='w-4 h-4' />
                Browse Jobs
              </button>
            </div>
          </div>

          {data.jobApplications.length === 0 ? (
            <EmptyState
              icon={<Briefcase className='w-8 h-8' />}
              title='No job applications'
              description='Browse jobs and apply with your verified profile'
              actionLabel='Browse Jobs'
              onAction={() => onNavigate('jobs')}
              theme={theme}
            />
          ) : (
            <div className='space-y-3'>
              {data.jobApplications.slice(0, 3).map((app) => (
                <ItemRow
                  key={app.id}
                  title={app.jobTitle}
                  subtitle={`${app.companyName} • ${formatDate(app.appliedAt)}`}
                  status={app.status.toUpperCase()}
                  badge={
                    app.viewCount > 0 ? `${app.viewCount} views` : undefined
                  }
                  onClick={() => onNavigate('applications')}
                  theme={theme}
                />
              ))}
              {data.jobApplications.length > 3 && (
                <button
                  onClick={() => onNavigate('applications')}
                  className={`w-full rounded-lg border py-2 text-sm font-medium transition-colors ${
                    isDarkTheme(theme)
                      ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                      : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  View all {data.jobApplications.length} applications →
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ============================================================ */}
      {/* TRANSACTION HISTORY (Collapsible) */}
      {/* ============================================================ */}
      <section className={`${cardClass} p-6`}>
        <button
          onClick={() => setShowPaymentHistory(!showPaymentHistory)}
          className='w-full flex items-center justify-between'
        >
          <h2 className={sectionHeaderClass}>
            <div
              className={`p-2 rounded-lg ${
                isDarkTheme(theme) ? 'bg-gray-500/20' : 'bg-gray-100'
              }`}
            >
              <CreditCard className='w-5 h-5 text-gray-500' />
            </div>
            Transaction History
            {(data.transactions ?? []).length > 0 && (
              <span
                className={`text-sm font-normal ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                ({(data.transactions ?? []).length} transactions)
              </span>
            )}
          </h2>
          <ChevronRight
            className={`w-5 h-5 transition-transform ${
              showPaymentHistory ? 'rotate-90' : ''
            } ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}
          />
        </button>

        {showPaymentHistory && (
          <div className='mt-4 space-y-3'>
            {(data.transactions ?? []).length === 0 ? (
              <p
                className={`text-sm text-center py-4 ${
                  isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                No transactions yet
              </p>
            ) : (
              (data.transactions ?? []).map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}
                >
                  <div>
                    <p
                      className={`font-medium ${
                        isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {tx.description}
                    </p>
                    <p
                      className={`text-xs ${
                        isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className='text-right'>
                    {tx.amount !== null ? (
                      <p
                        className={`font-bold ${
                          isDarkTheme(theme)
                            ? 'text-indigo-400'
                            : 'text-indigo-600'
                        }`}
                      >
                        {tx.currency === 'USD' ? '$' : ''}
                        {tx.amount.toFixed(2)}{' '}
                        {tx.currency !== 'USD' ? tx.currency : ''}
                      </p>
                    ) : (
                      <p
                        className={`text-sm ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        —
                      </p>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        tx.status === 'COMPLETED'
                          ? isDarkTheme(theme)
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-green-100 text-green-700'
                          : isDarkTheme(theme)
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* Resume Preview Modal */}
      {selectedResume && (
        <ResumePreviewModal
          title={selectedResume.title || selectedResume.filename}
          structuredData={selectedResumeData}
          onClose={handleCloseResumePreview}
          theme={theme}
          onEdit={
            onEditResume
              ? () => {
                  onEditResume(selectedResume.id)
                  handleCloseResumePreview()
                }
              : undefined
          }
          onVerify={() => handleVerifyResume(selectedResume)}
          onDelete={() => {
            handleCloseResumePreview()
            setDeletingResume(selectedResume)
          }}
          isVerifying={verifyingResume}
          canVerify={
            selectedResume.resumeType === 'built' &&
            (!selectedResume.ipfsHash ||
              selectedResume.ipfsHash.startsWith('built_'))
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingResume && (
        <Modal onClose={() => setDeletingResume(null)} maxWidth="max-w-md">
          <div className='p-6'>
            <h3
              className={`text-lg font-bold mb-2 ${
                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
              }`}
            >
              Delete Resume?
            </h3>
            <p
              className={`text-sm mb-6 ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Are you sure you want to delete "
              {deletingResume.title || deletingResume.filename}"? This action
              cannot be undone.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => setDeletingResume(null)}
                disabled={deleteLoading}
                className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResume(deletingResume)}
                disabled={deleteLoading}
                className='flex-1 px-4 py-2 rounded-xl font-medium text-sm bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2'
              >
                {deleteLoading ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Trash2 className='w-4 h-4' />
                )}
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DOT Application Detail Modal */}
      {selectedDotApp && (
        <DetailModal
          title={
            selectedDotApp.applicantName
              ? `${selectedDotApp.applicantName}'s Application`
              : 'DOT Application'
          }
          onClose={() => setSelectedDotApp(null)}
          theme={theme}
        >
          <DotAppDetailContent
            dotApp={selectedDotApp}
            theme={theme}
            onNavigate={onNavigate}
            onStartEmploymentVerification={onStartEmploymentVerification}
            onVerify={() => handleVerifyDotApp(selectedDotApp)}
            isVerifying={verifyingDotApp}
            actionMessage={dotAppActionMessage}
            onDelete={() => handleDeleteDotApp(selectedDotApp)}
            isDeleting={deletingDotApp}
          />
        </DetailModal>
      )}

      <UploadResumeModal
        isOpen={showUploadResumeModal}
        onClose={() => setShowUploadResumeModal(false)}
        user={userAddress ? { address: userAddress } : null}
        onUploadComplete={() => fetchHubData()}
      />
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function QuickStatCard({
  icon,
  label,
  value,
  subValue,
  theme,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  theme: string
  color: 'blue' | 'purple' | 'green' | 'orange'
}) {
  const colorClasses = {
    blue:
      isDarkTheme(theme)
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-blue-100 text-blue-600',
    purple:
      isDarkTheme(theme)
        ? 'bg-purple-500/20 text-purple-400'
        : 'bg-purple-100 text-purple-600',
    green:
      isDarkTheme(theme)
        ? 'bg-green-500/20 text-green-400'
        : 'bg-green-100 text-green-600',
    orange:
      isDarkTheme(theme)
        ? 'bg-orange-500/20 text-orange-400'
        : 'bg-orange-100 text-orange-600',
  }

  return (
    <div
      className={`rounded-xl p-4 ${
        isDarkTheme(theme)
          ? 'bg-gray-800/50 border border-gray-700'
          : 'bg-white/70 border border-gray-200 shadow-sm'
      }`}
    >
      <div className='flex items-center gap-3'>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p
            className={`text-2xl font-bold ${
              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
            }`}
          >
            {value}
          </p>
          <p
            className={`text-xs ${
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
        </div>
      </div>
      {subValue && (
        <p
          className={`text-xs mt-2 ${
            isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
          }`}
        >
          {subValue}
        </p>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  theme,
}: {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  theme: string
}) {
  return (
    <div
      className={`text-center py-8 px-4 rounded-xl border-2 border-dashed ${
        isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-300'
      }`}
    >
      <div
        className={`inline-flex p-3 rounded-xl mb-3 ${
          isDarkTheme(theme)
            ? 'bg-gray-800/50 border border-gray-700 text-indigo-400'
            : 'bg-indigo-50 text-indigo-600'
        }`}
      >
        {icon}
      </div>
      <h3
        className={`font-semibold mb-1 ${
          isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-sm mb-4 ${
          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {description}
      </p>
      <button
        onClick={onAction}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
          isDarkTheme(theme)
            ? 'border-gray-600 bg-indigo-500/20 text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/30'
            : 'border-gray-300 bg-indigo-50 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-100'
        }`}
      >
        <Plus className='w-4 h-4' />
        {actionLabel}
      </button>
    </div>
  )
}

function ItemRow({
  title,
  subtitle,
  status,
  badge,
  onClick,
  onDelete,
  deleteDisabled,
  theme,
}: {
  title: string
  subtitle: string
  status: string
  badge?: string
  onClick?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
  theme: string
}) {
  const statusConfig = getStatusConfig(status)
  const rowClass = `flex items-center justify-between p-3 rounded-xl transition-all ${
    isDarkTheme(theme)
      ? 'bg-gray-700/50 hover:bg-gray-600/50'
      : 'bg-gray-50 hover:bg-gray-100'
  }`

  const left = (
    <div className='flex-1 text-left min-w-0'>
      <div className='flex items-center gap-2'>
        <p
          className={`font-medium truncate ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          {title}
        </p>
        {badge && (
          <span
            className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
              isDarkTheme(theme)
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p
        className={`text-xs truncate ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {subtitle}
      </p>
    </div>
  )

  const statusAndChevron = (
    <div className='flex items-center gap-2 ml-3'>
      <span
        className={`px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${statusConfig.className}`}
      >
        {statusConfig.icon}
        {statusConfig.label}
      </span>
      <ChevronRight
        className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
      />
    </div>
  )

  if (onClick) {
    return (
      <div
        className={`flex items-center gap-1 rounded-xl overflow-hidden ${rowClass}`}
      >
        <button
          type='button'
          onClick={onClick}
          className='flex-1 flex items-center justify-between text-left min-w-0'
        >
          {left}
          {statusAndChevron}
        </button>
        {onDelete && (
          <button
            type='button'
            onClick={onDelete}
            disabled={deleteDisabled}
            title='Discard in-progress application'
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              isDarkTheme(theme)
                ? 'hover:bg-red-900/30 text-red-400 disabled:opacity-50'
                : 'hover:bg-red-50 text-red-500 disabled:opacity-50'
            }`}
          >
            <Trash2 className='w-4 h-4' />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex w-full ${rowClass}`}>
      {left}
      {statusAndChevron}
    </div>
  )
}

function DetailModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  theme: string
  children: React.ReactNode
}) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader title={title} onClose={onClose} />
      <div className='p-4'>{children}</div>
    </Modal>
  )
}

function DotAppDetailContent({
  dotApp,
  theme,
  onNavigate,
  onStartEmploymentVerification,
  onVerify,
  isVerifying,
  actionMessage,
  onDelete,
  isDeleting,
}: {
  dotApp: HubDotApplication
  theme: string
  onNavigate: (
    page: 'resume' | 'dotapp' | 'mvr' | 'jobs' | 'applications' | 'stormchain' | 'career-card' | 'profile-setup',
  ) => void
  onStartEmploymentVerification?: () => void
  onVerify?: () => void
  isVerifying?: boolean
  actionMessage?: { type: 'success' | 'error'; text: string } | null
  onDelete?: () => void
  isDeleting?: boolean
}) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`

  // Check if this app can be edited (complete but not yet submitted to blockchain)
  const canEdit =
    dotApp.isComplete && !dotApp.blockchainTxHash && !dotApp.isInProgress

  // Check if this app can be verified (complete but not yet on blockchain)
  const canVerify =
    dotApp.isComplete &&
    !dotApp.blockchainTxHash &&
    !dotApp.isInProgress &&
    onVerify

  // Check if this app can be deleted (not yet on blockchain)
  const canDelete = !dotApp.blockchainTxHash && onDelete

  return (
    <div className='space-y-4'>
      {/* Action Message Toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            actionMessage.type === 'success'
              ? isDarkTheme(theme)
                ? 'bg-green-900/30 border border-green-500/30 text-green-400'
                : 'bg-green-50 border border-green-200 text-green-800'
              : isDarkTheme(theme)
                ? 'bg-red-900/30 border border-red-500/30 text-red-400'
                : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {actionMessage.text}
        </div>
      )}
      {/* Applicant name if available */}
      {dotApp.applicantName && (
        <div>
          <p className={labelClass}>Applicant</p>
          <p className={valueClass}>{dotApp.applicantName}</p>
        </div>
      )}

      <div>
        <p className={labelClass}>
          {dotApp.isInProgress ? 'Last Updated' : 'Submitted'}
        </p>
        <p className={valueClass}>{formatDate(dotApp.createdAt)}</p>
      </div>
      <div>
        <p className={labelClass}>Status</p>
        <StatusBadge
          status={dotApp.isComplete ? dotApp.verificationStatus : 'IN_PROGRESS'}
          theme={theme}
        />
      </div>
      {!dotApp.isComplete && (
        <div>
          <p className={labelClass}>Progress</p>
          <p className={valueClass}>Form {dotApp.currentStep} of 3</p>
          <div
            className={`mt-2 h-2 rounded-full overflow-hidden ${
              isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <div
              className='h-full bg-indigo-500/60 rounded-full'
              style={{ width: `${(dotApp.currentStep / 3) * 100}%` }}
            />
          </div>
          {/* Continue button for in-progress applications */}
          {dotApp.isInProgress && (
            <button
              onClick={() => onNavigate('dotapp')}
              className={`mt-4 w-full py-3 rounded-lg font-semibold transition-all ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              Continue Application
            </button>
          )}
        </div>
      )}

      {/* Verify on Blockchain - Primary CTA for completed apps not yet on chain */}
      {canVerify && (
        <div
          className={`p-4 rounded-lg border ${
            isDarkTheme(theme)
              ? 'bg-yellow-900/20 border-yellow-500/30'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <p
            className={`text-sm font-medium mb-2 ${
              isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-800'
            }`}
          >
            Ready to Verify
          </p>
          <p
            className={`text-xs mb-3 ${
              isDarkTheme(theme) ? 'text-yellow-400/70' : 'text-yellow-700'
            }`}
          >
            Submit your application to the blockchain to make it permanent and
            tamper-proof.
          </p>
          <button
            onClick={onVerify}
            disabled={isVerifying}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 ${
              isDarkTheme(theme)
                ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            {isVerifying ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                Verifying...
              </>
            ) : (
              <>
                <Shield className='w-4 h-4' />
                Verify on Blockchain
              </>
            )}
          </button>
        </div>
      )}

      {/* Edit button for completed apps not yet submitted to blockchain */}
      {canEdit && (
        <button
          onClick={() => onNavigate('dotapp')}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all ${
            isDarkTheme(theme)
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30'
              : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <Edit className='w-4 h-4' />
          Edit DOT Application
        </button>
      )}

      {/* Delete button for apps not yet on blockchain */}
      {canDelete && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 ${
            isDarkTheme(theme)
              ? 'bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-900/30'
              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
          }`}
        >
          {isDeleting ? (
            <>
              <Loader2 className='w-4 h-4 animate-spin' />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className='w-4 h-4' />
              Delete Application
            </>
          )}
        </button>
      )}

      {dotApp.blockchainApplicationId && (
        <div>
          <p className={labelClass}>Application ID</p>
          <p className={`${valueClass} font-mono`}>
            {dotApp.blockchainApplicationId}
          </p>
        </div>
      )}
      {dotApp.blockchainTxHash && (
        <div>
          <p className={labelClass}>Blockchain Transaction</p>
          <a
            href={`https://sepolia.basescan.org/tx/${dotApp.blockchainTxHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm text-blue-500 hover:underline flex items-center gap-1'
          >
            View on BaseScan <ExternalLink className='w-3 h-3' />
          </a>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, theme }: { status: string; theme: string }) {
  const config = getStatusConfig(status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateString: string): string {
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

function formatPaymentType(type: string): string {
  const types: Record<string, string> = {
    resume_verification: 'Resume Verification',
    dot_application: 'DOT Application',
    mvr_order: 'MVR Order',
    mvr: 'MVR Order',
  }
  return (
    types[type] ||
    type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

function getStatusConfig(status: string): {
  label: string
  icon: React.ReactNode
  className: string
} {
  const normalized = status.toUpperCase()

  switch (normalized) {
    case 'VERIFIED':
      return {
        label: 'Verified',
        icon: <CheckCircle className='w-3 h-3' />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        icon: <Clock className='w-3 h-3' />,
        className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      }
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        icon: <TrendingUp className='w-3 h-3' />,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      }
    case 'SUBMITTED':
      return {
        label: 'Submitted',
        icon: <Clock className='w-3 h-3' />,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      }
    case 'VIEWED':
      return {
        label: 'Viewed',
        icon: <Eye className='w-3 h-3' />,
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      }
    case 'INTERVIEWING':
    case 'INTERVIEW':
      return {
        label: 'Interviewing',
        icon: <Briefcase className='w-3 h-3' />,
        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      }
    case 'HIRED':
      return {
        label: 'Hired',
        icon: <CheckCircle className='w-3 h-3' />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'REJECTED':
    case 'FAILED':
      return {
        label: normalized === 'REJECTED' ? 'Rejected' : 'Failed',
        icon: <AlertCircle className='w-3 h-3' />,
        className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      }
    case 'COMPLETED':
      return {
        label: 'Completed',
        icon: <CheckCircle className='w-3 h-3' />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'DRAFT':
      return {
        label: 'Draft',
        icon: <FileText className='w-3 h-3' />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
    default:
      return {
        label: status,
        icon: <Clock className='w-3 h-3' />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
  }
}

function getMvrStatus(mvr: HubMvrRecord): string {
  if (mvr.hasResult && mvr.licenseStatus) {
    return mvr.licenseStatus === 'Valid'
      ? 'VERIFIED'
      : mvr.licenseStatus.toUpperCase()
  }
  if (mvr.orderStatus === 'completed') return 'COMPLETED'
  if (mvr.orderStatus === 'pending' || mvr.orderStatus === 'processing')
    return 'PENDING'
  return mvr.orderStatus.toUpperCase()
}

function getCompletenessHint(data: HubData): string {
  const { stats, profile } = data

  if (!profile) {
    return 'Start by uploading a resume or completing a DOT application'
  }
  if (stats.totalResumes === 0) {
    return 'Add a resume to boost your profile'
  }
  if (stats.verifiedResumes === 0 && stats.totalResumes > 0) {
    return 'Verify your resume on the blockchain'
  }
  if (stats.completedDotApps === 0) {
    return 'Complete a DOT application for employer verification'
  }
  if (stats.totalMvrRecords === 0) {
    return 'Add an MVR to complete your profile'
  }
  if (!profile.cdl_number || !profile.cdl_class) {
    return 'Add your CDL information'
  }
  return 'Your profile is looking great!'
}
