'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import {
  X,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  FileText,
  ClipboardCheck,
  Car,
  Shield,
  Code,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Send,
  UserPlus,
  Download,
  Github,
  Linkedin,
  Globe,
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface CareerCardData {
  userId: string
  role: string
  name: string
  email: string | null
  phone: string | null
  location: string | null
  memberSince: string
  profile: {
    fullName: string
    professionalSummary?: string
    city?: string
    state?: string
    cdl_class?: string
    cdl_state?: string
    cdl_number?: string
    cdl_expiration?: string
    endorsements?: string[]
    cdl_endorsements?: string[]
    restrictions?: string[]
    experience_years?: number
    years_experience?: number
    title?: string
    github_url?: string
    linkedin_url?: string
    portfolio_url?: string
    skills?: Array<{ name: string; category?: string }> | string[]
    employment_history?: Array<{
      companyName?: string
      position?: string
      startDate?: string
      endDate?: string
      isCurrent?: boolean
    }>
    education?: Array<{
      school?: string
      degree?: string
      field?: string
      year?: string
    }>
    share_token?: string
  } | null
  resume: {
    id: string
    title: string
    filename: string
    ipfsHash: string
    verificationStatus: string
    structuredData: Record<string, unknown> | null
    createdAt: string
  } | null
  driverApplication: {
    id: string
    status: string
    isComplete: boolean
    createdAt: string
  } | null
  mvr: {
    orderId: string
    orderStatus: string
    licenseState: string
    orderedAt: string
    completedAt: string | null
    wasOrderedByEmployer: boolean
    results: {
      licenseStatus: string
      licenseClass: string
      totalPoints: number
      violationCount: number
    } | null
  } | null
  workHistory: Array<{
    companyName?: string
    position?: string
    startDate?: string
    endDate?: string
    isCurrent?: boolean
  }>
  verifications: Array<{
    id: string
    employer: string
    position: string
    startDate: string
    endDate: string | null
    status: string
    verifiedAt: string | null
  }>
  completenessScore: number
  workHistoryCount: number
  verifiedJobsCount: number
  hasProfile: boolean
  hasResume: boolean
  hasDriverApp: boolean
  hasMvr: boolean
  hasWorkHistory: boolean
  pendingRequests: Array<{
    id: string
    request_type: string
    status: string
    created_at: string
  }>
  existingApplication: {
    id: string
    status: string
    created_at: string
  } | null
}

interface CareerCardModalProps {
  candidateUserId: string
  walletAddress: string
  onClose: () => void
}

// ============================================================
// COMPONENT
// ============================================================

interface JobPosting {
  id: string
  title: string
  isActive: boolean
}

