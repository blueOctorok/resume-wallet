'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import ShareProfileCard from './ShareProfileCard'
import DriverVerificationSection from './verification/DriverVerificationSection'
import DriverEmploymentVerificationSection from './verification/DriverEmploymentVerificationSection'
import ResumePreviewModal from './ResumePreviewModal'
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
  Edit,
  Coins,
  Sparkles,
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
  interviewingApplications: number
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
    page: 'resume' | 'dotapp' | 'mvr' | 'jobs' | 'applications' | 'veree',
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
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [resumeActionMessage, setResumeActionMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [dotAppActionMessage, setDotAppActionMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

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

  // Handle download PDF for built resumes using styled generator
  const handleDownloadPdf = async (resume: HubResume) => {
    // If already verified with IPFS hash, download from IPFS
    const hasRealIpfsHash =
      resume.ipfsHash && !resume.ipfsHash.startsWith('built_')

    if (hasRealIpfsHash) {
      try {
        const response = await fetch(
          `https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`,
        )
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(resume.title || resume.filename || 'Resume').replace(/[^a-z0-9]/gi, '_')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Download failed:', err)
        window.open(
          `https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`,
          '_blank',
        )
      }
      return
    }

    // For built resumes without IPFS, generate styled PDF from structured data
    if (resume.resumeType !== 'built') {
      setResumeActionMessage({
        type: 'error',
        text: 'Cannot download unverified uploaded resume',
      })
      return
    }

    setDownloadingPdf(true)
    try {
      // Fetch the resume's structured data
      const response = await fetch(`/api/resumes/${resume.id}`, {
        headers: {
          'x-wallet-address': userAddress || '',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch resume data')
      }

      const data = await response.json()
      // API returns resume directly, not wrapped in a 'resume' property
      const structuredData = data.structured_data

      if (!structuredData) {
        console.error('Resume data received:', data)
        throw new Error('No structured data found in resume')
      }

      // Dynamically import the styled PDF generator
      const { generateStyledResumePDF } = await import(
        '@/lib/resume-pdf-generator'
      )

      // Detect format and map data
      const isResumeBuilderFormat =
        Array.isArray(structuredData.employments) &&
        structuredData.employments.length > 0 &&
        'companyName' in (structuredData.employments[0] || {})

      const hasResumeBuilderSkillsFormat =
        Array.isArray(structuredData.skills) &&
        structuredData.skills.length > 0 &&
        'name' in (structuredData.skills[0] || {})

      let resumeData

      if (isResumeBuilderFormat) {
        resumeData = {
          personalInfo: {
            firstName: structuredData.personalInfo?.firstName,
            lastName: structuredData.personalInfo?.lastName,
            email: structuredData.personalInfo?.email,
            phone: structuredData.personalInfo?.phone,
            address: structuredData.personalInfo?.address,
            city: structuredData.personalInfo?.city,
            state: structuredData.personalInfo?.state,
            zipCode: structuredData.personalInfo?.zipCode,
            professionalSummary:
              structuredData.personalInfo?.professionalSummary,
          },
          cdlInfo: {
            cdlClass: structuredData.cdlInfo?.cdlClass,
            cdlState: structuredData.cdlInfo?.cdlState,
            cdlExpiration: structuredData.cdlInfo?.expirationDate,
            endorsements: structuredData.cdlInfo?.endorsements || [],
          },
          employments: (structuredData.employments || []).map(
            (emp: Record<string, unknown>) => ({
              companyName: emp.companyName,
              position: emp.position,
              location: emp.location,
              startDate: emp.startDate,
              endDate: emp.endDate,
              isCurrent: emp.isCurrent,
              responsibilities: emp.responsibilities || [],
            }),
          ),
          educations: (structuredData.educations || []).map(
            (edu: Record<string, unknown>) => ({
              school: edu.school,
              degree: edu.degree,
              field: edu.field,
              year: edu.year,
              certifications: edu.certifications || [],
            }),
          ),
          skills: hasResumeBuilderSkillsFormat
            ? (structuredData.skills || []).map(
                (skill: Record<string, unknown>) => ({
                  name: skill.name,
                  category: skill.category || 'other',
                }),
              )
            : [],
          references: (structuredData.references || []).map(
            (ref: Record<string, unknown>) => ({
              name: ref.name,
              title: ref.title,
              company: ref.company,
              phone: ref.phone,
              email: ref.email,
            }),
          ),
        }
      } else {
        // Old format mapping
        resumeData = {
          personalInfo: {
            firstName: structuredData.personalInfo?.firstName,
            lastName: structuredData.personalInfo?.lastName,
            email: structuredData.personalInfo?.email,
            phone: structuredData.personalInfo?.phone,
            address: structuredData.personalInfo?.address,
            city: structuredData.personalInfo?.city,
            state: structuredData.personalInfo?.state,
            zipCode: structuredData.personalInfo?.zipCode,
            professionalSummary: structuredData.personalInfo?.summary,
          },
          cdlInfo: {
            cdlClass: structuredData.cdlInfo?.cdlClass,
            cdlState: structuredData.cdlInfo?.cdlState,
            cdlExpiration: structuredData.cdlInfo?.cdlExpiration,
            endorsements: structuredData.cdlInfo?.endorsements || [],
          },
          employments: (structuredData.employments || []).map(
            (emp: Record<string, unknown>) => ({
              companyName: emp.company,
              position: emp.position,
              location: undefined,
              startDate: emp.startDate,
              endDate: emp.endDate,
              isCurrent: emp.current,
              responsibilities: emp.description ? [emp.description] : [],
            }),
          ),
          educations: (structuredData.educations || []).map(
            (edu: Record<string, unknown>) => ({
              school: edu.school,
              degree: edu.degree,
              field: edu.field,
              year: edu.graduationDate,
              certifications: [],
            }),
          ),
          skills: (structuredData.skills || []).flatMap(
            (skillGroup: Record<string, unknown>) =>
              ((skillGroup.items as string[]) || []).map((item) => ({
                name: item,
                category: skillGroup.category || 'other',
              })),
          ),
          references: (structuredData.references || []).map(
            (ref: Record<string, unknown>) => ({
              name: ref.name,
              title: ref.relationship,
              company: ref.company,
              phone: ref.phone,
              email: ref.email,
            }),
          ),
        }
      }

      // Generate styled PDF
      const pdfBuffer = generateStyledResumePDF(resumeData)

      // Create blob and trigger download
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fullName =
        `${resumeData.personalInfo.firstName || ''} ${resumeData.personalInfo.lastName || ''}`.trim()
      a.download = `${fullName.replace(/\s+/g, '_') || 'Resume'}_Resume.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResumeActionMessage({ type: 'success', text: 'PDF downloaded!' })
      setTimeout(() => setResumeActionMessage(null), 3000)
    } catch (err: unknown) {
      console.error('PDF generation error:', err)
      setResumeActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate PDF',
      })
    } finally {
      setDownloadingPdf(false)
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
    } catch (err) {
      console.error('Error fetching hub data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  const handleDiscardInProgressDotApp = useCallback(async () => {
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
      await fetchHubData()
    } catch (err) {
      console.error('Discard in-progress error:', err)
      alert(
        err instanceof Error ? err.message : 'Failed to discard application',
      )
    } finally {
      setDeletingInProgressDotApp(false)
    }
  }, [onDeleteInProgressDotApp, fetchHubData])

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
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <Loader2
            className={`w-12 h-12 animate-spin mx-auto mb-4 ${
              theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
            }`}
          />
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
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
            theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
          }`}
        >
          <AlertCircle className='w-12 h-12 text-red-500 mx-auto mb-4' />
          <p className='text-red-500 font-medium'>{error}</p>
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
      interviewingApplications: 0,
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
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-brand-mint to-teal-600 shadow-lg shadow-brand-mint/30'
                  : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark shadow-lg shadow-brand-sage/30'
              }`}
            >
              <User className='w-8 h-8 text-white' />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {displayName}'s Driver Hub
              </h1>
              {cdlSummary && (
                <p
                  className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  {cdlSummary}
                </p>
              )}
              {!cdlSummary && (
                <p
                  className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
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
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
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
                      : theme === 'dark'
                        ? 'text-gray-400'
                        : 'text-gray-500'
                }`}
              >
                {data.stats.profileCompleteness}%
              </span>
            </div>
            <div
              className={`h-3 rounded-full overflow-hidden ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
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
              <p
                className={`text-xs mt-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {getCompletenessHint(data)}
              </p>
            )}
          </div>
        </div>
      </div>

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
            data.stats.interviewingApplications > 0
              ? `${data.stats.interviewingApplications} interviewing`
              : data.stats.viewedApplications > 0
                ? `${data.stats.viewedApplications} viewed`
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
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-brand-mint/30 to-brand-sage-light/20 border border-brand-mint/30'
                  : 'bg-gradient-to-br from-brand-sage/20 to-brand-sage/10 border border-brand-sage/30'
              }`}
            >
              <Coins
                className={`w-7 h-7 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            </div>
            <div>
              <h2
                className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                StormChain Tokens
              </h2>
              <div className='flex items-center gap-2 mt-1'>
                <span
                  className={`text-3xl font-bold ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                >
                  0
                </span>
                <span
                  className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
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
                theme === 'dark'
                  ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/30'
                  : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/20'
              }`}
            >
              <Sparkles className='w-3 h-3' />
              Coming Soon
            </div>

            {/* Learn More Button */}
            <button
              onClick={() => onNavigate('veree')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'text-brand-mint hover:text-brand-mint/80'
                  : 'text-brand-sage hover:text-brand-sage/80'
              }`}
            >
              Learn about STORM →
            </button>
          </div>
        </div>

        {/* Teaser info */}
        <p
          className={`mt-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
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
          driverName={
            profileName || (data.displayNameFallback ?? '') || undefined
          }
        />
      </div>

      {/* ============================================================ */}
      {/* EMPLOYMENT VERIFICATION - Driver only (DOT / resume data) */}
      {/* ============================================================ */}
      <div className='mb-6'>
        <DriverEmploymentVerificationSection userAddress={userAddress} />
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
                  theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}
              >
                <FileText className='w-5 h-5 text-blue-500' />
              </div>
              Resumes
              {data.resumes.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
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
              title='Add Resume'
            >
              <Plus className='w-5 h-5' />
            </button>
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
                // Show DRAFT status for built resumes not yet on IPFS
                const displayStatus =
                  !hasRealIpfs && resume.resumeType === 'built'
                    ? 'DRAFT'
                    : resume.verificationStatus

                return (
                  <ItemRow
                    key={resume.id}
                    title={resume.title || resume.filename}
                    subtitle={formatDate(resume.createdAt)}
                    status={displayStatus}
                    badge={resume.resumeType === 'built' ? 'Built' : undefined}
                    onClick={() => handleSelectResume(resume)}
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
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}
              >
                <ClipboardList className='w-5 h-5 text-purple-500' />
              </div>
              DOT Applications
              {data.dotApplications.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
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
              title='Start DOT Application'
            >
              <Plus className='w-5 h-5' />
            </button>
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

                // For in-progress apps, clicking should continue the application
                const handleClick = () => {
                  if (app.isInProgress) {
                    onNavigate('dotapp') // Continue the in-progress application
                  } else {
                    setSelectedDotApp(app) // View completed/submitted app details
                  }
                }

                return (
                  <ItemRow
                    key={app.id}
                    title={appTitle}
                    subtitle={
                      app.isInProgress
                        ? 'Continue where you left off'
                        : formatDate(app.createdAt)
                    }
                    status={
                      app.isComplete ? app.verificationStatus : 'IN_PROGRESS'
                    }
                    badge={
                      !app.isComplete
                        ? `Form ${app.currentStep} of 3`
                        : undefined
                    }
                    onClick={handleClick}
                    onDelete={
                      app.isInProgress && onDeleteInProgressDotApp
                        ? handleDiscardInProgressDotApp
                        : undefined
                    }
                    deleteDisabled={deletingInProgressDotApp}
                    theme={theme}
                  />
                )
              })}
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
          <div className='flex items-center justify-between mb-4'>
            <h2 className={sectionHeaderClass}>
              <div
                className={`p-2 rounded-lg ${
                  theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
                }`}
              >
                <Car className='w-5 h-5 text-orange-500' />
              </div>
              MVR Records
              {data.mvrRecords.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
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
              title='Order MVR'
            >
              <Plus className='w-5 h-5' />
            </button>
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
                  theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                }`}
              >
                <Briefcase className='w-5 h-5 text-green-500' />
              </div>
              Job Applications
              {data.jobApplications.length > 0 && (
                <span
                  className={`text-sm font-normal ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
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
              title='Browse Jobs'
            >
              <Plus className='w-5 h-5' />
            </button>
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
          className='w-full flex items-center justify-between'
        >
          <h2 className={sectionHeaderClass}>
            <div
              className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-gray-500/20' : 'bg-gray-100'
              }`}
            >
              <CreditCard className='w-5 h-5 text-gray-500' />
            </div>
            Transaction History
            {data.transactions.length > 0 && (
              <span
                className={`text-sm font-normal ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                ({data.transactions.length} transactions)
              </span>
            )}
          </h2>
          <ChevronRight
            className={`w-5 h-5 transition-transform ${
              showPaymentHistory ? 'rotate-90' : ''
            } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
          />
        </button>

        {showPaymentHistory && (
          <div className='mt-4 space-y-3'>
            {data.transactions.length === 0 ? (
              <p
                className={`text-sm text-center py-4 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
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
                    <p
                      className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {tx.description}
                    </p>
                    <p
                      className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className='text-right'>
                    {tx.amount !== null ? (
                      <p
                        className={`font-bold ${
                          theme === 'dark'
                            ? 'text-brand-mint'
                            : 'text-brand-sage'
                        }`}
                      >
                        {tx.currency === 'USD' ? '$' : ''}
                        {tx.amount.toFixed(2)}{' '}
                        {tx.currency !== 'USD' ? tx.currency : ''}
                      </p>
                    ) : (
                      <p
                        className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        —
                      </p>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        tx.status === 'COMPLETED'
                          ? theme === 'dark'
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-green-100 text-green-700'
                          : theme === 'dark'
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
          onDownload={() => handleDownloadPdf(selectedResume)}
          isDownloading={downloadingPdf || loadingResumeData}
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
        <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div
            className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 ${
              theme === 'dark' ? 'bg-brand-sage-dark' : 'bg-white'
            }`}
          >
            <h3
              className={`text-lg font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Delete Resume?
            </h3>
            <p
              className={`text-sm mb-6 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
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
        </div>
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
      theme === 'dark'
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-blue-100 text-blue-600',
    purple:
      theme === 'dark'
        ? 'bg-purple-500/20 text-purple-400'
        : 'bg-purple-100 text-purple-600',
    green:
      theme === 'dark'
        ? 'bg-green-500/20 text-green-400'
        : 'bg-green-100 text-green-600',
    orange:
      theme === 'dark'
        ? 'bg-orange-500/20 text-orange-400'
        : 'bg-orange-100 text-orange-600',
  }

  return (
    <div
      className={`rounded-xl p-4 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 border border-brand-mint/20'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}
    >
      <div className='flex items-center gap-3'>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p
            className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {value}
          </p>
          <p
            className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
        </div>
      </div>
      {subValue && (
        <p
          className={`text-xs mt-2 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
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
        theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'
      }`}
    >
      <div
        className={`inline-flex p-3 rounded-xl mb-3 ${
          theme === 'dark'
            ? 'bg-brand-mint/10 text-brand-mint'
            : 'bg-brand-sage/10 text-brand-sage'
        }`}
      >
        {icon}
      </div>
      <h3
        className={`font-semibold mb-1 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-sm mb-4 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
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
    theme === 'dark'
      ? 'bg-brand-sage/20 hover:bg-brand-sage/30'
      : 'bg-gray-50 hover:bg-gray-100'
  }`

  const left = (
    <div className='flex-1 text-left min-w-0'>
      <div className='flex items-center gap-2'>
        <p
          className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          {title}
        </p>
        {badge && (
          <span
            className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
              theme === 'dark'
                ? 'bg-brand-mint/20 text-brand-mint'
                : 'bg-brand-sage/10 text-brand-sage'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p
        className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
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
        className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
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
              theme === 'dark'
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
  theme,
  children,
}: {
  title: string
  onClose: () => void
  theme: string
  children: React.ReactNode
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <div
        className={`relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${
          theme === 'dark'
            ? 'bg-brand-sage-dark border border-brand-mint/20'
            : 'bg-white border border-gray-200'
        }`}
      >
        <div
          className={`sticky top-0 flex items-center justify-between p-4 border-b ${
            theme === 'dark'
              ? 'bg-brand-sage-dark border-brand-mint/20'
              : 'bg-white border-gray-200'
          }`}
        >
          <h3
            className={`text-lg font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-brand-sage/50 text-gray-400'
                : 'hover:bg-gray-100'
            }`}
          >
            <X className='w-5 h-5' />
          </button>
        </div>
        <div className='p-4'>{children}</div>
      </div>
    </div>
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
    page: 'resume' | 'dotapp' | 'mvr' | 'jobs' | 'applications' | 'veree',
  ) => void
  onStartEmploymentVerification?: () => void
  onVerify?: () => void
  isVerifying?: boolean
  actionMessage?: { type: 'success' | 'error'; text: string } | null
  onDelete?: () => void
  isDeleting?: boolean
}) {
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`
  const valueClass = `text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`

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
              ? theme === 'dark'
                ? 'bg-green-900/30 border border-green-500/30 text-green-400'
                : 'bg-green-50 border border-green-200 text-green-800'
              : theme === 'dark'
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
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <div
              className='h-full bg-brand-mint rounded-full'
              style={{ width: `${(dotApp.currentStep / 3) * 100}%` }}
            />
          </div>
          {/* Continue button for in-progress applications */}
          {dotApp.isInProgress && (
            <button
              onClick={() => onNavigate('dotapp')}
              className={`mt-4 w-full py-3 rounded-lg font-semibold transition-all ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                  : 'bg-brand-sage text-white hover:bg-brand-sage/90'
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
            theme === 'dark'
              ? 'bg-yellow-900/20 border-yellow-500/30'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <p
            className={`text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
            }`}
          >
            Ready to Verify
          </p>
          <p
            className={`text-xs mb-3 ${
              theme === 'dark' ? 'text-yellow-400/70' : 'text-yellow-700'
            }`}
          >
            Submit your application to the blockchain to make it permanent and
            tamper-proof.
          </p>
          <button
            onClick={onVerify}
            disabled={isVerifying}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 ${
              theme === 'dark'
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
            theme === 'dark'
              ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/30 hover:bg-brand-mint/30'
              : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
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
            theme === 'dark'
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
