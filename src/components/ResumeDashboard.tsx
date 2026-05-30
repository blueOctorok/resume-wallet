'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import Modal from './ui/Modal'
import { 
  Trash2, 
  Download, 
  Copy, 
  Shield, 
  Edit3,
  ExternalLink,
  AlertTriangle,
  X,
  Loader2
} from 'lucide-react'

interface ResumeRecord {
  id: string
  title: string
  filename: string
  ipfs_hash: string
  ipfs_url?: string
  verification_status?: string
  blockchain_tx_hash?: string
  blockchain_resume_id?: string
  created_at?: string
  is_public?: boolean
  is_paid?: boolean
  file_size?: number
  mime_type?: string
  resume_type?: 'uploaded' | 'built' | 'developer_built'
  structured_data?: Record<string, unknown>
}

interface ResumeDashboardProps {
  user?: {
    address?: string
  } | null
  onResumesLoaded?: (count: number, latestResume?: ResumeRecord) => void
  onEditResume?: (resumeId: string) => void
  onDuplicateResume?: (resumeId: string, structuredData: Record<string, unknown>) => void
  onVerifyResume?: (resumeId: string) => void
}

// Updated labels: "Pending" -> "Not Verified" for clearer UX
const STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Not Verified',
  FAILED: 'Failed',
}