export default function CareerCardModal({
  candidateUserId,
  walletAddress,
  onClose,
}: CareerCardModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [careerCard, setCareerCard] = useState<CareerCardData | null>(null)
  const [requestLoading, setRequestLoading] = useState<string | null>(null)
  
  // Recruit modal state
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [recruitMessage, setRecruitMessage] = useState('')
  const [recruitLoading, setRecruitLoading] = useState(false)

  useEffect(() => {
    fetchCareerCard()
  }, [candidateUserId])

  // Lock body scroll when modal is open so background doesn't scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Track if we're mounted (for portal)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchCareerCard = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/employer/talent/${candidateUserId}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load career card')
      }

      const data = await response.json()
      setCareerCard(data.careerCard)
    } catch (err) {
      console.error('Error fetching career card:', err)
      setError(err instanceof Error ? err.message : 'Failed to load career card')
    } finally {
      setLoading(false)
    }
  }

  const createRequest = async (requestType: string, documentType?: string) => {
    try {
      setRequestLoading(requestType)

      const response = await fetch(`/api/employer/talent/${candidateUserId}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          requestType,
          documentType,
          message: `Requested via StormChain Talent Search`,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create request')
      }

      // Refresh career card to show new pending request
      await fetchCareerCard()
    } catch (err) {
      console.error('Error creating request:', err)
      alert(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setRequestLoading(null)
    }
  }

  const fetchJobPostings = async () => {
    try {
      setJobsLoading(true)
      const response = await fetch('/api/employer/jobs', {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch job postings')
      }

      const data = await response.json()
      // Filter to only active jobs
      const activeJobs = (data.jobs || []).filter((j: JobPosting) => j.isActive)
      setJobPostings(activeJobs)
    } catch (err) {
      console.error('Error fetching jobs:', err)
    } finally {
      setJobsLoading(false)
    }
  }

  const openRecruitModal = () => {
    setShowRecruitModal(true)
    setSelectedJobId(null)
    setRecruitMessage('')
    fetchJobPostings()
  }

  const recruitCandidate = async () => {
    if (!selectedJobId) {
      alert('Please select a job posting')
      return
    }

    try {
      setRecruitLoading(true)
      const response = await fetch(`/api/employer/talent/${candidateUserId}/recruit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          jobPostingId: selectedJobId,
          message: recruitMessage || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create application')
      }

      // Success - close modal and refresh
      alert(`Application created! ${careerCard?.name || 'The candidate'} has been notified.`)
      setShowRecruitModal(false)
      await fetchCareerCard()
    } catch (err) {
      console.error('Error recruiting candidate:', err)
      alert(err instanceof Error ? err.message : 'Failed to recruit candidate')
    } finally {
      setRecruitLoading(false)
    }
  }

  const isDriver = careerCard?.role === 'driver'
  const profile = careerCard?.profile

  // Check if request already pending
  const hasPendingRequest = (type: string) => 
    careerCard?.pendingRequests?.some(r => r.request_type === type) || false

  // Render via portal to escape parent stacking contexts (nav is z-50)
  if (!mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative z-[10000] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        theme === 'dark'
          ? 'bg-gray-900 border border-gray-700'
          : 'bg-white shadow-2xl'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDriver
                ? theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
                : theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
            }`}>
              {isDriver ? (
                <Car className={theme === 'dark' ? 'text-teal-400' : 'text-teal-600'} />
              ) : (
                <Code className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
              )}
            </div>
            <div>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {loading ? 'Loading...' : careerCard?.name || 'Career Card'}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {isDriver ? 'Driver' : 'Developer'} Career Card
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-10 h-10 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
          )}

          {error && (
            <div className={`p-6 rounded-xl text-center ${
              theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              <AlertCircle className="w-10 h-10 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && careerCard && (
            <div className="space-y-6">
              {/* Profile Score Banner */}
              <div className={`p-4 rounded-xl ${
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-5 h-5 ${
                      careerCard.completenessScore >= 80 ? 'text-green-500' :
                      careerCard.completenessScore >= 60 ? 'text-yellow-500' :
                      'text-orange-500'
                    }`} />
                    <div>
                      <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Profile Completeness: {careerCard.completenessScore}%
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {careerCard.verifiedJobsCount} verified jobs • {careerCard.workHistoryCount} work entries
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {careerCard.hasResume && <Badge label="Resume" color="green" theme={theme} />}
                    {careerCard.hasDriverApp && <Badge label="DOT" color="green" theme={theme} />}
                    {careerCard.hasMvr && <Badge label="MVR" color="green" theme={theme} />}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <Section title="Contact" theme={theme}>
                <div className="flex flex-wrap gap-3">
                  {careerCard.email && (
                    <a
                      href={`mailto:${careerCard.email}`}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      {careerCard.email}
                    </a>
                  )}
                  {careerCard.phone && (
                    <a
                      href={`tel:${careerCard.phone}`}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      {careerCard.phone}
                    </a>
                  )}
                  {careerCard.location && (
                    <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <MapPin className="w-4 h-4" />
                      {careerCard.location}
                    </span>
                  )}
                  {careerCard.memberSince && (
                    <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <Calendar className="w-4 h-4" />
                      Member since {new Date(careerCard.memberSince).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Section>

              {/* Driver-specific: CDL Info */}
              {isDriver && profile && (
                <Section title="CDL Information" icon={<Award className="w-4 h-4" />} theme={theme}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <InfoItem label="Class" value={profile.cdl_class || 'N/A'} theme={theme} />
                    <InfoItem label="State" value={profile.cdl_state || 'N/A'} theme={theme} />
                    <InfoItem 
                      label="Experience" 
                      value={`${profile.experience_years || profile.years_experience || 0} years`} 
                      theme={theme} 
                    />
                    <InfoItem 
                      label="Expiration" 
                      value={profile.cdl_expiration ? new Date(profile.cdl_expiration).toLocaleDateString() : 'N/A'} 
                      theme={theme} 
                    />
                  </div>
                  {(profile.endorsements?.length || profile.cdl_endorsements?.length) ? (
                    <div className="mt-3">
                      <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Endorsements
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(profile.endorsements || profile.cdl_endorsements || []).map((e, i) => (
                          <span key={i} className={`px-2 py-1 rounded text-xs font-medium ${
                            theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
                          }`}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Section>
              )}

              {/* Developer-specific: Links & Skills */}
              {!isDriver && profile && (
                <>
                  {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
                    <Section title="Links" theme={theme}>
                      <div className="flex flex-wrap gap-3">
                        {profile.github_url && (
                          <a
                            href={profile.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                              theme === 'dark'
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Github className="w-4 h-4" />
                            GitHub
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {profile.linkedin_url && (
                          <a
                            href={profile.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                              theme === 'dark'
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Linkedin className="w-4 h-4" />
                            LinkedIn
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {profile.portfolio_url && (
                          <a
                            href={profile.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                              theme === 'dark'
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Globe className="w-4 h-4" />
                            Portfolio
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </Section>
                  )}
                  {profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
                    <Section title="Skills" theme={theme}>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill, i) => (
                          <span key={i} className={`px-3 py-1 rounded-full text-xs font-medium ${
                            theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {typeof skill === 'string' ? skill : skill.name}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* Resume */}
              <Section 
                title="Resume" 
                icon={<FileText className="w-4 h-4" />} 
                theme={theme}
                action={
                  careerCard.resume && careerCard.resume.ipfsHash && !careerCard.resume.ipfsHash.startsWith('built_') ? (
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${careerCard.resume.ipfsHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 text-sm ${
                        theme === 'dark' ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                      }`}
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : !careerCard.hasResume ? (
                    <ActionButton
                      label="Request Resume"
                      loading={requestLoading === 'document_upload'}
                      disabled={hasPendingRequest('document_upload')}
                      onClick={() => createRequest('document_upload', 'resume')}
                      theme={theme}
                    />
                  ) : null
                }
              >
                {careerCard.resume ? (
                  <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        {careerCard.resume.title || careerCard.resume.filename}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        careerCard.resume.verificationStatus === 'VERIFIED'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {careerCard.resume.verificationStatus}
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No resume uploaded" theme={theme} />
                )}
              </Section>

              {/* MVR (Drivers only) */}
              {isDriver && (
                <Section 
                  title="Motor Vehicle Record" 
                  icon={<Car className="w-4 h-4" />} 
                  theme={theme}
                  action={
                    !careerCard.hasMvr ? (
                      <ActionButton
                        label="Order MVR"
                        loading={requestLoading === 'mvr_order'}
                        disabled={hasPendingRequest('mvr_order')}
                        onClick={() => createRequest('mvr_order')}
                        theme={theme}
                      />
                    ) : null
                  }
                >
                  {careerCard.mvr ? (
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <InfoItem 
                          label="License Status" 
                          value={careerCard.mvr.results?.licenseStatus || 'Pending'} 
                          theme={theme} 
                        />
                        <InfoItem 
                          label="Class" 
                          value={careerCard.mvr.results?.licenseClass || 'N/A'} 
                          theme={theme} 
                        />
                        <InfoItem 
                          label="Points" 
                          value={String(careerCard.mvr.results?.totalPoints ?? 'N/A')} 
                          theme={theme} 
                        />
                        <InfoItem 
                          label="Violations" 
                          value={String(careerCard.mvr.results?.violationCount ?? 'N/A')} 
                          theme={theme} 
                        />
                      </div>
                      {careerCard.mvr.wasOrderedByEmployer && (
                        <p className={`mt-3 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                          * MVR ordered by employer
                        </p>
                      )}
                    </div>
                  ) : (
                    <EmptyState 
                      message="No MVR on file" 
                      subtext={hasPendingRequest('mvr_order') ? 'Request pending' : 'Order an MVR for this candidate'} 
                      theme={theme} 
                    />
                  )}
                </Section>
              )}

              {/* DOT Application (Drivers only) */}
              {isDriver && (
                <Section 
                  title="DOT Application" 
                  icon={<ClipboardCheck className="w-4 h-4" />} 
                  theme={theme}
                >
                  {careerCard.driverApplication ? (
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    }`}>
                      {careerCard.driverApplication.isComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        {careerCard.driverApplication.isComplete ? 'Complete' : 'In Progress'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        careerCard.driverApplication.status === 'VERIFIED'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {careerCard.driverApplication.status}
                      </span>
                    </div>
                  ) : (
                    <EmptyState message="No DOT application on file" theme={theme} />
                  )}
                </Section>
              )}

              {/* Work History */}
              <Section 
                title="Work History" 
                icon={<Briefcase className="w-4 h-4" />} 
                theme={theme}
                action={
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    {careerCard.verifiedJobsCount} verified
                  </span>
                }
              >
                {careerCard.workHistory && careerCard.workHistory.length > 0 ? (
                  <div className="space-y-3">
                    {careerCard.workHistory.slice(0, 5).map((job, i) => {
                      const verification = careerCard.verifications?.find(
                        v => v.employer === job.companyName && v.position === job.position
                      )
                      return (
                        <div key={i} className={`p-3 rounded-lg ${
                          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {job.position || 'Unknown Position'}
                              </p>
                              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                {job.companyName || 'Unknown Company'}
                              </p>
                              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                {job.startDate || '?'} - {job.isCurrent ? 'Present' : job.endDate || '?'}
                              </p>
                            </div>
                            {verification?.status === 'VERIFIED' && (
                              <span className="flex items-center gap-1 text-xs text-green-500">
                                <Shield className="w-3 h-3" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {careerCard.workHistory.length > 5 && (
                      <p className={`text-sm text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        +{careerCard.workHistory.length - 5} more entries
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState message="No work history on file" theme={theme} />
                )}
              </Section>

              {/* Actions Footer */}
              <div className={`pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-wrap gap-3">
                  {profile?.share_token && (
                    <a
                      href={`/${isDriver ? 'd' : 'dev-card'}/${profile.share_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm ${
                        theme === 'dark'
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30'
                          : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Public Profile
                    </a>
                  )}
                  {careerCard.existingApplication ? (
                    <span className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
                      theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700'
                    }`}>
                      <CheckCircle className="w-4 h-4" />
                      Already Applied ({careerCard.existingApplication.status})
                    </span>
                  ) : (
                    <button
                      onClick={openRecruitModal}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                        theme === 'dark'
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      Recruit Candidate
                    </button>
                  )}
                </div>

                {careerCard.pendingRequests && careerCard.pendingRequests.length > 0 && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'
                  }`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      <Clock className="w-4 h-4 inline mr-1" />
                      {careerCard.pendingRequests.length} pending request{careerCard.pendingRequests.length > 1 ? 's' : ''} to this candidate
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const recruitModalContent = showRecruitModal ? (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowRecruitModal(false)}
      />
      <div className={`relative z-[10002] w-full max-w-md rounded-2xl shadow-2xl ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                <UserPlus className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Recruit Candidate
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Select a job for {careerCard?.name || 'this candidate'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRecruitModal(false)}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Job Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Select Job Posting *
            </label>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              </div>
            ) : jobPostings.length === 0 ? (
              <p className={`text-sm py-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No active job postings. Create a job posting first.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {jobPostings.map(job => (
                  <button
                    type="button"
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedJobId === job.id
                        ? theme === 'dark'
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-teal-500 bg-teal-50'
                        : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-600'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selectedJobId === job.id && (
                        <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                      )}
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {job.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Message to Candidate (optional)
            </label>
            <textarea
              value={recruitMessage}
              onChange={e => setRecruitMessage(e.target.value)}
              placeholder="Why you think they'd be a great fit..."
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border resize-none ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          {/* Info */}
          <div className={`p-3 rounded-lg text-sm ${
            theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
          }`}>
            This will create an application for the candidate and notify them via email.
            They'll see this in their hub under "Applications".
          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRecruitModal(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={recruitCandidate}
              disabled={!selectedJobId || recruitLoading}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                !selectedJobId
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {recruitLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Invitation
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {createPortal(modalContent, document.body)}
      {recruitModalContent && createPortal(recruitModalContent, document.body)}
    </>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function Section({ 
  title, 
  icon, 
  action, 
  children, 
  theme 
}: { 
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  theme: string 
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {icon}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoItem({ label, value, theme }: { label: string; value: string; theme: string }) {
  return (
    <div>
      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{label}</p>
      <p className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{value}</p>
    </div>
  )
}

function Badge({ label, color, theme }: { label: string; color: 'green' | 'yellow' | 'red'; theme: string }) {
  const colors = {
    green: theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
    yellow: theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700',
    red: theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[color]}`}>
      {label}
    </span>
  )
}

function EmptyState({ message, subtext, theme }: { message: string; subtext?: string; theme: string }) {
  return (
    <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{message}</p>
      {subtext && (
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{subtext}</p>
      )}
    </div>
  )
}

function ActionButton({ 
  label, 
  loading, 
  disabled, 
  onClick, 
  theme 
}: { 
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  theme: string 
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        disabled
          ? theme === 'dark' ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : theme === 'dark'
            ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
            : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
      }`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : disabled ? (
        <Clock className="w-3 h-3" />
      ) : (
        <Send className="w-3 h-3" />
      )}
      {disabled ? 'Pending' : label}
    </button>
  )
}
