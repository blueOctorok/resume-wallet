'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Search,
  Filter,
  MapPin,
  Award,
  Briefcase,
  CheckCircle,
  X,
  Loader2,
  FileText,
  ClipboardCheck,
  Car,
  Shield,
  Code,
  Users,
  ChevronDown,
  Star,
  TrendingUp,
} from 'lucide-react'
import CareerCardModal from './CareerCardModal'

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
  cdlClass: string | null
  endorsements: string[]
  completenessScore: number
  hasMvr: boolean
  hasDriverApp: boolean
  hasResume: boolean
  verifiedJobsCount: number
  memberSince: string
  hasApplied: boolean
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
    role: '' as '' | 'driver' | 'developer',
    cdlClass: '',
    state: '',
    minExperience: '',
    hasMvr: false,
    hasDriverApp: false,
    search: '',
  })
  const [showFilters, setShowFilters] = useState(true)
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 25
  
  // Selected candidate for detail view
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

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
      if (filters.role) params.append('role', filters.role)
      if (filters.cdlClass) params.append('cdlClass', filters.cdlClass)
      if (filters.state) params.append('state', filters.state)
      if (filters.minExperience) params.append('minExperience', filters.minExperience)
      if (filters.hasMvr) params.append('hasMvr', 'true')
      if (filters.hasDriverApp) params.append('hasDriverApp', 'true')
      if (filters.search) params.append('search', filters.search)
      params.append('limit', String(LIMIT))
      params.append('offset', String(currentOffset))

      const response = await fetch(`/api/employer/talent/search?${params}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

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
      role: '',
      cdlClass: '',
      state: '',
      minExperience: '',
      hasMvr: false,
      hasDriverApp: false,
      search: '',
    })
  }

  const activeFilterCount = [
    filters.role,
    filters.cdlClass,
    filters.state,
    filters.minExperience,
    filters.hasMvr,
    filters.hasDriverApp,
  ].filter(Boolean).length

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
            Find Talent
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Search for qualified drivers and developers who match your criteria
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className={`rounded-2xl p-4 mb-4 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border border-gray-700'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search by name, city, or email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
              theme === 'dark'
                ? 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            } ${activeFilterCount > 0 ? 'ring-2 ring-teal-500/50' : ''}`}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`rounded-2xl p-6 mb-6 ${
          theme === 'dark'
            ? 'bg-gray-800/50 border border-gray-700'
            : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Search Filters
            </h2>
            <button
              onClick={clearFilters}
              className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Role Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value as '' | 'driver' | 'developer' })}
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              >
                <option value="">All Roles</option>
                <option value="driver">Drivers</option>
                <option value="developer">Developers</option>
              </select>
            </div>

            {/* CDL Class (shown for all/drivers) */}
            {filters.role !== 'developer' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  CDL Class
                </label>
                <select
                  value={filters.cdlClass}
                  onChange={(e) => setFilters({ ...filters, cdlClass: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                >
                  <option value="">Any Class</option>
                  <option value="A">Class A</option>
                  <option value="B">Class B</option>
                  <option value="C">Class C</option>
                </select>
              </div>
            )}

            {/* State */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                State
              </label>
              <input
                type="text"
                placeholder="e.g., OH, TX, CA"
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value.toUpperCase().slice(0, 2) })}
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              />
            </div>

            {/* Min Experience */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Min Experience (years)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={filters.minExperience}
                onChange={(e) => setFilters({ ...filters, minExperience: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-700/50">
            {filters.role !== 'developer' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasMvr}
                    onChange={(e) => setFilters({ ...filters, hasMvr: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500"
                  />
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Has MVR Record
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasDriverApp}
                    onChange={(e) => setFilters({ ...filters, hasDriverApp: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500"
                  />
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Complete DOT Application
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {loading && candidates.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className={`w-12 h-12 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>
      )}

      {error && (
        <div className={`p-6 rounded-xl text-center ${
          theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
        }`}>
          {error}
        </div>
      )}

      {!loading && !error && candidates.length === 0 && (
        <div className={`p-12 rounded-2xl text-center ${
          theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50'
        }`}>
          <Users className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={`text-lg font-semibold mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            No candidates found
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            Try adjusting your search criteria or filters
          </p>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Found {candidates.length}{hasMore ? '+' : ''} candidate{candidates.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="space-y-3">
            {candidates.map(candidate => (
              <CandidateCard
                key={candidate.userId}
                candidate={candidate}
                onClick={() => setSelectedCandidateId(candidate.userId)}
                theme={theme}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className={`px-8 py-3 rounded-xl font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Career Card Modal */}
      {selectedCandidateId && (
        <CareerCardModal
          candidateUserId={selectedCandidateId}
          walletAddress={walletAddress}
          onClose={() => setSelectedCandidateId(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function CandidateCard({ candidate, onClick, theme }: {
  candidate: Candidate
  onClick: () => void
  theme: string
}) {
  const isDriver = candidate.cdlClass !== null
  
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
        theme === 'dark'
          ? 'bg-gray-800/50 border border-gray-700 hover:bg-gray-800 hover:border-gray-600'
          : 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDriver
            ? theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'
            : theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
        }`}>
          {isDriver ? (
            <Car className={`w-6 h-6 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
          ) : (
            <Code className={`w-6 h-6 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {candidate.name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isDriver
                    ? 'bg-teal-500/20 text-teal-400'
                    : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {isDriver ? 'Driver' : 'Developer'}
                </span>
                {candidate.hasApplied && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    Applied
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                {candidate.location && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <MapPin className="w-3 h-3" />
                    {candidate.location}
                  </span>
                )}
                {isDriver && candidate.cdlClass && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <Award className="w-3 h-3" />
                    CDL {candidate.cdlClass}
                  </span>
                )}
                {candidate.yearsExperience !== null && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <Briefcase className="w-3 h-3" />
                    {candidate.yearsExperience} yrs exp
                  </span>
                )}
              </div>

              {/* Credentials */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {candidate.hasResume && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <FileText className="w-3 h-3" />
                    Resume
                  </span>
                )}
                {candidate.hasDriverApp && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <ClipboardCheck className="w-3 h-3" />
                    DOT App
                  </span>
                )}
                {candidate.hasMvr && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Car className="w-3 h-3" />
                    MVR
                  </span>
                )}
                {candidate.verifiedJobsCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Shield className="w-3 h-3" />
                    {candidate.verifiedJobsCount} Verified
                  </span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="text-right flex-shrink-0">
              <div className={`flex items-center gap-1 ${
                candidate.completenessScore >= 80 ? 'text-green-500' :
                candidate.completenessScore >= 60 ? 'text-yellow-500' :
                candidate.completenessScore >= 40 ? 'text-orange-500' :
                'text-gray-500'
              }`}>
                <TrendingUp className="w-4 h-4" />
                <span className="font-semibold">{candidate.completenessScore}%</span>
              </div>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                Profile Score
              </p>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
