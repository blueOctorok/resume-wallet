'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import ShareProfileCard from './ShareProfileCard'
import {
  FileText,
  ClipboardList,
  Car,
  Briefcase,
  CreditCard,
  Plus,
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
  totalMvrRecords: number
  validMvrRecords: number
  totalJobApplications: number
  pendingApplications: number
  viewedApplications: number
  interviewingApplications: number
  totalSpentUSDC: number
  totalTransactions: number
}

interface HubData {
  success: boolean
  isNewUser: boolean
  profile: any
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
  onNavigate: (page: 'resume' | 'dotapp' | 'mvr' | 'jobs' | 'applications') => void
  onStartDotApp?: () => void
  onViewMvr?: (orderId: string) => void
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DriverHub({ 
  userAddress, 
  onNavigate,
  onStartDotApp,
  onViewMvr,
}: DriverHubProps) {
  const { theme } = useTheme()
  const [hubData, setHubData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [selectedResume, setSelectedResume] = useState<HubResume | null>(null)
  const [selectedDotApp, setSelectedDotApp] = useState<HubDotApplication | null>(null)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [deletingResume, setDeletingResume] = useState<HubResume | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  const fetchHubData = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
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
      setHubData(data)
    } catch (err) {
      console.error('Error fetching hub data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchHubData()
  }, [fetchHubData])

  // Card styling based on theme
  const cardClass = `rounded-2xl border shadow-lg transition-all duration-200 ${
    theme === 'dark'
      ? 'bg-brand-sage-light/20 border-brand-mint/30 hover:border-brand-mint/50'
      : 'bg-white/90 border-brand-sage/20 hover:border-brand-sage/40'
  }`

  const sectionHeaderClass = `text-lg font-bold flex items-center gap-3 mb-4 ${
    theme === 'dark' ? 'text-white' : 'text-gray-900'
  }`

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`} />
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Loading your Driver Hub...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className={`text-center p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
        }`}>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={fetchHubData}
            className={`mt-4 px-4 py-2 rounded-lg font-medium ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900'
                : 'bg-brand-sage text-white'
            }`}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const data = hubData || {
    isNewUser: true,
    profile: null,
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
      totalMvrRecords: 0,
      validMvrRecords: 0,
      totalJobApplications: 0,
      pendingApplications: 0,
      viewedApplications: 0,
      interviewingApplications: 0,
      totalSpentUSDC: 0,
      totalTransactions: 0,
    },
  }

  // Get display name from profile
  const displayName = data.profile?.first_name 
    ? `${data.profile.first_name}${data.profile.last_name ? ' ' + data.profile.last_name : ''}`
    : 'Driver'

  const cdlSummary = data.profile?.cdl_class 
    ? `CDL Class ${data.profile.cdl_class}${data.profile.endorsements?.length ? ' • ' + data.profile.endorsements.join(', ') : ''}`
    : null

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ============================================================ */}
      {/* HEADER & PROFILE COMPLETENESS */}
      {/* ============================================================ */}
      <div className={`${cardClass} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Profile Info */}
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-brand-mint to-teal-600 shadow-lg shadow-brand-mint/30'
                : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark shadow-lg shadow-brand-sage/30'
            }`}>
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl sm:text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {displayName}'s Driver Hub
              </h1>
              {cdlSummary && (
                <p className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`}>
                  {cdlSummary}
                </p>
              )}
              {!cdlSummary && (
                <p className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Your professional driver profile
                </p>
              )}
            </div>
          </div>

          {/* Profile Completeness */}
          <div className="flex-shrink-0 w-full lg:w-72">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Profile Completeness
              </span>
              <span className={`text-lg font-bold ${
                data.stats.profileCompleteness >= 80
                  ? 'text-green-500'
                  : data.stats.profileCompleteness >= 50
                    ? 'text-yellow-500'
                    : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {data.stats.profileCompleteness}%
              </span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.stats.profileCompleteness >= 80
                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                    : data.stats.profileCompleteness >= 50
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                      : 'bg-gradient-to-r from-brand-mint to-teal-500'
                }`}
                style={{ width: `${data.stats.profileCompleteness}%` }}
              />
            </div>
            {data.stats.profileCompleteness < 100 && (
              <p className={`text-xs mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {getCompletenessHint(data)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* QUICK STATS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard
          icon={<FileText className="w-5 h-5" />}
          label="Resumes"
          value={data.stats.totalResumes}
          subValue={data.stats.verifiedResumes > 0 ? `${data.stats.verifiedResumes} verified` : undefined}
          theme={theme}
          color="blue"
        />
        <QuickStatCard
          icon={<ClipboardList className="w-5 h-5" />}
          label="DOT Apps"
          value={data.stats.completedDotApps}
          subValue={data.stats.verifiedDotApps > 0 ? `${data.stats.verifiedDotApps} verified` : undefined}
          theme={theme}
          color="purple"
        />
        <QuickStatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Applications"
          value={data.stats.totalJobApplications}
          subValue={data.stats.interviewingApplications > 0 
            ? `${data.stats.interviewingApplications} interviewing` 
            : data.stats.viewedApplications > 0 
              ? `${data.stats.viewedApplications} viewed`
              : undefined}
          theme={theme}
          color="green"
        />
        <QuickStatCard
          icon={<Car className="w-5 h-5" />}
          label="MVR Records"
          value={data.stats.totalMvrRecords}
          subValue={data.stats.validMvrRecords > 0 ? `${data.stats.validMvrRecords} valid` : undefined}
          theme={theme}
          color="orange"
        />
      </div>

      {/* ============================================================ */}
      {/* VEREE CARD - QR SHARE SECTION */}
      {/* ============================================================ */}
      <div className="mb-6">
        <ShareProfileCard 
          walletAddress={userAddress} 
          driverName={data.profile?.first_name && data.profile?.last_name 
            ? `${data.profile.first_name} ${data.profile.last_name}` 
            : undefined
          } 
        />
      </div>

      {/* ============================================================ */}
      {/* MAIN SECTIONS GRID */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RESUMES SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={sectionHeaderClass}>
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
              }`}>
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              Resumes
              {data.resumes.length > 0 && (
                <span className={`text-sm font-normal ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  ({data.resumes.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => onNavigate('resume')}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-brand-mint/20 text-brand-mint'
                  : 'hover:bg-brand-sage/10 text-brand-sage'
              }`}
              title="Add Resume"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {data.resumes.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="No resumes yet"
              description="Upload or build your professional resume to get started"
              actionLabel="Add Resume"
              onAction={() => onNavigate('resume')}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.resumes.slice(0, 3).map((resume) => {
                // Check if resume has real IPFS hash or just a placeholder
                const hasRealIpfs = resume.ipfsHash && !resume.ipfsHash.startsWith('built_')
                // Show DRAFT status for built resumes not yet on IPFS
                const displayStatus = !hasRealIpfs && resume.resumeType === 'built' 
                  ? 'DRAFT' 
                  : resume.verificationStatus
                
                return (
                  <ItemRow
                    key={resume.id}
                    title={resume.title || resume.filename}
                    subtitle={formatDate(resume.createdAt)}
                    status={displayStatus}
                    badge={resume.resumeType === 'built' ? 'Built' : undefined}
                    onClick={() => setSelectedResume(resume)}
                    theme={theme}
                  />
                )
              })}
              {data.resumes.length > 3 && (
                <button
                  onClick={() => onNavigate('resume')}
                  className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'text-brand-mint hover:bg-brand-mint/10'
                      : 'text-brand-sage hover:bg-brand-sage/10'
                  }`}
                >
                  View all {data.resumes.length} resumes
                </button>
              )}
            </div>
          )}
        </section>

        {/* DOT APPLICATIONS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={sectionHeaderClass}>
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <ClipboardList className="w-5 h-5 text-purple-500" />
              </div>
              DOT Applications
              {data.dotApplications.length > 0 && (
                <span className={`text-sm font-normal ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  ({data.dotApplications.length})
                </span>
              )}
            </h2>
            <button
              onClick={onStartDotApp || (() => onNavigate('dotapp'))}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-brand-mint/20 text-brand-mint'
                  : 'hover:bg-brand-sage/10 text-brand-sage'
              }`}
              title="Start DOT Application"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {data.dotApplications.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8" />}
              title="No DOT applications"
              description="Complete a DOT application to verify your qualifications"
              actionLabel="Start DOT Application"
              onAction={onStartDotApp || (() => onNavigate('dotapp'))}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.dotApplications.slice(0, 3).map((app, index) => (
                <ItemRow
                  key={app.id}
                  title={`DOT Application ${data.dotApplications.length - index}`}
                  subtitle={formatDate(app.createdAt)}
                  status={app.isComplete ? app.verificationStatus : 'IN_PROGRESS'}
                  badge={!app.isComplete ? `Step ${app.currentStep}/3` : undefined}
                  onClick={() => setSelectedDotApp(app)}
                  theme={theme}
                />
              ))}
              {data.dotApplications.length > 3 && (
                <button
                  onClick={() => onNavigate('dotapp')}
                  className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'text-brand-mint hover:bg-brand-mint/10'
                      : 'text-brand-sage hover:bg-brand-sage/10'
                  }`}
                >
                  View all {data.dotApplications.length} applications
                </button>
              )}
            </div>
          )}
        </section>

        {/* MVR RECORDS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={sectionHeaderClass}>
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <Car className="w-5 h-5 text-orange-500" />
              </div>
              MVR Records
              {data.mvrRecords.length > 0 && (
                <span className={`text-sm font-normal ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  ({data.mvrRecords.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => onNavigate('mvr')}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-brand-mint/20 text-brand-mint'
                  : 'hover:bg-brand-sage/10 text-brand-sage'
              }`}
              title="Order MVR"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {data.mvrRecords.length === 0 ? (
            <EmptyState
              icon={<Car className="w-8 h-8" />}
              title="No MVR records"
              description="Order your Motor Vehicle Record to verify your driving history"
              actionLabel="Order MVR"
              onAction={() => onNavigate('mvr')}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.mvrRecords.slice(0, 3).map((mvr) => (
                <ItemRow
                  key={mvr.id}
                  title={`${mvr.licenseState} MVR`}
                  subtitle={formatDate(mvr.createdAt)}
                  status={getMvrStatus(mvr)}
                  badge={mvr.hasResult && mvr.totalPoints !== null ? `${mvr.totalPoints} pts` : undefined}
                  onClick={() => onViewMvr?.(mvr.id)}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>

        {/* JOB APPLICATIONS SECTION */}
        <section className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={sectionHeaderClass}>
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
              }`}>
                <Briefcase className="w-5 h-5 text-green-500" />
              </div>
              Job Applications
              {data.jobApplications.length > 0 && (
                <span className={`text-sm font-normal ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  ({data.jobApplications.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => onNavigate('jobs')}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-brand-mint/20 text-brand-mint'
                  : 'hover:bg-brand-sage/10 text-brand-sage'
              }`}
              title="Browse Jobs"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {data.jobApplications.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-8 h-8" />}
              title="No job applications"
              description="Browse jobs and apply with your verified profile"
              actionLabel="Browse Jobs"
              onAction={() => onNavigate('jobs')}
              theme={theme}
            />
          ) : (
            <div className="space-y-3">
              {data.jobApplications.slice(0, 3).map((app) => (
                <ItemRow
                  key={app.id}
                  title={app.jobTitle}
                  subtitle={`${app.companyName} • ${formatDate(app.appliedAt)}`}
                  status={app.status.toUpperCase()}
                  badge={app.viewCount > 0 ? `${app.viewCount} views` : undefined}
                  onClick={() => onNavigate('applications')}
                  theme={theme}
                />
              ))}
              {data.jobApplications.length > 3 && (
                <button
                  onClick={() => onNavigate('applications')}
                  className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'text-brand-mint hover:bg-brand-mint/10'
                      : 'text-brand-sage hover:bg-brand-sage/10'
                  }`}
                >
                  View all {data.jobApplications.length} applications
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
          className="w-full flex items-center justify-between"
        >
          <h2 className={sectionHeaderClass}>
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-gray-500/20' : 'bg-gray-100'
            }`}>
              <CreditCard className="w-5 h-5 text-gray-500" />
            </div>
            Transaction History
            {data.transactions.length > 0 && (
              <span className={`text-sm font-normal ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                ({data.transactions.length} transactions)
              </span>
            )}
          </h2>
          <ChevronRight className={`w-5 h-5 transition-transform ${
            showPaymentHistory ? 'rotate-90' : ''
          } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>

        {showPaymentHistory && (
          <div className="mt-4 space-y-3">
            {data.transactions.length === 0 ? (
              <p className={`text-sm text-center py-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                No transactions yet
              </p>
            ) : (
              data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-brand-sage/20' : 'bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {tx.description}
                    </p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    {tx.amount !== null ? (
                      <p className={`font-bold ${
                        theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                      }`}>
                        {tx.currency === 'USD' ? '$' : ''}{tx.amount.toFixed(2)} {tx.currency !== 'USD' ? tx.currency : ''}
                      </p>
                    ) : (
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        —
                      </p>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      tx.status === 'COMPLETED' 
                        ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                        : theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    }`}>
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
      
      {/* Resume Detail Modal */}
      {selectedResume && (
        <DetailModal
          title={selectedResume.title || selectedResume.filename}
          onClose={() => setSelectedResume(null)}
          theme={theme}
        >
          <ResumeDetailContent 
            resume={selectedResume} 
            theme={theme}
            onDelete={() => setDeletingResume(selectedResume)}
          />
        </DetailModal>
      )}


      {/* Delete Confirmation Modal */}
      {deletingResume && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 ${
            theme === 'dark' ? 'bg-brand-sage-dark' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Delete Resume?
            </h3>
            <p className={`text-sm mb-6 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Are you sure you want to delete "{deletingResume.title || deletingResume.filename}"? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingResume(null)}
                disabled={deleteLoading}
                className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResume(deletingResume)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 rounded-xl font-medium text-sm bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOT Application Detail Modal */}
      {selectedDotApp && (
        <DetailModal
          title={`DOT Application`}
          onClose={() => setSelectedDotApp(null)}
          theme={theme}
        >
          <DotAppDetailContent dotApp={selectedDotApp} theme={theme} />
        </DetailModal>
      )}
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
  color 
}: {
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  theme: string
  color: 'blue' | 'purple' | 'green' | 'orange'
}) {
  const colorClasses = {
    blue: theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600',
    purple: theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600',
    green: theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600',
    orange: theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600',
  }

  return (
    <div className={`rounded-xl p-4 ${
      theme === 'dark'
        ? 'bg-brand-sage-light/20 border border-brand-mint/20'
        : 'bg-white border border-gray-200 shadow-sm'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {value}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {label}
          </p>
        </div>
      </div>
      {subValue && (
        <p className={`text-xs mt-2 ${
          theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
        }`}>
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
    <div className={`text-center py-8 px-4 rounded-xl border-2 border-dashed ${
      theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'
    }`}>
      <div className={`inline-flex p-3 rounded-xl mb-3 ${
        theme === 'dark' ? 'bg-brand-mint/10 text-brand-mint' : 'bg-brand-sage/10 text-brand-sage'
      }`}>
        {icon}
      </div>
      <h3 className={`font-semibold mb-1 ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        {title}
      </h3>
      <p className={`text-sm mb-4 ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {description}
      </p>
      <button
        onClick={onAction}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
          theme === 'dark'
            ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
            : 'bg-brand-sage text-white hover:bg-brand-sage/90'
        }`}
      >
        <Plus className="w-4 h-4" />
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
  theme,
}: {
  title: string
  subtitle: string
  status: string
  badge?: string
  onClick?: () => void
  theme: string
}) {
  const statusConfig = getStatusConfig(status)

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
        theme === 'dark'
          ? 'bg-brand-sage/20 hover:bg-brand-sage/30'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </p>
          {badge && (
            <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
              theme === 'dark'
                ? 'bg-brand-mint/20 text-brand-mint'
                : 'bg-brand-sage/10 text-brand-sage'
            }`}>
              {badge}
            </span>
          )}
        </div>
        <p className={`text-xs truncate ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <span className={`px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${statusConfig.className}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
        <ChevronRight className={`w-4 h-4 ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`} />
      </div>
    </button>
  )
}

function DetailModal({
  title,
  onClose,
  theme,
  children,
}: {
  title: string
  onClose: () => void
  theme: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${
        theme === 'dark'
          ? 'bg-brand-sage-dark border border-brand-mint/20'
          : 'bg-white border border-gray-200'
      }`}>
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'bg-brand-sage-dark border-brand-mint/20' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-brand-sage/50 text-gray-400' : 'hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function ResumeDetailContent({ 
  resume, 
  theme,
  onDelete,
}: { 
  resume: HubResume
  theme: string
  onDelete?: () => void
}) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

  // Generate a clean filename for download
  const downloadFilename = `${(resume.title || resume.filename || 'Resume').replace(/[^a-z0-9]/gi, '_')}.pdf`
  
  // Check if this is a real IPFS hash or a placeholder (built resumes start with "built_")
  const hasRealIpfsHash = resume.ipfsHash && !resume.ipfsHash.startsWith('built_')

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>Type</p>
        <p className={valueClass}>{resume.resumeType === 'built' ? 'Built with Resume Builder' : 'Uploaded'}</p>
      </div>
      <div>
        <p className={labelClass}>Created</p>
        <p className={valueClass}>{formatDate(resume.createdAt)}</p>
      </div>
      <div>
        <p className={labelClass}>Status</p>
        <StatusBadge status={resume.verificationStatus} theme={theme} />
      </div>
      {hasRealIpfsHash && (
        <div>
          <p className={labelClass}>IPFS Hash</p>
          <p className={`${valueClass} font-mono text-xs break-all`}>{resume.ipfsHash}</p>
        </div>
      )}
      {resume.blockchainTxHash && (
        <div>
          <p className={labelClass}>Blockchain Transaction</p>
          <a
            href={`https://sepolia.basescan.org/tx/${resume.blockchainTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            View on BaseScan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="pt-4 space-y-3">
        {/* View & Download Buttons - Only show if has real IPFS hash */}
        {hasRealIpfsHash ? (
          <div className="flex gap-2">
            {/* View in new tab */}
            <a
              href={`https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                theme === 'dark'
                  ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/40 hover:bg-brand-mint/30'
                  : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
              }`}
            >
              <Eye className="w-4 h-4" />
              View
            </a>
            {/* Download with correct filename */}
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`)
                  const blob = await response.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = downloadFilename
                  a.click()
                  URL.revokeObjectURL(url)
                } catch (err) {
                  console.error('Download failed:', err)
                  // Fallback: open in new tab
                  window.open(`https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`, '_blank')
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30'
                  : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Download
            </button>
          </div>
        ) : (
          <div className={`w-full text-center px-4 py-3 rounded-xl text-sm ${
            theme === 'dark' ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-600/30' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}>
            <p className="font-medium">Resume not yet on IPFS</p>
            <p className="text-xs mt-1 opacity-80">
              Go to Resume Management and click "Verify" to upload to IPFS and blockchain
            </p>
          </div>
        )}
        
        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Resume
          </button>
        )}
      </div>
    </div>
  )
}

function DotAppDetailContent({ dotApp, theme }: { dotApp: HubDotApplication; theme: string }) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>Submitted</p>
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
          <p className={valueClass}>Step {dotApp.currentStep} of 3</p>
          <div className={`mt-2 h-2 rounded-full overflow-hidden ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div
              className="h-full bg-brand-mint rounded-full"
              style={{ width: `${(dotApp.currentStep / 3) * 100}%` }}
            />
          </div>
        </div>
      )}
      {dotApp.blockchainApplicationId && (
        <div>
          <p className={labelClass}>Application ID</p>
          <p className={`${valueClass} font-mono`}>{dotApp.blockchainApplicationId}</p>
        </div>
      )}
      {dotApp.blockchainTxHash && (
        <div>
          <p className={labelClass}>Blockchain Transaction</p>
          <a
            href={`https://sepolia.basescan.org/tx/${dotApp.blockchainTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            View on BaseScan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
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
    'resume_verification': 'Resume Verification',
    'dot_application': 'DOT Application',
    'mvr_order': 'MVR Order',
    'mvr': 'MVR Order',
  }
  return types[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusConfig(status: string): { label: string; icon: React.ReactNode; className: string } {
  const normalized = status.toUpperCase()
  
  switch (normalized) {
    case 'VERIFIED':
      return {
        label: 'Verified',
        icon: <CheckCircle className="w-3 h-3" />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      }
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        icon: <TrendingUp className="w-3 h-3" />,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      }
    case 'SUBMITTED':
      return {
        label: 'Submitted',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      }
    case 'VIEWED':
      return {
        label: 'Viewed',
        icon: <Eye className="w-3 h-3" />,
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      }
    case 'INTERVIEWING':
    case 'INTERVIEW':
      return {
        label: 'Interviewing',
        icon: <Briefcase className="w-3 h-3" />,
        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      }
    case 'HIRED':
      return {
        label: 'Hired',
        icon: <CheckCircle className="w-3 h-3" />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'REJECTED':
    case 'FAILED':
      return {
        label: normalized === 'REJECTED' ? 'Rejected' : 'Failed',
        icon: <AlertCircle className="w-3 h-3" />,
        className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      }
    case 'COMPLETED':
      return {
        label: 'Completed',
        icon: <CheckCircle className="w-3 h-3" />,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      }
    case 'DRAFT':
      return {
        label: 'Draft',
        icon: <FileText className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
    default:
      return {
        label: status,
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
  }
}

function getMvrStatus(mvr: HubMvrRecord): string {
  if (mvr.hasResult && mvr.licenseStatus) {
    return mvr.licenseStatus === 'Valid' ? 'VERIFIED' : mvr.licenseStatus.toUpperCase()
  }
  if (mvr.orderStatus === 'completed') return 'COMPLETED'
  if (mvr.orderStatus === 'pending' || mvr.orderStatus === 'processing') return 'PENDING'
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
