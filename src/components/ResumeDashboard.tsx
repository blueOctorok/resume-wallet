'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

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
}

interface ResumeDashboardProps {
  user?: {
    address?: string
  } | null
  onResumesLoaded?: (count: number, latestResume?: ResumeRecord) => void
}

const STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  FAILED: 'Failed',
}

const STATUS_STYLES: Record<string, string> = {
  VERIFIED:
    'bg-green-500/10 text-green-600 dark:text-green-300 border border-green-500/40',
  PENDING:
    'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40',
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
}: ResumeDashboardProps) {
  const { theme } = useTheme()
  const [resumes, setResumes] = useState<ResumeRecord[]>([])
  const [selectedResume, setSelectedResume] = useState<ResumeRecord | null>(
    null
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'FAILED'>('ALL')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchResumes = async (address: string) => {
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
  }

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

  if (!user?.address) {
    return (
      <div
        className={`max-w-4xl mx-auto p-6 rounded-2xl border ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 border-brand-mint/30 text-brand-cream/80'
            : 'bg-white/80 border-brand-sage/20 text-gray-700'
        }`}
      >
        <p className='text-center text-sm sm:text-base'>
          Sign in to manage and review your verified resumes.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`max-w-4xl mx-auto rounded-2xl border p-6 sm:p-8 shadow-2xl relative ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 border-brand-mint/30'
          : 'bg-white/80 border-brand-sage/20'
      }`}
    >
      <div className='flex flex-col gap-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h3
              className={`text-2xl font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Resume Management
            </h3>
            <p
              className={`text-sm ${
                theme === 'dark'
                  ? 'text-brand-cream/70'
                  : 'text-brand-sage/80'
              }`}
            >
              Track your uploads, blockchain verification, and sharing status.
            </p>
          </div>
          <button
            onClick={() => user.address && fetchResumes(user.address)}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border p-4 ${
            theme === 'dark'
              ? 'bg-brand-sage/30 border-brand-mint/20'
              : 'bg-brand-sage/10 border-brand-sage/20'
          }`}
        >
          <StatItem
            label='Total Uploads'
            value={resumes.length}
            theme={theme}
          />
          <StatItem
            label='Verified'
            value={verifiedCount}
            theme={theme}
          />
          <StatItem
            label='Awaiting Verification'
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
                  theme === 'dark'
                    ? 'bg-brand-cream text-gray-900 border-transparent focus:ring-brand-mint'
                    : 'bg-white text-gray-900 border-brand-sage/40 focus:ring-brand-sage'
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
                          ? theme === 'dark'
                            ? 'bg-brand-mint text-gray-900 border-brand-mint'
                            : 'bg-brand-sage text-white border-brand-sage'
                          : theme === 'dark'
                            ? 'bg-brand-sage/20 text-brand-cream/70 border-brand-mint/20 hover:bg-brand-sage/30'
                            : 'bg-white text-brand-sage border-brand-sage/30 hover:bg-brand-sage/10'
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
                theme === 'dark'
                  ? 'bg-brand-sage/20 border-brand-mint/20'
                  : 'bg-brand-cream/40 border-brand-sage/20'
              }`}
            >
              {error && (
                <div
                  className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                    theme === 'dark'
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
                    theme === 'dark'
                      ? 'border-brand-mint/20 text-brand-cream/60'
                      : 'border-brand-sage/20 text-brand-sage/70'
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
                            ? theme === 'dark'
                              ? 'bg-brand-mint/20 border-brand-mint/60 shadow-lg'
                              : 'bg-white border-brand-sage/60 shadow-lg'
                            : theme === 'dark'
                              ? 'bg-brand-sage/30 border-brand-mint/10 hover:border-brand-mint/40 hover:bg-brand-sage/40'
                              : 'bg-white/70 border-brand-sage/20 hover:border-brand-sage/40 hover:bg-white'
                        }`}
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <h4
                              className={`text-sm font-semibold ${
                                theme === 'dark'
                                  ? 'text-brand-cream'
                                  : 'text-brand-sage'
                              }`}
                            >
                              {resume.title || resume.filename}
                            </h4>
                            <p
                              className={`text-xs mt-1 ${
                                theme === 'dark'
                                  ? 'text-brand-cream/60'
                                  : 'text-brand-sage/70'
                              }`}
                            >
                              {resume.filename}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}
                          >
                            {STATUS_LABELS[status] || status.toLowerCase()}
                          </span>
                        </div>
                        <div
                          className={`mt-3 text-xs flex justify-between ${
                            theme === 'dark'
                              ? 'text-brand-cream/60'
                              : 'text-brand-sage/70'
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
              theme === 'dark'
                ? 'bg-brand-sage/25 border-brand-mint/20'
                : 'bg-white border-brand-sage/20'
            }`}
          >
            {selectedResume ? (
              <ResumeDetail
                resume={selectedResume}
                theme={theme}
              />
            ) : (
              <div
                className={`h-full flex items-center justify-center text-sm ${
                  theme === 'dark'
                    ? 'text-brand-cream/60'
                    : 'text-brand-sage/70'
                }`}
              >
                Select a resume to see full details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
          theme === 'dark' ? 'text-brand-cream/60' : 'text-brand-sage/70'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'
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
}

function ResumeDetail({ resume, theme }: ResumeDetailProps) {
  const status = resume.verification_status || 'PENDING'
  const statusLabel = STATUS_LABELS[status] || status.toLowerCase()

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
          theme === 'dark' ? 'text-brand-cream/50' : 'text-brand-sage/70'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm ${
          mono ? 'font-mono text-xs break-all' : ''
        } ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'}`}
      >
        {value && value.length > 0 ? value : '—'}
      </span>
    </div>
  )

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex justify-between items-start gap-3'>
        <div>
          <h4
            className={`text-xl font-semibold ${
              theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'
            }`}
          >
            {resume.title || resume.filename}
          </h4>
          <p
            className={`text-sm ${
              theme === 'dark'
                ? 'text-brand-cream/60'
                : 'text-brand-sage/70'
            }`}
          >
            Uploaded {formatDate(resume.created_at)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}
        >
          {statusLabel}
        </span>
      </div>

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
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <InfoRow
            label='Sharing Status'
            value={resume.is_public ? 'Public' : 'Private'}
          />
          <InfoRow
            label='Payment'
            value={resume.is_paid ? 'Paid' : 'Free Tier'}
          />
        </div>
      </div>

      <div className='flex flex-wrap gap-3'>
        {resume.ipfs_url && (
          <a
            href={resume.ipfs_url}
            target='_blank'
            rel='noopener noreferrer'
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/40 hover:bg-brand-mint/30'
                : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
            }`}
          >
            View on IPFS
          </a>
        )}
        {resume.blockchain_tx_hash && (
          <a
            href={`https://sepolia.basescan.org/tx/${resume.blockchain_tx_hash}`}
            target='_blank'
            rel='noopener noreferrer'
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/40 hover:bg-brand-mint/30'
                : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
            }`}
          >
            View on BaseScan
          </a>
        )}
      </div>
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
            theme === 'dark'
              ? 'bg-brand-sage/30 border-brand-mint/10'
              : 'bg-white border-brand-sage/20'
          }`}
        >
          <div className='h-4 w-3/4 rounded bg-gray-300/60 dark:bg-brand-cream/20'></div>
          <div className='mt-3 h-3 w-1/2 rounded bg-gray-300/40 dark:bg-brand-cream/10'></div>
        </div>
      ))}
    </div>
  )
}


