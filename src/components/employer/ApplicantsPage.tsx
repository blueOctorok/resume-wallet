'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Users,
  Filter,
  Search,
  ChevronDown,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  MessageSquare,
  UserCheck,
  UserX,
  MapPin,
  Award,
  Calendar,
  X,
  Loader2,
  ExternalLink,
  Car,
} from 'lucide-react'

interface Applicant {
  applicationId: string
  status: string
  appliedAt: string
  viewCount: number
  lastViewedAt: string | null
  coverLetter: string | null
  reviewerNotes: string | null
  shareToken: string | null
  driverUserId: string
  driverName: string
  driverEmail: string | null
  driverPhone: string | null
  driverLocation: string | null
  cdlClass: string | null
  cdlState: string | null
  cdlExpiration: string | null
  experienceYears: number | null
  professionalSummary: string | null
  jobPostingId: string
  jobTitle: string
  hasResume: boolean
  resumeId: string | null
  resumeTitle: string | null
  resumeVerified: boolean
  resumeIpfsHash: string | null
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
    reviewing: 0,
    interviewing: 0,
    offerSent: 0,
    hired: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
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
      const response = await fetch('/api/employer/applicants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ applicationId, status: newStatus }),
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
      applicant.driverName.toLowerCase().includes(query) ||
      applicant.jobTitle.toLowerCase().includes(query) ||
      applicant.driverEmail?.toLowerCase().includes(query) ||
      applicant.driverLocation?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className={`w-12 h-12 animate-spin ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            ← Back to Hub
          </button>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Applicants
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Review and manage applications to your job postings
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} theme={theme} />
        <StatCard label="New" value={stats.new} theme={theme} highlight />
        <StatCard label="Reviewing" value={stats.reviewing} theme={theme} />
        <StatCard label="Interviewing" value={stats.interviewing} theme={theme} />
        <StatCard label="Offer Sent" value={stats.offerSent} theme={theme} />
        <StatCard label="Hired" value={stats.hired} theme={theme} success />
      </div>

      {/* Filters */}
      <div className={`rounded-2xl p-4 mb-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
          : 'bg-white border border-brand-sage/20 shadow-xl'
      }`}>
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search by name, job, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 ${
                  theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>

          {/* Job Filter */}
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className={`px-4 py-2 rounded-xl border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 ${
              theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
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
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 ${
              theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
            }`}
          >
            <option value="all">All Status</option>
            <option value="submitted">New</option>
            <option value="viewed">Viewed</option>
            <option value="reviewing">Reviewing</option>
            <option value="interviewing">Interviewing</option>
            <option value="offer_sent">Offer Sent</option>
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applicants List */}
      {error ? (
        <div className={`p-6 rounded-xl text-center ${
          theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
        }`}>
          {error}
        </div>
      ) : filteredApplicants.length === 0 ? (
        <div className={`p-12 rounded-xl text-center ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <Users className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={`text-lg font-semibold mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            No applicants found
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            {searchQuery || selectedJob !== 'all' || selectedStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'No one has applied to your jobs yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplicants.map(applicant => (
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
      theme === 'dark'
        ? 'bg-brand-sage-dark/50 border border-brand-mint/20'
        : 'bg-white border border-gray-200 shadow-sm'
    }`}>
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold ${
        highlight ? 'text-orange-500' : success ? 'text-green-500' : theme === 'dark' ? 'text-white' : 'text-gray-900'
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
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/20 hover:bg-brand-sage-dark'
          : 'bg-white border border-gray-200 shadow-sm hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          theme === 'dark' ? 'bg-brand-mint/20' : 'bg-brand-sage/10'
        }`}>
          <span className={`text-lg font-bold ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`}>
            {applicant.driverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {applicant.driverName}
              </h3>
              <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {applicant.jobTitle}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                {applicant.driverLocation && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <MapPin className="w-3 h-3" />
                    {applicant.driverLocation}
                  </span>
                )}
                {applicant.cdlClass && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <Award className="w-3 h-3" />
                    CDL {applicant.cdlClass} • {applicant.experienceYears || 0} yrs
                  </span>
                )}
                <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(applicant.appliedAt)}
                </span>
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
    { value: 'viewed', label: 'Viewed' },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'offer_sent', label: 'Offer Sent' },
    { value: 'hired', label: 'Hired' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl ${
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
              {applicant.driverName}
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Applied for {applicant.jobTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="flex flex-wrap gap-3">
            {applicant.driverEmail && (
              <a
                href={`mailto:${applicant.driverEmail}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📧</span>
                {applicant.driverEmail}
              </a>
            )}
            {applicant.driverPhone && (
              <a
                href={`tel:${applicant.driverPhone}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📞</span>
                {applicant.driverPhone}
              </a>
            )}
          </div>

          {/* CDL Info */}
          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
            <h4 className={`font-medium mb-3 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <Award className="w-4 h-4" />
              CDL Information
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Class</p>
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{applicant.cdlClass || 'N/A'}</p>
              </div>
              <div>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>State</p>
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{applicant.cdlState || 'N/A'}</p>
              </div>
              <div>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Experience</p>
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{applicant.experienceYears || 0} years</p>
              </div>
            </div>
          </div>

          {/* Resume */}
          {applicant.hasResume && (
            <div>
              <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Resume
              </h4>
              <div className="flex items-center gap-3">
                <FileText className={`w-5 h-5 ${applicant.resumeVerified ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
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
                    className="text-sm text-brand-mint hover:underline"
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
              <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Cover Letter
              </h4>
              <p className={`text-sm p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800/50 text-gray-300' : 'bg-gray-50 text-gray-700'
              }`}>
                {applicant.coverLetter}
              </p>
            </div>
          )}

          {/* Status Update */}
          <div>
            <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Update Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onStatusChange(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    applicant.status === option.value
                      ? theme === 'dark'
                        ? 'bg-brand-mint text-gray-900'
                        : 'bg-brand-sage text-white'
                      : theme === 'dark'
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
            <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Notes
            </h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              className={`w-full px-4 py-3 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
              placeholder="Add private notes about this applicant..."
            />
            {savingNotes && (
              <p className="text-xs text-gray-500 mt-1">Saving...</p>
            )}
          </div>
        </div>
      </div>
    </div>
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
    default:
      return {
        label: status || 'Unknown',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      }
  }
}
