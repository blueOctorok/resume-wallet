'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Users,
  Search,
  FileText,
  Clock,
  MessageSquare,
  UserX,
  Calendar,
  X,
  Loader2,
  ExternalLink,
  User,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import CareerCardModal from '@/components/employer/CareerCardModal'

interface Applicant {
  applicationId: string
  status: string
  appliedAt: string
  viewCount: number
  coverLetter: string | null
  reviewerNotes: string | null
  shareToken: string | null
  applicantUserId: string
  applicantName: string
  applicantEmail: string | null
  applicantPhone: string | null
  applicantRole: string
  avatarUrl?: string | null
  jobPostingId: string
  jobTitle: string
  hasResume: boolean
  resumeId: string | null
  resumeTitle: string | null
  resumeVerified: boolean
  resumeIpfsHash: string | null
  jobTargetRole: string
  /**
   * Career-Card-Lens name in effect when the candidate submitted. `null` =
   * default "Full profile" or pre-lens application. Read-only; employers see
   * this as a small badge to understand the framing the candidate chose.
   */
  lensNameSnapshot: string | null
}

interface Job {
  id: string
  title: string
  is_active: boolean
}

interface ApplicantsPageProps {
  walletAddress: string
  onBack: () => void
}

export default function ApplicantsPage({ walletAddress, onBack }: ApplicantsPageProps) {
  const { theme } = useTheme()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    archived: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Selected applicant for detail view
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchApplicants()
  }, [walletAddress, selectedJob, selectedStatus])

  const fetchApplicants = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedJob !== 'all') params.append('jobId', selectedJob)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)

      const response = await fetch(`/api/employer/applicants?${params}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch applicants')
      }

      const data = await response.json()
      setApplicants(data.applicants || [])
      setJobs(data.jobs || [])
      setStats(data.stats || stats)
    } catch (err) {
      console.error('Error fetching applicants:', err)
      setError('Failed to load applicants')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (applicationId: string, newStatus: string) => {
    try {
      setUpdatingStatus(applicationId)
      const response = await fetch(`/api/employer/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      // Refresh applicants
      await fetchApplicants()
      if (selectedApplicant?.applicationId === applicationId) {
        setSelectedApplicant({ ...selectedApplicant, status: newStatus })
      }
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  // Filter applicants by search query
  const filteredApplicants = applicants.filter(applicant => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      applicant.applicantName.toLowerCase().includes(query) ||
      applicant.jobTitle.toLowerCase().includes(query) ||
      applicant.applicantEmail?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className={`w-12 h-12 animate-spin ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div className="mb-6">
        <BackToHubButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Applicants
          </h1>
          <p className={`mt-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
            Review and manage applications to your job postings
          </p>
        </div>
      </div>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="mb-6">
        <BlockCard
          variant="embed"
          icon={Users}
          title="Pipeline snapshot"
          description="Counts across all applications."
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} theme={theme} />
            <StatCard label="New" value={stats.new} theme={theme} highlight />
            <StatCard label="Contacted" value={stats.contacted} theme={theme} />
            <StatCard label="Archived" value={stats.archived} theme={theme} />
          </div>
        </BlockCard>
      </HubSectionPanel>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="mb-6">
        <BlockCard variant="embed" icon={Search} title="Search & filter" description="Narrow by job, status, or keyword.">
          <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search by name, job, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl ${
                  isDarkTheme(theme)
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 ${
                  isDarkTheme(theme) ? 'focus:ring-teal-500' : 'focus:ring-teal-500'
                }`}
              />
            </div>
          </div>

          {/* Job Filter */}
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className={`px-4 py-2 rounded-xl border ${
              isDarkTheme(theme)
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 ${
              isDarkTheme(theme) ? 'focus:ring-teal-500' : 'focus:ring-teal-500'
            }`}
          >
            <option value="all">All Jobs</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`px-4 py-2 rounded-xl border ${
              isDarkTheme(theme)
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 ${
              isDarkTheme(theme) ? 'focus:ring-teal-500' : 'focus:ring-teal-500'
            }`}
          >
            <option value="all">All Status</option>
            <option value="submitted">New</option>
            <option value="contacted">Contacted</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        </BlockCard>
      </HubSectionPanel>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="teal" className="mb-6">
        <BlockCard
          variant="embed"
          icon={FileText}
          title="Applications"
          description="Open a row for full detail and career card."
        >
          {error ? (
            <div
              className={`rounded-xl p-6 text-center ${
                isDarkTheme(theme) ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              }`}
            >
              {error}
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div
              className={`rounded-xl p-12 text-center ${
                isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
              }`}
            >
              <Users
                className={`mx-auto mb-4 h-16 w-16 ${
                  isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'
                }`}
              />
              <p
                className={`mb-2 text-lg font-semibold ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                No applicants found
              </p>
              <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                {searchQuery || selectedJob !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No one has applied to your jobs yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApplicants.map((applicant) => (
                <ApplicantCard
                  key={applicant.applicationId}
                  applicant={applicant}
                  onClick={() => setSelectedApplicant(applicant)}
                  onStatusChange={(status) => updateStatus(applicant.applicationId, status)}
                  updating={updatingStatus === applicant.applicationId}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </BlockCard>
      </HubSectionPanel>

      {/* Detail Modal */}
      {selectedApplicant && (
        <ApplicantDetailModal
          applicant={selectedApplicant}
          walletAddress={walletAddress}
          onClose={() => setSelectedApplicant(null)}
          onStatusChange={(status) => {
            updateStatus(selectedApplicant.applicationId, status)
            setSelectedApplicant({ ...selectedApplicant, status })
          }}
          theme={theme}
        />
      )}
    </div>
  )
}

// Sub-components

function StatCard({ label, value, theme, highlight, success }: {
  label: string
  value: number
  theme: string
  highlight?: boolean
  success?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 ${
      isDarkTheme(theme)
        ? 'bg-teal-900/50 border border-teal-500/20'
        : 'bg-white border border-gray-200 shadow-sm'
    }`}>
      <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold ${
        highlight ? 'text-orange-500' : success ? 'text-green-500' : isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  )
}

function ApplicantCard({ 
  applicant, 
  onClick, 
  onStatusChange,
  updating,
  theme 
}: { 
  applicant: Applicant
  onClick: () => void
  onStatusChange: (status: string) => void
  updating: boolean
  theme: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl transition-colors ${
        isDarkTheme(theme)
          ? 'bg-teal-900/50 border border-teal-500/20 hover:bg-teal-900'
          : 'bg-white border border-gray-200 shadow-sm hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDarkTheme(theme) ? 'bg-teal-600/20' : 'bg-teal-700/10'
        }`}>
          <span className={`text-lg font-bold ${
            isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
          }`}>
            {applicant.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                {applicant.applicantName}
              </h3>
              <p className={`text-sm truncate ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                {applicant.jobTitle}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                <span className={`flex items-center gap-1 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(applicant.appliedAt)}
                </span>
                {applicant.lensNameSnapshot && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                      isDarkTheme(theme)
                        ? 'bg-teal-500/10 text-teal-200 ring-1 ring-teal-400/30'
                        : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                    }`}
                    title={`Candidate submitted with their ${applicant.lensNameSnapshot} framing`}
                  >
                    {applicant.lensNameSnapshot} framing
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <StatusBadge status={applicant.status} theme={theme} />
          </div>
        </div>
      </div>
    </button>
  )
}

function StatusBadge({ status, theme }: { status: string; theme: string }) {
  const config = getStatusConfig(status)
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  )
}

function ApplicantDetailModal({
  applicant,
  walletAddress,
  onClose,
  onStatusChange,
  theme,
}: {
  applicant: Applicant
  walletAddress: string
  onClose: () => void
  onStatusChange: (status: string) => void
  theme: string
}) {
  const [notes, setNotes] = useState(applicant.reviewerNotes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showCareerCard, setShowCareerCard] = useState(false)

  const saveNotes = async () => {
    try {
      setSavingNotes(true)
      const response = await fetch('/api/employer/applicants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          applicationId: applicant.applicationId,
          reviewerNotes: notes,
        }),
      })

      if (!response.ok) throw new Error('Failed to save notes')
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  const statusOptions = [
    { value: 'submitted', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <>
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      {/* Custom header with Career Card button alongside close */}
      <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
        isDarkTheme(theme) ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
      }`}>
        <div>
          <h3 className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            {applicant.applicantName}
          </h3>
          <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
            Applied for {applicant.jobTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCareerCard(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isDarkTheme(theme)
                ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Career Card
          </button>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDarkTheme(theme) ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="flex flex-wrap gap-3">
            {applicant.applicantEmail && (
              <a
                href={`mailto:${applicant.applicantEmail}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📧</span>
                {applicant.applicantEmail}
              </a>
            )}
            {applicant.applicantPhone && (
              <a
                href={`tel:${applicant.applicantPhone}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📞</span>
                {applicant.applicantPhone}
              </a>
            )}
          </div>

          {/* Resume */}
          {applicant.hasResume && (
            <div>
              <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                Resume
              </h4>
              <div className="flex items-center gap-3">
                <FileText className={`w-5 h-5 ${applicant.resumeVerified ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                  {applicant.resumeTitle || 'Resume'}
                </span>
                {applicant.resumeVerified && (
                  <span className="text-xs text-green-500">✓ Verified</span>
                )}
                {applicant.resumeIpfsHash && !applicant.resumeIpfsHash.startsWith('built_') && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${applicant.resumeIpfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View <ExternalLink className="w-3 h-3 inline" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Cover Letter */}
          {applicant.coverLetter && (
            <div>
              <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                Cover Letter
              </h4>
              <p className={`text-sm p-3 rounded-lg ${
                isDarkTheme(theme) ? 'bg-gray-800/50 text-gray-300' : 'bg-gray-50 text-gray-700'
              }`}>
                {applicant.coverLetter}
              </p>
            </div>
          )}

          {/* Status Update */}
          <div>
            <h4 className={`font-medium mb-3 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              Update Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onStatusChange(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    applicant.status === option.value
                      ? isDarkTheme(theme)
                        ? 'bg-teal-600 text-white'
                        : 'bg-teal-700 text-white'
                      : isDarkTheme(theme)
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              Notes
            </h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              className={`w-full px-4 py-3 rounded-xl border ${
                isDarkTheme(theme)
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                isDarkTheme(theme) ? 'focus:ring-teal-500' : 'focus:ring-teal-500'
              }`}
              placeholder="Add private notes about this applicant..."
            />
            {savingNotes && (
              <p className="text-xs text-gray-500 mt-1">Saving...</p>
            )}
          </div>
        </div>
    </Modal>

    {/* Career card modal — layered above the detail modal */}
    {showCareerCard && (
      <CareerCardModal
        candidateUserId={applicant.applicantUserId}
        walletAddress={walletAddress}
        onClose={() => setShowCareerCard(false)}
      />
    )}
    </>
  )
}

// Helpers

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

function getStatusConfig(status: string) {
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
    default:
      return {
        label: status || 'Unknown',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
  }
}
