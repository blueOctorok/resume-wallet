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
  ExternalLink,
  FileText,
  ClipboardCheck,
  Car,
  Shield,
  Mail,
  Phone,
  UserPlus,
  Eye,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'

interface Driver {
  driverId: string
  profileId: string
  name: string
  email: string | null
  phone: string | null
  location: string | null
  professionalSummary: string | null
  cdlClass: string | null
  cdlState: string | null
  cdlExpiration: string | null
  endorsements: string[]
  experienceYears: number | null
  hasResume: boolean
  hasVerifiedResume: boolean
  resumeId: string | null
  resumeTitle: string | null
  resumeIpfsHash: string | null
  hasCompleteDotApp: boolean
  dotAppVerified: boolean
  mvrStatus: string | null
  mvrViolations: number
  mvrPoints: number
  hasCleanMvr: boolean
  shareToken: string | null
  shareEnabled: boolean
  hasApplied: boolean
  profileCreatedAt: string
}

interface Job {
  id: string
  title: string
  is_active: boolean
}

interface FindDriversPageProps {
  walletAddress: string
  onBack: () => void
}

export default function FindDriversPage({ walletAddress, onBack }: FindDriversPageProps) {
  const { theme } = useTheme()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [filters, setFilters] = useState({
    cdlClass: '',
    cdlState: '',
    minExperience: '',
    locationState: '',
    locationCity: '',
    hasVerifiedResume: false,
    hasCompleteDotApp: false,
    hasCleanMvr: false,
  })
  const [showFilters, setShowFilters] = useState(true)
  
  // Selected driver for detail view
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)

  useEffect(() => {
    if (selectedJob !== 'all' || Object.values(filters).some(v => v !== '' && v !== false)) {
      searchDrivers()
    }
  }, [selectedJob, filters])

  const searchDrivers = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedJob !== 'all') params.append('jobId', selectedJob)
      if (filters.cdlClass) params.append('cdlClass', filters.cdlClass)
      if (filters.cdlState) params.append('cdlState', filters.cdlState)
      if (filters.minExperience) params.append('minExperience', filters.minExperience)
      if (filters.locationState) params.append('locationState', filters.locationState)
      if (filters.locationCity) params.append('locationCity', filters.locationCity)
      if (filters.hasVerifiedResume) params.append('hasVerifiedResume', 'true')
      if (filters.hasCompleteDotApp) params.append('hasCompleteDotApp', 'true')
      if (filters.hasCleanMvr) params.append('hasCleanMvr', 'true')

      const response = await fetch(`/api/employer/drivers/search?${params}`, {
        headers: { 'x-wallet-address': walletAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to search drivers')
      }

      const data = await response.json()
      setDrivers(data.drivers || [])
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Error searching drivers:', err)
      setError('Failed to search drivers')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      cdlClass: '',
      cdlState: '',
      minExperience: '',
      locationState: '',
      locationCity: '',
      hasVerifiedResume: false,
      hasCompleteDotApp: false,
      hasCleanMvr: false,
    })
    setSelectedJob('all')
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
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Find Drivers
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Search for qualified drivers who match your job criteria
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl p-6 mb-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
          : 'bg-white border border-brand-sage/20 shadow-xl'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Search Criteria
          </h2>
          <button
            onClick={clearFilters}
            className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Match to Job */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Match to Job
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
            >
              <option value="all">All Drivers</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
          </div>

          {/* CDL Class */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              CDL Class
            </label>
            <select
              value={filters.cdlClass}
              onChange={(e) => setFilters({ ...filters, cdlClass: e.target.value })}
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
            >
              <option value="">Any Class</option>
              <option value="A">Class A</option>
              <option value="B">Class B</option>
              <option value="C">Class C</option>
            </select>
          </div>

          {/* CDL State */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              CDL State
            </label>
            <input
              type="text"
              placeholder="e.g., OH, TX, CA"
              value={filters.cdlState}
              onChange={(e) => setFilters({ ...filters, cdlState: e.target.value.toUpperCase().slice(0, 2) })}
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
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
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* Location State */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Location State
            </label>
            <input
              type="text"
              placeholder="e.g., OH, TX, CA"
              value={filters.locationState}
              onChange={(e) => setFilters({ ...filters, locationState: e.target.value.toUpperCase().slice(0, 2) })}
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* Location City */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Location City
            </label>
            <input
              type="text"
              placeholder="e.g., Columbus"
              value={filters.locationCity}
              onChange={(e) => setFilters({ ...filters, locationCity: e.target.value })}
              className={`w-full px-4 py-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 ${
                theme === 'dark' ? 'focus:ring-brand-mint' : 'focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasVerifiedResume}
              onChange={(e) => setFilters({ ...filters, hasVerifiedResume: e.target.checked })}
              className="w-4 h-4"
            />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Has Verified Resume
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasCompleteDotApp}
              onChange={(e) => setFilters({ ...filters, hasCompleteDotApp: e.target.checked })}
              className="w-4 h-4"
            />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Complete DOT Application
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasCleanMvr}
              onChange={(e) => setFilters({ ...filters, hasCleanMvr: e.target.checked })}
              className="w-4 h-4"
            />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Clean MVR Record
            </span>
          </label>
        </div>

        {/* Search Button */}
        <button
          onClick={searchDrivers}
          disabled={loading}
          className={`mt-6 w-full md:w-auto px-8 py-3 rounded-xl font-semibold ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90'
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            <>
              <Search className="w-5 h-5 inline mr-2" />
              Search Drivers
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className={`w-12 h-12 animate-spin ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>
      )}

      {error && (
        <div className={`p-6 rounded-xl text-center ${
          theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
        }`}>
          {error}
        </div>
      )}

      {!loading && !error && drivers.length === 0 && (
        <div className={`p-12 rounded-xl text-center ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <Search className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={`text-lg font-semibold mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            No drivers found
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            Try adjusting your search criteria or select a job to match drivers automatically
          </p>
        </div>
      )}

      {!loading && !error && drivers.length > 0 && (
        <>
          <div className="mb-4">
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Found {drivers.length} driver{drivers.length !== 1 ? 's' : ''} matching your criteria
            </p>
          </div>
          <div className="space-y-3">
            {drivers.map(driver => (
              <DriverCard
                key={driver.driverId}
                driver={driver}
                onClick={() => setSelectedDriver(driver)}
                theme={theme}
              />
            ))}
          </div>
        </>
      )}

      {/* Driver Detail Modal */}
      {selectedDriver && (
        <DriverDetailModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          theme={theme}
        />
      )}
    </div>
  )
}

// Sub-components

function DriverCard({ driver, onClick, theme }: {
  driver: Driver
  onClick: () => void
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
            {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {driver.name}
                </h3>
                {driver.hasApplied && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                    Already Applied
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-xs">
                {driver.location && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <MapPin className="w-3 h-3" />
                    {driver.location}
                  </span>
                )}
                {driver.cdlClass && (
                  <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <Award className="w-3 h-3" />
                    CDL {driver.cdlClass} • {driver.experienceYears || 0} yrs
                  </span>
                )}
              </div>

              {/* Credentials */}
              <div className="flex items-center gap-3 mt-2">
                {driver.hasVerifiedResume && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle className="w-3 h-3" />
                    Verified Resume
                  </span>
                )}
                {driver.hasCompleteDotApp && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle className="w-3 h-3" />
                    Complete DOT App
                  </span>
                )}
                {driver.hasCleanMvr && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle className="w-3 h-3" />
                    Clean MVR
                  </span>
                )}
              </div>
            </div>

            <Eye className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          </div>
        </div>
      </div>
    </button>
  )
}

function DriverDetailModal({ driver, onClose, theme }: {
  driver: Driver
  onClose: () => void
  theme: string
}) {
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
              {driver.name}
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Driver Profile
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
          {(driver.email || driver.phone) && (
            <div className="flex flex-wrap gap-3">
              {driver.email && (
                <a
                  href={`mailto:${driver.email}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                    theme === 'dark'
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  {driver.email}
                </a>
              )}
              {driver.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                    theme === 'dark'
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  {driver.phone}
                </a>
              )}
            </div>
          )}

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
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.cdlClass || 'N/A'}</p>
              </div>
              <div>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>State</p>
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.cdlState || 'N/A'}</p>
              </div>
              <div>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Experience</p>
                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.experienceYears || 0} years</p>
              </div>
            </div>
            {driver.endorsements && driver.endorsements.length > 0 && (
              <div className="mt-3">
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Endorsements: {driver.endorsements.join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Credentials */}
          <div>
            <h4 className={`font-medium mb-3 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <Shield className="w-4 h-4" />
              Verified Credentials
            </h4>
            <div className="space-y-2">
              {driver.hasVerifiedResume && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-500" />
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      Verified Resume
                    </span>
                  </div>
                  {driver.resumeIpfsHash && !driver.resumeIpfsHash.startsWith('built_') && (
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${driver.resumeIpfsHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-mint hover:underline"
                    >
                      View <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  )}
                </div>
              )}
              {driver.hasCompleteDotApp && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <ClipboardCheck className="w-4 h-4 text-green-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Complete DOT Application {driver.dotAppVerified && '(Verified)'}
                  </span>
                </div>
              )}
              {driver.hasCleanMvr && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Car className="w-4 h-4 text-green-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Clean MVR Record
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MVR Details */}
          {driver.mvrStatus && (
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
              <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Motor Vehicle Record
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Status</p>
                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.mvrStatus}</p>
                </div>
                <div>
                  <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Violations</p>
                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.mvrViolations}</p>
                </div>
                <div>
                  <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Points</p>
                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{driver.mvrPoints}</p>
                </div>
              </div>
            </div>
          )}

          {/* Professional Summary */}
          {driver.professionalSummary && (
            <div>
              <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Professional Summary
              </h4>
              <p className={`text-sm p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800/50 text-gray-300' : 'bg-gray-50 text-gray-700'
              }`}>
                {driver.professionalSummary}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 space-y-3">
            {driver.shareEnabled && driver.shareToken && (
              <a
                href={`/d/${driver.shareToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm ${
                  theme === 'dark'
                    ? 'bg-brand-mint/20 text-brand-mint border border-brand-mint/40 hover:bg-brand-mint/30'
                    : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'
                }`}
              >
                <Eye className="w-4 h-4" />
                View Full Profile
              </a>
            )}
            {driver.hasApplied && (
              <div className={`p-3 rounded-xl text-center text-sm ${
                theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                This driver has already applied to one of your jobs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