const STATUS_STYLES: Record<string, string> = {
  VERIFIED:
    'bg-green-500/10 text-green-600 dark:text-green-300 border border-green-500/40',
  PENDING:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/40',
  FAILED:
    'bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/40',
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function ResumeDashboard({
  user,
  onResumesLoaded,
  onEditResume,
  onDuplicateResume,
  onVerifyResume,
}: ResumeDashboardProps) {
  const { theme } = useTheme()
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const [resumes, setResumes] = useState<ResumeRecord[]>([])
  const [selectedResume, setSelectedResume] = useState<ResumeRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'FAILED'>('ALL')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Modal and action states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [resumeToDelete, setResumeToDelete] = useState<ResumeRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchResumes = useCallback(async (address: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/resumes', {
        headers: {
          'x-wallet-address': address,
        },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load resumes')
      }

      const data = ((await response.json()) as ResumeRecord[]) ?? []
      setResumes(data)
      const latestResume = data.length > 0 ? data[0] : undefined
      onResumesLoaded?.(data.length, latestResume)
      if (data?.length) {
        setSelectedResume((prev) => {
          if (!prev) return data[0]
          return data.find((resume) => resume.id === prev.id) ?? data[0]
        })
      } else {
        setSelectedResume(null)
      }
    } catch (fetchError) {
      console.error('❌ ResumeDashboard: Failed to fetch resumes', fetchError)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load resumes'
      )
    } finally {
      setIsLoading(false)
    }
  }, [onResumesLoaded])

  useEffect(() => {
    if (user?.address) {
      fetchResumes(user.address)
    } else {
      setResumes([])
      setSelectedResume(null)
      onResumesLoaded?.(0, undefined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.address])

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  const filteredResumes = useMemo(() => {
    return resumes.filter((resume) => {
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        resume.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resume.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resume.ipfs_hash?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' ||
        (resume.verification_status || 'PENDING') === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [resumes, searchTerm, statusFilter])

  const verifiedCount = useMemo(
    () =>
      resumes.filter(
        (resume) => (resume.verification_status || 'PENDING') === 'VERIFIED'
      ).length,
    [resumes]
  )

  // Handle delete resume
  const handleDeleteClick = (resume: ResumeRecord) => {
    setResumeToDelete(resume)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!resumeToDelete || !user?.address) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/resumes/${resumeToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete resume')
      }

      setActionMessage({ type: 'success', text: 'Resume deleted successfully' })
      setDeleteModalOpen(false)
      setResumeToDelete(null)
      
      // Refresh the list
      fetchResumes(user.address)
      const wa = walletAddress || user.address
      if (wa) void syncDriverHubFromApi(wa)
    } catch (err) {
      setActionMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to delete resume' 
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle download PDF for built resumes - uses shared styled PDF generator
  const handleDownloadPDF = async (resume: ResumeRecord) => {
    if (!resume.structured_data) return

    setIsDownloading(true)
    try {
      // Dynamically import the shared styled PDF generator
      const { generateStyledResumePDF } = await import('@/lib/resume-pdf-generator')
      
      const structuredData = resume.structured_data as Record<string, unknown>
      
      // Detect format: Resume Builder format has `employments` with `companyName`, 
      // old format (from uploaded resumes) has `employments` with `company`
      const isResumeBuilderFormat = Array.isArray(structuredData.employments) && 
        structuredData.employments.length > 0 && 
        'companyName' in (structuredData.employments[0] as Record<string, unknown>)
      
      // Detect if skills are in Resume Builder format (array of {name, category}) 
      // vs old format (array of {category, items[]})
      const hasResumeBuilderSkillsFormat = Array.isArray(structuredData.skills) &&
        structuredData.skills.length > 0 &&
        'name' in (structuredData.skills[0] as Record<string, unknown>)
      
      let resumeData
      
      if (isResumeBuilderFormat) {
        // Resume Builder format - data is already in the correct shape
        resumeData = {
          personalInfo: {
            firstName: (structuredData.personalInfo as Record<string, unknown>)?.firstName as string | undefined,
            lastName: (structuredData.personalInfo as Record<string, unknown>)?.lastName as string | undefined,
            email: (structuredData.personalInfo as Record<string, unknown>)?.email as string | undefined,
            phone: (structuredData.personalInfo as Record<string, unknown>)?.phone as string | undefined,
            address: (structuredData.personalInfo as Record<string, unknown>)?.address as string | undefined,
            city: (structuredData.personalInfo as Record<string, unknown>)?.city as string | undefined,
            state: (structuredData.personalInfo as Record<string, unknown>)?.state as string | undefined,
            zipCode: (structuredData.personalInfo as Record<string, unknown>)?.zipCode as string | undefined,
            professionalSummary: (structuredData.personalInfo as Record<string, unknown>)?.professionalSummary as string | undefined,
          },
          cdlInfo: {
            cdlClass: (structuredData.cdlInfo as Record<string, unknown>)?.cdlClass as string | undefined,
            cdlState: (structuredData.cdlInfo as Record<string, unknown>)?.cdlState as string | undefined,
            cdlExpiration: (structuredData.cdlInfo as Record<string, unknown>)?.expirationDate as string | undefined,
            endorsements: ((structuredData.cdlInfo as Record<string, unknown>)?.endorsements as string[]) || [],
          },
          employments: (structuredData.employments as Array<Record<string, unknown>> || []).map(emp => ({
            companyName: emp.companyName as string | undefined,
            position: emp.position as string | undefined,
            location: emp.location as string | undefined,
            startDate: emp.startDate as string | undefined,
            endDate: emp.endDate as string | undefined,
            isCurrent: emp.isCurrent as boolean | undefined,
            responsibilities: (emp.responsibilities as string[]) || [],
          })),
          educations: (structuredData.educations as Array<Record<string, unknown>> || []).map(edu => ({
            school: edu.school as string | undefined,
            degree: edu.degree as string | undefined,
            field: edu.field as string | undefined,
            year: edu.year as string | undefined,
            certifications: (edu.certifications as string[]) || [],
          })),
          skills: hasResumeBuilderSkillsFormat 
            ? (structuredData.skills as Array<Record<string, unknown>> || []).map(skill => ({
                name: skill.name as string | undefined,
                category: (skill.category || 'other') as 'equipment' | 'route' | 'technology' | 'safety' | 'other',
              }))
            : [], // Will be converted from old format below
          references: (structuredData.references as Array<Record<string, unknown>> || []).map(ref => ({
            name: ref.name as string | undefined,
            title: ref.title as string | undefined,
            company: ref.company as string | undefined,
            phone: ref.phone as string | undefined,
            email: ref.email as string | undefined,
          })),
        }
      } else {
        // Old format from uploaded/analyzed resumes - needs mapping
        const oldData = structuredData as {
          personalInfo?: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string; summary?: string }
          cdlInfo?: { cdlClass?: string; cdlState?: string; cdlExpiration?: string; endorsements?: string[] }
          employments?: Array<{ company?: string; position?: string; startDate?: string; endDate?: string; current?: boolean; description?: string }>
          educations?: Array<{ school?: string; degree?: string; field?: string; graduationDate?: string }>
          skills?: Array<{ category?: string; items?: string[] }>
          references?: Array<{ name?: string; relationship?: string; company?: string; phone?: string; email?: string }>
        }
        resumeData = {
          personalInfo: {
            firstName: oldData.personalInfo?.firstName,
            lastName: oldData.personalInfo?.lastName,
            email: oldData.personalInfo?.email,
            phone: oldData.personalInfo?.phone,
            address: oldData.personalInfo?.address,
            city: oldData.personalInfo?.city,
            state: oldData.personalInfo?.state,
            zipCode: oldData.personalInfo?.zipCode,
            professionalSummary: oldData.personalInfo?.summary,
          },
          cdlInfo: {
            cdlClass: oldData.cdlInfo?.cdlClass,
            cdlState: oldData.cdlInfo?.cdlState,
            cdlExpiration: oldData.cdlInfo?.cdlExpiration,
            endorsements: oldData.cdlInfo?.endorsements || [],
          },
          employments: (oldData.employments || []).map(emp => ({
            companyName: emp.company,
            position: emp.position,
            location: undefined,
            startDate: emp.startDate,
            endDate: emp.endDate,
            isCurrent: emp.current,
            responsibilities: emp.description ? [emp.description] : [],
          })),
          educations: (oldData.educations || []).map(edu => ({
            school: edu.school,
            degree: edu.degree,
            field: edu.field,
            year: edu.graduationDate,
            certifications: [],
          })),
          skills: (oldData.skills || []).flatMap(skillGroup => 
            (skillGroup.items || []).map(item => ({
              name: item,
              category: (skillGroup.category || 'other') as 'equipment' | 'route' | 'technology' | 'safety' | 'other',
            }))
          ),
          references: (oldData.references || []).map(ref => ({
            name: ref.name,
            title: ref.relationship,
            company: ref.company,
            phone: ref.phone,
            email: ref.email,
          })),
        }
      }
      
      // Generate styled PDF using the shared utility
      const pdfBuffer = generateStyledResumePDF(resumeData)
      
      // Create blob and trigger download
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fullName = `${resumeData.personalInfo.firstName || ''} ${resumeData.personalInfo.lastName || ''}`.trim()
      a.download = `${fullName.replace(/\s+/g, '_') || 'Resume'}_Resume.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setActionMessage({ type: 'success', text: 'PDF downloaded successfully' })
    } catch (err) {
      console.error('PDF generation error:', err)
      setActionMessage({ 
        type: 'error', 
        text: 'Failed to generate PDF' 
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // Handle duplicate
  const handleDuplicate = (resume: ResumeRecord) => {
    if (resume.structured_data && onDuplicateResume) {
      onDuplicateResume(resume.id, resume.structured_data)
    }
  }

  // One-click verify: built/developer PDF-from-structured, or uploaded PDF already on IPFS
  const handleVerify = async (resume: ResumeRecord) => {
    if (!user?.address) return

    const canOneClickVerify =
      (resume.resume_type === 'built' && resume.structured_data) ||
      (resume.resume_type === 'developer_built' && resume.structured_data) ||
      (resume.resume_type === 'uploaded' && isLiveResumeIpfsHash(resume.ipfs_hash ?? null))

    if (canOneClickVerify) {
      setIsVerifying(true)
      setActionMessage({
        type: 'success',
        text:
          resume.resume_type === 'uploaded'
            ? 'Recording your resume on-chain...'
            : 'Generating PDF and uploading to blockchain...',
      })

      try {
        const response = await fetch(`/api/resumes/${resume.id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Verification failed')
        }

        const tx = (data.transactionHash ?? data.txHash) as string | undefined
        setActionMessage({
          type: 'success',
          text: tx
            ? `Resume verified on blockchain! TX: ${tx.slice(0, 10)}...`
            : 'Resume verification updated.',
        })

        fetchResumes(user.address)
        const wa = walletAddress || user.address
        if (wa) void syncDriverHubFromApi(wa)
      } catch (err) {
        setActionMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to verify resume',
        })
      } finally {
        setIsVerifying(false)
      }
    } else if (onVerifyResume) {
      onVerifyResume(resume.id)
    }
  }

  if (!user?.address) {
    return (
      <div
        className={`max-w-4xl mx-auto p-6 rounded-2xl border ${
          isDarkTheme(theme)
            ? 'bg-teal-200/20 border-teal-500/30 text-brand-cream/80'
            : 'bg-white/80 border-teal-700/20 text-gray-700'
        }`}
      >
        <p className='text-center text-sm sm:text-base'>
          Sign in to manage and review your verified resumes.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Action Message Toast */}
      {actionMessage && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border ${
          actionMessage.type === 'success'
            ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-300'
            : 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-300'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && resumeToDelete && (
        <Modal onClose={() => { setDeleteModalOpen(false); setResumeToDelete(null) }} maxWidth="max-w-md">
          <div className='p-6'>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${
                isDarkTheme(theme) ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}>
                  Delete Resume
                </h3>
                <p className={`mt-2 text-sm ${
                  isDarkTheme(theme) ? 'text-brand-cream/70' : 'text-gray-600'
                }`}>
                  Are you sure you want to delete &quot;{resumeToDelete.title || resumeToDelete.filename}&quot;?
                </p>
                
                {/* Warning for verified resumes */}
                {resumeToDelete.verification_status === 'VERIFIED' && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    isDarkTheme(theme)
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <p className={`text-xs ${
                      isDarkTheme(theme) ? 'text-amber-300' : 'text-amber-700'
                    }`}>
                      <strong>Note:</strong> This resume is verified on the blockchain. 
                      Deleting will remove it from your dashboard, but the blockchain record is permanent and cannot be removed.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteModalOpen(false); setResumeToDelete(null) }}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isDarkTheme(theme)
                    ? 'bg-teal-700/30 text-brand-cream hover:bg-teal-700/50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div
        className={`max-w-4xl mx-auto rounded-2xl border p-6 sm:p-8 shadow-2xl relative ${
          isDarkTheme(theme)
            ? 'bg-teal-200/20 border-teal-500/30'
            : 'bg-white/80 border-teal-700/20'
        }`}
      >
        <div className='flex flex-col gap-6'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div>
              <h3
                className={`text-2xl font-semibold ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                Resume Management
              </h3>
              <p
                className={`text-sm ${
                  isDarkTheme(theme)
                    ? 'text-brand-cream/70'
                    : 'text-teal-800 dark:text-teal-300/80'
                }`}
              >
                Track your uploads, blockchain verification, and sharing status.
              </p>
            </div>
            <button
              onClick={() => user.address && fetchResumes(user.address)}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isDarkTheme(theme)
                  ? 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg'
                  : 'bg-teal-700 text-white hover:bg-teal-700/90 shadow-lg'
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div
            className={`grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border p-4 ${
              isDarkTheme(theme)
                ? 'bg-teal-700/30 border-teal-500/20'
                : 'bg-teal-700/10 border-teal-700/20'
            }`}
          >
            <StatItem
              label='Total Resumes'
              value={resumes.length}
              theme={theme}
            />
            <StatItem
              label='Verified'
              value={verifiedCount}
              theme={theme}
            />
            <StatItem
              label='Not Verified'
              value={resumes.length - verifiedCount}
              theme={theme}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='flex flex-col gap-3'>
              <div className='flex flex-col gap-2'>
                <input
                  type='search'
                  placeholder='Search by title, filename, or hash…'
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${
                    isDarkTheme(theme)
                      ? 'bg-brand-cream text-gray-900 border-transparent focus:ring-teal-500'
                      : 'bg-white text-gray-900 border-teal-700/40 focus:ring-teal-500'
                  }`}
                />
                <div className='flex gap-2'>
                  {(['ALL', 'VERIFIED', 'PENDING', 'FAILED'] as const).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                          statusFilter === status
                            ? isDarkTheme(theme)
                              ? 'bg-teal-600 text-white border-teal-500'
                              : 'bg-teal-700 text-white border-teal-700'
                            : isDarkTheme(theme)
                              ? 'bg-teal-700/20 text-brand-cream/70 border-teal-500/20 hover:bg-teal-700/30'
                              : 'bg-white text-teal-800 dark:text-teal-300 border-teal-700/30 hover:bg-teal-700/10'
                        }`}
                      >
                        {status === 'ALL'
                          ? 'All'
                          : STATUS_LABELS[status] ?? status.toLowerCase()}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div
                className={`rounded-xl border p-3 sm:p-4 overflow-hidden ${
                  isDarkTheme(theme)
                    ? 'bg-teal-700/20 border-teal-500/20'
                    : 'bg-brand-cream/40 border-teal-700/20'
                }`}
              >
                {error && (
                  <div
                    className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                      isDarkTheme(theme)
                        ? 'bg-red-900/20 border-red-500/40 text-red-300'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {error}
                  </div>
                )}

                {isLoading && (
                  <LoadingList theme={theme} />
                )}

                {!isLoading && filteredResumes.length === 0 && (
                  <div
                    className={`rounded-lg border px-4 py-6 text-center text-sm ${
                      isDarkTheme(theme)
                        ? 'border-teal-500/20 text-brand-cream/60'
                        : 'border-teal-700/20 text-teal-800 dark:text-teal-300/70'
                    }`}
                  >
                    {resumes.length === 0
                      ? 'Upload your first resume to see it here.'
                      : 'No resumes match your current filters.'}
                  </div>
                )}

                {!isLoading && filteredResumes.length > 0 && (
                  <div className='flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1'>
                    {filteredResumes.map((resume) => {
                      const status = resume.verification_status || 'PENDING'
                      return (
                        <button
                          key={resume.id}
                          onClick={() => setSelectedResume(resume)}
                          className={`w-full text-left rounded-xl border p-4 transition-all ${
                            selectedResume?.id === resume.id
                              ? isDarkTheme(theme)
                                ? 'bg-teal-600/20 border-teal-500/60 shadow-lg'
                                : 'bg-white border-teal-700/60 shadow-lg'
                              : isDarkTheme(theme)
                                ? 'bg-teal-700/30 border-teal-500/10 hover:border-teal-500/40 hover:bg-teal-700/40'
                                : 'bg-white/70 border-teal-700/20 hover:border-teal-700/40 hover:bg-white'
                          }`}
                        >
                          <div className='flex items-start justify-between gap-2 sm:gap-3'>
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center gap-2'>
                                <h4
                                  className={`text-sm font-semibold truncate ${
                                    isDarkTheme(theme)
                                      ? 'text-brand-cream'
                                      : 'text-teal-800 dark:text-teal-300'
                                  }`}
                                >
                                  {resume.title || resume.filename}
                                </h4>
                                {resume.resume_type === 'built' && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
                                    isDarkTheme(theme)
                                      ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                                      : 'bg-teal-700/10 text-teal-800 dark:text-teal-300 border border-teal-700/20'
                                  }`}>
                                    Built
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-xs mt-1 truncate ${
                                  isDarkTheme(theme)
                                    ? 'text-brand-cream/60'
                                    : 'text-teal-800 dark:text-teal-300/70'
                                }`}
                              >
                                {resume.filename}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}
                            >
                              {STATUS_LABELS[status] || status.toLowerCase()}
                            </span>
                          </div>
                          <div
                            className={`mt-3 text-xs flex justify-between ${
                              isDarkTheme(theme)
                                ? 'text-brand-cream/60'
                                : 'text-teal-800 dark:text-teal-300/70'
                            }`}
                          >
                            <span>{formatDate(resume.created_at)}</span>
                            <span>{formatFileSize(resume.file_size)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 sm:p-6 h-full ${
                isDarkTheme(theme)
                  ? 'bg-teal-700/25 border-teal-500/20'
                  : 'bg-white border-teal-700/20'
              }`}
            >
              {selectedResume ? (
                <ResumeDetail
                  resume={selectedResume}
                  theme={theme}
                  onEdit={onEditResume}
                  onDelete={handleDeleteClick}
                  onDownloadPDF={handleDownloadPDF}
                  onDuplicate={handleDuplicate}
                  onVerify={handleVerify}
                  isDownloading={isDownloading}
                  isVerifying={isVerifying}
                />
              ) : (
                <div
                  className={`h-full flex items-center justify-center text-sm ${
                    isDarkTheme(theme)
                      ? 'text-brand-cream/60'
                      : 'text-teal-800 dark:text-teal-300/70'
                  }`}
                >
                  Select a resume to see full details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface StatItemProps {
  label: string
  value: number
  theme: string
}

function StatItem({ label, value, theme }: StatItemProps) {
  return (
    <div className='flex flex-col gap-1'>
      <span
        className={`text-xs uppercase tracking-wide font-semibold ${
          isDarkTheme(theme) ? 'text-brand-cream/60' : 'text-teal-800 dark:text-teal-300/70'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-2xl font-bold ${
          isDarkTheme(theme) ? 'text-brand-cream' : 'text-teal-800 dark:text-teal-300'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

interface ResumeDetailProps {
  resume: ResumeRecord
  theme: string
  onEdit?: (resumeId: string) => void
  onDelete: (resume: ResumeRecord) => void
  onDownloadPDF: (resume: ResumeRecord) => void
  onDuplicate: (resume: ResumeRecord) => void
  onVerify: (resume: ResumeRecord) => void
  isDownloading: boolean
  isVerifying: boolean
}

function ResumeDetail({
  resume,
  theme,
  onEdit,
  onDelete,
  onDownloadPDF,
  onDuplicate,
  onVerify,
  isDownloading,
  isVerifying
}: ResumeDetailProps) {
  const status = resume.verification_status || 'PENDING'
  const statusLabel = STATUS_LABELS[status] || status.toLowerCase()
  const isVerified = status === 'VERIFIED'
  const isBuilt =
    resume.resume_type === 'built' || resume.resume_type === 'developer_built'

  const InfoRow = ({
    label,
    value,
    mono,
  }: {
    label: string
    value?: string | null
    mono?: boolean
  }) => (
    <div className='flex flex-col gap-1'>
      <span
        className={`text-xs font-semibold uppercase tracking-wide ${
          isDarkTheme(theme) ? 'text-brand-cream/50' : 'text-teal-800 dark:text-teal-300/70'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm ${
          mono ? 'font-mono text-xs break-all' : ''
        } ${isDarkTheme(theme) ? 'text-brand-cream' : 'text-gray-800'}`}
      >
        {value && value.length > 0 ? value : '—'}
      </span>
    </div>
  )

  // Button styles
  const primaryButtonClass = `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-teal-600 text-white hover:bg-teal-500'
      : 'bg-teal-700 text-white hover:bg-teal-700/90'
  }`

  const secondaryButtonClass = `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/40 hover:bg-teal-600/30'
      : 'bg-teal-700/10 text-teal-800 dark:text-teal-300 border border-teal-700/30 hover:bg-teal-700/20'
  }`

  const dangerButtonClass = `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
      : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
  }`

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex justify-between items-start gap-3'>
        <div>
          <h4
            className={`text-xl font-semibold ${
              isDarkTheme(theme) ? 'text-brand-cream' : 'text-teal-800 dark:text-teal-300'
            }`}
          >
            {resume.title || resume.filename}
          </h4>
          <p
            className={`text-sm ${
              isDarkTheme(theme)
                ? 'text-brand-cream/60'
                : 'text-teal-800 dark:text-teal-300/70'
            }`}
          >
            {isBuilt ? 'Created' : 'Uploaded'} {formatDate(resume.created_at)}
            {isBuilt && (
              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                isDarkTheme(theme)
                  ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                  : 'bg-teal-700/10 text-teal-800 dark:text-teal-300 border border-teal-700/20'
              }`}>
                Built Resume
              </span>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Not Verified CTA */}
      {!isVerified && (
        <div className={`p-3 rounded-lg border ${
          isDarkTheme(theme)
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-amber-300' : 'text-amber-600'}`} />
            <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-amber-300' : 'text-amber-700'}`}>
              Secure this resume on the blockchain
            </p>
          </div>
          <p className={`mt-1 text-xs ${isDarkTheme(theme) ? 'text-amber-300/70' : 'text-amber-600'}`}>
            Verification creates a permanent, tamper-proof record that employers can trust.
          </p>
        </div>
      )}

      {isBuilt ? (
        // Built Resume View
        <>
          <div className='grid grid-cols-1 gap-4'>
            <InfoRow label='Resume Type' value='Built (Created via Resume Builder)' />
            <InfoRow label='Created' value={formatDate(resume.created_at)} />
            {resume.structured_data && (
              <div className='mt-2'>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isDarkTheme(theme) ? 'text-brand-cream/50' : 'text-teal-800 dark:text-teal-300/70'
                  }`}
                >
                  Resume Sections
                </span>
                <div className={`mt-2 p-3 rounded-lg border ${
                  isDarkTheme(theme)
                    ? 'bg-teal-700/20 border-teal-500/20'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className='grid grid-cols-2 gap-2 text-sm'>
                    {(resume.structured_data as { personalInfo?: object }).personalInfo && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ Personal Info
                      </span>
                    )}
                    {(resume.structured_data as { cdlInfo?: object }).cdlInfo && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ CDL & License
                      </span>
                    )}
                    {((resume.structured_data as { employments?: unknown[] }).employments?.length ?? 0) > 0 && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ Employment ({(resume.structured_data as { employments?: unknown[] }).employments?.length})
                      </span>
                    )}
                    {((resume.structured_data as { educations?: unknown[] }).educations?.length ?? 0) > 0 && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ Education ({(resume.structured_data as { educations?: unknown[] }).educations?.length})
                      </span>
                    )}
                    {((resume.structured_data as { skills?: unknown[] }).skills?.length ?? 0) > 0 && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ Skills ({(resume.structured_data as { skills?: unknown[] }).skills?.length})
                      </span>
                    )}
                    {((resume.structured_data as { references?: unknown[] }).references?.length ?? 0) > 0 && (
                      <span className={isDarkTheme(theme) ? 'text-brand-cream/80' : 'text-gray-700'}>
                        ✓ References ({(resume.structured_data as { references?: unknown[] }).references?.length})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons for Built Resumes */}
          <div className='flex flex-wrap gap-2'>
            {/* Verify on Blockchain - Primary CTA for unverified */}
            {!isVerified && (
              <button 
                onClick={() => onVerify(resume)} 
                disabled={isVerifying}
                className={primaryButtonClass}
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isVerifying ? 'Verifying...' : 'Verify on Blockchain'}
              </button>
            )}
            
            {/* Edit */}
            {onEdit && (
              <button onClick={() => onEdit(resume.id)} className={isVerified ? primaryButtonClass : secondaryButtonClass}>
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
            
            {/* Download PDF */}
            <button 
              onClick={() => onDownloadPDF(resume)} 
              disabled={isDownloading}
              className={secondaryButtonClass}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </button>
            
            {/* Duplicate */}
            <button onClick={() => onDuplicate(resume)} className={secondaryButtonClass}>
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            
            {/* Delete */}
            <button onClick={() => onDelete(resume)} className={dangerButtonClass}>
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      ) : (
        // Uploaded Resume View
        <>
          <div className='grid grid-cols-1 gap-4'>
            <InfoRow label='Filename' value={resume.filename} />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <InfoRow label='File Size' value={formatFileSize(resume.file_size)} />
              <InfoRow label='MIME Type' value={resume.mime_type} />
            </div>
            <InfoRow label='IPFS Hash' value={resume.ipfs_hash} mono />
            <InfoRow label='IPFS URL' value={resume.ipfs_url} mono />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <InfoRow
                label='Blockchain Tx Hash'
                value={resume.blockchain_tx_hash || undefined}
                mono
              />
              <InfoRow
                label='Blockchain Resume ID'
                value={resume.blockchain_resume_id || undefined}
              />
            </div>
            
            <InfoRow
              label='Payment'
              value={resume.is_paid ? 'Paid' : 'Free Tier'}
            />
          </div>
          
          {/* Action Buttons for Uploaded Resumes */}
          <div className='flex flex-wrap gap-2'>
            {/* Verify on Blockchain - Primary CTA for unverified */}
            {!isVerified && (
              <button 
                onClick={() => onVerify(resume)} 
                disabled={isVerifying}
                className={primaryButtonClass}
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isVerifying ? 'Verifying...' : 'Verify on Blockchain'}
              </button>
            )}
            
            {/* View on IPFS */}
            {resume.ipfs_url && (
              <a
                href={resume.ipfs_url}
                target='_blank'
                rel='noopener noreferrer'
                className={secondaryButtonClass}
              >
                <ExternalLink className="w-4 h-4" />
                View on IPFS
              </a>
            )}
            
            {/* View on BaseScan */}
            {resume.blockchain_tx_hash && (
              <a
                href={`https://sepolia.basescan.org/tx/${resume.blockchain_tx_hash}`}
                target='_blank'
                rel='noopener noreferrer'
                className={secondaryButtonClass}
              >
                <ExternalLink className="w-4 h-4" />
                View on BaseScan
              </a>
            )}
            
            {/* Download from IPFS */}
            {resume.ipfs_url && (
              <a
                href={resume.ipfs_url}
                target='_blank'
                rel='noopener noreferrer'
                download
                className={secondaryButtonClass}
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            )}
            
            {/* Delete */}
            <button onClick={() => onDelete(resume)} className={dangerButtonClass}>
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function LoadingList({ theme }: { theme: string }) {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-xl border p-4 ${
            isDarkTheme(theme)
              ? 'bg-teal-700/30 border-teal-500/10'
              : 'bg-white border-teal-700/20'
          }`}
        >
          <div className='h-4 w-3/4 rounded bg-gray-300/60 dark:bg-brand-cream/20'></div>
          <div className='mt-3 h-3 w-1/2 rounded bg-gray-300/40 dark:bg-brand-cream/10'></div>
        </div>
      ))}
    </div>
  )
}
