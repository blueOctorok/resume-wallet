'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Search,
  Filter,
  MapPin,
  CheckCircle,
  Loader2,
  FileText,
  Shield,
  Users,
  ChevronDown,
  TrendingUp,
  UserPlus,
  Send,
  User,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import CareerCardModal from './CareerCardModal'
import { BLOCK_CATEGORIES, getBlocksByCategory } from '@/lib/block-registry'

// ============================================================
// TYPES
// ============================================================

interface Candidate {
  userId: string
  name: string
  email: string | null
  location: string | null
  state: string | null
  yearsExperience: number | null
  completenessScore: number
  hasResume: boolean
  verifiedJobsCount: number
  memberSince: string
  hasApplied: boolean
  role: string | null
}

interface Job {
  id: string
  title: string
  target_role: string | null
  is_active: boolean
}

interface TalentSearchPageProps {
  walletAddress: string
  onBack: () => void
}

// ============================================================
// COMPONENT
// ============================================================

export default function TalentSearchPage({ walletAddress, onBack }: TalentSearchPageProps) {
  const { theme } = useTheme()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [filters, setFilters] = useState({
    state: '',
    minExperience: '',
    search: '',
    /** When set, user can pick block types from that category (registry-driven). */
    careerCategoryId: '',
    /** Hub block_type ids — API requires candidate to have all selected blocks. */
    blockTypes: [] as string[],
  })
  const [showFilters, setShowFilters] = useState(true)
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 25
  
  // Selected candidate for full career card modal
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // Quick "Add to Pipeline" state — holds the candidate being recruited
  const [quickRecruitId, setQuickRecruitId] = useState<string | null>(null)
  const [quickJobId, setQuickJobId] = useState<string | null>(null)
  const [useTalentPool, setUseTalentPool] = useState(false)
  const [quickRecruiting, setQuickRecruiting] = useState(false)
  const [quickRecruitResult, setQuickRecruitResult] = useState<'success' | 'error' | null>(null)

  const openQuickRecruit = (e: React.MouseEvent, candidateId: string) => {
    e.stopPropagation()
    setQuickRecruitId(candidateId)
    setQuickJobId(null)
    setUseTalentPool(false)
    setQuickRecruitResult(null)
  }

  const closeQuickRecruit = () => {
    setQuickRecruitId(null)
    setQuickJobId(null)
    setUseTalentPool(false)
    setQuickRecruiting(false)
    setQuickRecruitResult(null)
  }

  const submitQuickRecruit = async () => {
    if (!quickRecruitId) return
    // Must pick a job OR use talent pool
    if (!quickJobId && !useTalentPool) return

    try {
      setQuickRecruiting(true)
      const res = await fetch(`/api/employer/talent/${quickRecruitId}/recruit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          useTalentPool
            ? { talentPool: true }
            : { jobPostingId: quickJobId }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add to pipeline')
      setQuickRecruitResult('success')
      // Mark the candidate as applied in local state so the badge shows
      setCandidates(prev =>
        prev.map(c => c.userId === quickRecruitId ? { ...c, hasApplied: true } : c)
      )
      setTimeout(closeQuickRecruit, 1800)
    } catch {
      setQuickRecruitResult('error')
    } finally {
      setQuickRecruiting(false)
    }
  }

  // Search on filter change (debounced for text input)
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCandidates(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters])

  const searchCandidates = async (resetPagination = false) => {
    try {
      setLoading(true)
      setError(null)

      const currentOffset = resetPagination ? 0 : offset

      const params = new URLSearchParams()
      if (filters.state) params.append('state', filters.state)
      if (filters.minExperience) params.append('minExperience', filters.minExperience)
      if (filters.search) params.append('search', filters.search)
      if (filters.blockTypes.length > 0) {
        params.append('blockTypes', filters.blockTypes.join(','))
      }
      params.append('limit', String(LIMIT))
      params.append('offset', String(currentOffset))

      const response = await fetch(`/api/employer/talent/search?${params}`)

      if (!response.ok) {
        const data = await response.json()
        const message = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to search candidates')
        throw new Error(message)
      }

      const data = await response.json()
      
      if (resetPagination) {
        setCandidates(data.candidates || [])
        setOffset(0)
      } else {
        setCandidates(prev => [...prev, ...(data.candidates || [])])
      }
      
      setJobs(data.jobs || [])
      setHasMore(data.pagination?.hasMore || false)
      
    } catch (err) {
      console.error('Error searching candidates:', err)
      setError(err instanceof Error ? err.message : 'Failed to search candidates')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    searchCandidates(false)
  }

  const clearFilters = () => {
    setFilters({
      state: '',
      minExperience: '',
      search: '',
      careerCategoryId: '',
      blockTypes: [],
    })
  }

  const activeFilterCount =
    [filters.state, filters.minExperience].filter(Boolean).length +
    filters.blockTypes.length

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
            Find Talent
          </h1>
          <p className={`mt-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
            Search for qualified candidates who match your criteria
          </p>
        </div>
      </div>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="sky" className="mb-4">
        <BlockCard variant="embed" icon={Search} title="Search" description="Name, city, or email — then refine with filters.">
          <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search by name, city, or email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                isDarkTheme(theme)
                  ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className={cn(
              'shrink-0 gap-2 rounded-xl py-3',
              activeFilterCount > 0 && 'ring-2 ring-teal-500/50',
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-5 w-5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-teal-500 px-2 py-0.5 text-xs text-white">{activeFilterCount}</span>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')} />
          </Button>
        </div>
        </BlockCard>
      </HubSectionPanel>

      {showFilters && (
        <HubSectionPanel isDark={isDarkTheme(theme)} accent="sky" className="mb-6">
          <BlockCard
            variant="embed"
            icon={Filter}
            title="Filters"
            description="Location, experience, and hub blocks candidates must have."
            headerActions={
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            }
          >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* State */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                State
              </label>
              <input
                type="text"
                placeholder="e.g., OH, TX, CA"
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value.toUpperCase().slice(0, 2) })}
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  isDarkTheme(theme)
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              />
            </div>

            {/* Min Experience */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                Min Experience (years)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={filters.minExperience}
                onChange={(e) => setFilters({ ...filters, minExperience: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  isDarkTheme(theme)
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              />
            </div>

            {/* Career focus + blocks (registry-driven — scales when new categories are added) */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                Career focus
              </label>
              <select
                value={filters.careerCategoryId}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    careerCategoryId: e.target.value,
                    blockTypes: [],
                  })
                }
                className={`w-full max-w-md px-4 py-2.5 rounded-xl border ${
                  isDarkTheme(theme)
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              >
                <option value="">Any (no block filter)</option>
                {BLOCK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {filters.careerCategoryId ? (
                <p className={`text-xs mt-2 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                  Candidates must have <strong>all</strong> checked blocks installed in their hub.
                </p>
              ) : null}
              {filters.careerCategoryId ? (
                <div className="flex flex-wrap gap-3 mt-3">
                  {getBlocksByCategory(filters.careerCategoryId).map((b) => (
                    <label
                      key={b.id}
                      className={`flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border ${
                        isDarkTheme(theme)
                          ? 'border-gray-600 bg-gray-900/80'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-400"
                        checked={filters.blockTypes.includes(b.id)}
                        onChange={() => {
                          setFilters((f) => ({
                            ...f,
                            blockTypes: f.blockTypes.includes(b.id)
                              ? f.blockTypes.filter((x) => x !== b.id)
                              : [...f.blockTypes, b.id],
                          }))
                        }}
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          </BlockCard>
        </HubSectionPanel>
      )}

      <HubSectionPanel isDark={isDarkTheme(theme)} accent="sky" className="mb-6">
        <BlockCard
          variant="embed"
          icon={Users}
          title="Results"
          description="Verified-forward profiles — tap a row for the full career card."
        >
          {loading && candidates.length === 0 && (
            <div className="flex justify-center py-12">
              <Loader2
                className={`h-12 w-12 animate-spin ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`}
              />
            </div>
          )}

          {error && (
            <div
              className={`rounded-xl p-6 text-center ${
                isDarkTheme(theme) ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              }`}
            >
              {error}
            </div>
          )}

          {!loading && !error && candidates.length === 0 && (
            <div
              className={`rounded-xl p-12 text-center ${
                isDarkTheme(theme) ? 'border border-gray-700 bg-gray-800/50' : 'bg-gray-50'
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
                No candidates found
              </p>
              <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                Try adjusting your search criteria or filters
              </p>
            </div>
          )}

          {candidates.length > 0 && (
            <>
              <p className={`mb-4 text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Found {candidates.length}
                {hasMore ? '+' : ''} candidate{candidates.length !== 1 ? 's' : ''}
              </p>

              <div className="space-y-3">
                {candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.userId}
                    candidate={candidate}
                    onClick={() => setSelectedCandidateId(candidate.userId)}
                    onAddToPipeline={(e) => openQuickRecruit(e, candidate.userId)}
                    theme={theme}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <Button type="button" variant="secondary" size="md" onClick={loadMore} disabled={loading}>
                    {loading ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </BlockCard>
      </HubSectionPanel>

      {/* Career Card Modal */}
      {selectedCandidateId && (
        <CareerCardModal
          candidateUserId={selectedCandidateId}
          walletAddress={walletAddress}
          onClose={() => setSelectedCandidateId(null)}
        />
      )}

      {/* Quick "Add to Pipeline" modal */}
      {quickRecruitId && (
        <Modal onClose={closeQuickRecruit} maxWidth="max-w-sm" zIndex={9999}>
          <ModalHeader
            title="Add to Pipeline"
            subtitle={candidates.find(c => c.userId === quickRecruitId)?.name}
            onClose={closeQuickRecruit}
          />

          {/* Body */}
          <div className="p-5">
              {quickRecruitResult === 'success' ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                  <p className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                    Added to pipeline!
                  </p>
                  <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                    {useTalentPool
                      ? 'Saved to your Talent Pool for future opportunities.'
                      : 'They\'ll appear in your Hiring Pipeline under "New".'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Talent Pool option — always visible */}
                  <button
                    onClick={() => { setUseTalentPool(true); setQuickJobId(null) }}
                    className={`w-full text-left p-3 rounded-xl border transition-all mb-3 ${
                      useTalentPool
                        ? isDarkTheme(theme)
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-purple-500 bg-purple-50'
                        : isDarkTheme(theme)
                          ? 'border-gray-700 hover:border-gray-600'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        useTalentPool ? 'border-purple-500 bg-purple-500' : isDarkTheme(theme) ? 'border-gray-500' : 'border-gray-300'
                      }`}>
                        {useTalentPool && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                          Save to Talent Pool
                        </span>
                        <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                          No specific job yet — save for future opportunities
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Divider */}
                  {jobs.filter(j => j.is_active).length > 0 && (
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex-1 h-px ${isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'}`} />
                      <span className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>or select a job</span>
                      <div className={`flex-1 h-px ${isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    </div>
                  )}

                  {/* Job selection */}
                  {jobs.filter(j => j.is_active).length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                      {jobs.filter(j => j.is_active).map(job => (
                        <button
                          key={job.id}
                          onClick={() => { setQuickJobId(job.id); setUseTalentPool(false) }}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            quickJobId === job.id
                              ? isDarkTheme(theme)
                                ? 'border-teal-500 bg-teal-500/10'
                                : 'border-teal-500 bg-teal-50'
                              : isDarkTheme(theme)
                                ? 'border-gray-700 hover:border-gray-600'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              quickJobId === job.id ? 'border-teal-500 bg-teal-500' : isDarkTheme(theme) ? 'border-gray-500' : 'border-gray-300'
                            }`}>
                              {quickJobId === job.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={`text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                              {job.title}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {quickRecruitResult === 'error' && (
                    <p className="text-sm text-red-400 mb-3">Something went wrong. They may already be in your pipeline.</p>
                  )}

                  <button
                    onClick={submitQuickRecruit}
                    disabled={(!quickJobId && !useTalentPool) || quickRecruiting}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      (!quickJobId && !useTalentPool)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : useTalentPool
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    {quickRecruiting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                    {useTalentPool ? 'Save to Talent Pool' : 'Add to Pipeline'}
                  </button>
                </>
              )}
            </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function CandidateCard({
  candidate,
  onClick,
  onAddToPipeline,
  theme,
}: {
  candidate: Candidate
  onClick: () => void
  onAddToPipeline: (e: React.MouseEvent) => void
  theme: string
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={`w-full text-left p-4 rounded-xl transition-all duration-200 cursor-pointer ${
        isDarkTheme(theme)
          ? 'bg-gray-800/50 border border-gray-700 hover:bg-gray-800 hover:border-gray-600'
          : 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar — neutral teal for all candidates */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDarkTheme(theme) ? 'bg-teal-500/20' : 'bg-teal-100'
        }`}>
          <User className={`w-6 h-6 ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold truncate ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                  {candidate.name}
                </h3>
                {candidate.hasApplied && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    In Pipeline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                {candidate.location && (
                  <span className={`flex items-center gap-1 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                    <MapPin className="w-3 h-3" />
                    {candidate.location}
                  </span>
                )}
              </div>

              {/* Credentials — universal only */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {candidate.hasResume && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <FileText className="w-3 h-3" />
                    Resume
                  </span>
                )}
                {candidate.verifiedJobsCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
                    <Shield className="w-3 h-3" />
                    {candidate.verifiedJobsCount} employer
                    {candidate.verifiedJobsCount === 1 ? '' : 's'} confirmed
                  </span>
                )}
              </div>
            </div>

            {/* Right side: score + pipeline button */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 ${
                candidate.completenessScore >= 80 ? 'text-green-500' :
                candidate.completenessScore >= 60 ? 'text-yellow-500' :
                candidate.completenessScore >= 40 ? 'text-orange-500' :
                'text-gray-500'
              }`}>
                <TrendingUp className="w-4 h-4" />
                <span className="font-semibold">{candidate.completenessScore}%</span>
              </div>
              <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                Profile Score
              </p>
              {/* Add to Pipeline button — stopPropagation so it doesn't open the modal */}
              {!candidate.hasApplied && (
                <button
                  onClick={onAddToPipeline}
                  className={`mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDarkTheme(theme)
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Pipeline
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
