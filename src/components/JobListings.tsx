'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  MapPin,
  DollarSign,
  ExternalLink,
  Briefcase,
  Filter,
  FileText,
  Zap,
  Globe,
  Building2,
  Loader2,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import BackToHubButton from './ui/BackToHubButton'
import dynamic from 'next/dynamic'

const ApplyWithStormChainModal = dynamic(() => import('./ApplyWithStormChainModal'), {
  ssr: false,
})

// ── Shared job shape (both sources normalize to this) ─────────────────────────

interface JobListing {
  id: string
  title: string
  company: string
  companyLogoUrl?: string | null
  location: string
  description: string | null
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  created: string
  redirectUrl: string | null
  category: string | null
  contractType: string | null
  isStormChain: boolean
  jobType: string | null
  targetRole: string | null
  remoteAllowed: boolean | null
}

type TabId = 'stormchain' | 'external'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSalary(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`
  if (min) return `$${min.toLocaleString()}+`
  if (max) return `Up to $${max.toLocaleString()}`
  return null
}

function stripHtml(html: string): string {
  const tmp = document.createElement('DIV')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

function truncateText(text: string, max = 200): string {
  const clean = stripHtml(text)
  return clean.length <= max ? clean : clean.substring(0, max) + '...'
}

function formatDate(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`
  return new Date(dateString).toLocaleDateString()
}

// ── Main Component ────────────────────────────────────────────────────────────

interface JobListingsProps {
  onClose?: () => void
  onBack: () => void
  userAddress: string | null
}

export default function JobListings({ onBack, userAddress }: JobListingsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<TabId>('stormchain')
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'date' | 'salary'>('date')
  const [showFilters, setShowFilters] = useState(false)

  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null)

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStormChainJobs = useCallback(async (page: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: sortBy,
      })
      if (keywords) params.set('keywords', keywords)
      if (location) params.set('location', location)

      const res = await fetch(`/api/jobs/search?${params}`)
      if (!res.ok) throw new Error('Failed to fetch StormChain jobs')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to load jobs')

      const mapped: JobListing[] = (data.results || []).map((j: Record<string, unknown>) => ({
        id: j.id as string,
        title: j.title as string,
        company: j.company as string,
        companyLogoUrl: j.companyLogoUrl ?? null,
        location: [j.locationCity, j.locationState].filter(Boolean).join(', ') || 'Remote',
        description: j.description as string | null,
        salary: formatSalary(j.salaryMin as number | null, j.salaryMax as number | null),
        salaryMin: j.salaryMin as number | null,
        salaryMax: j.salaryMax as number | null,
        created: j.createdAt as string,
        redirectUrl: null,
        category: j.targetRole as string | null,
        contractType: j.jobType as string | null,
        isStormChain: true,
        jobType: j.jobType as string | null,
        targetRole: j.targetRole as string | null,
        remoteAllowed: j.remoteAllowed as boolean | null,
      }))

      setJobs(mapped)
      setTotalCount(data.count ?? mapped.length)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setIsLoading(false)
    }
  }, [keywords, location, sortBy])

  const fetchExternalJobs = useCallback(async (page: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        keywords: keywords || 'jobs',
        location,
        page: page.toString(),
        results_per_page: '20',
        sort_by: sortBy === 'salary' ? 'salary' : 'date',
      })

      const res = await fetch(`/api/jobs/external/search?${params}`)
      if (!res.ok) throw new Error('Failed to fetch external jobs')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to load jobs')

      const mapped: JobListing[] = (data.results || []).map((j: Record<string, unknown>) => ({
        id: j.id as string,
        title: j.title as string,
        company: j.company as string,
        companyLogoUrl: null,
        location: j.location as string,
        description: j.description as string | null,
        salary: j.salary as string | null,
        salaryMin: j.salary_min as number | null,
        salaryMax: j.salary_max as number | null,
        created: j.created as string,
        redirectUrl: j.redirect_url as string | null,
        category: j.category as string | null,
        contractType: j.contract_type as string | null,
        isStormChain: false,
        jobType: j.contract_type as string | null,
        targetRole: null,
        remoteAllowed: null,
      }))

      setJobs(mapped)
      setTotalCount(data.count ?? mapped.length)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setIsLoading(false)
    }
  }, [keywords, location, sortBy])

  const fetchJobs = useCallback((page = 1) => {
    if (activeTab === 'stormchain') return fetchStormChainJobs(page)
    return fetchExternalJobs(page)
  }, [activeTab, fetchStormChainJobs, fetchExternalJobs])

  // Fetch on mount and when tab changes
  useEffect(() => {
    fetchJobs(1)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchJobs(1)
  }

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setJobs([])
    setTotalCount(0)
    setCurrentPage(1)
    setError(null)
  }

  const cardClass = isDark
    ? 'bg-gray-800/50 border border-gray-700'
    : 'bg-white border border-gray-200'

  const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'stormchain', label: 'StormChain', icon: <Zap className='w-4 h-4' />, description: 'Jobs from verified employers on StormChain' },
    { id: 'external', label: 'External', icon: <Globe className='w-4 h-4' />, description: 'Aggregated listings from job boards' },
  ]

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <BackToHubButton onClick={onBack} className='mb-4' />
          <h1 className={`text-3xl md:text-4xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Find Jobs
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {totalCount > 0 ? `${totalCount.toLocaleString()} jobs found` : 'Search for your next opportunity'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className={`flex gap-2 p-1 rounded-xl mb-6 ${isDark ? 'bg-gray-800/60' : 'bg-gray-100'}`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {TABS.find(t => t.id === activeTab)?.description}
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className='mb-6'>
          <div className={`rounded-2xl p-6 ${cardClass}`}>
            <div className='flex flex-col md:flex-row gap-3 mb-3'>
              <div className='flex-1 relative'>
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <input
                  type='text'
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder='Job title, keywords...'
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    isDark
                      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              <div className='flex-1 relative'>
                <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <input
                  type='text'
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder='City, state, or zip code'
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    isDark
                      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              <button
                type='submit'
                disabled={isLoading}
                className='px-6 py-3 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap bg-teal-600 hover:bg-teal-500 text-white'
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <button
              type='button'
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-sm ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'}`}
            >
              <Filter className='w-4 h-4' />
              {showFilters ? 'Hide' : 'Show'} filters
            </button>

            {showFilters && (
              <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Sort by
                </label>
                <div className='flex gap-2 flex-wrap'>
                  {(['date', 'salary'] as const).map((sort) => (
                    <button
                      key={sort}
                      type='button'
                      onClick={() => setSortBy(sort)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        sortBy === sort
                          ? 'bg-teal-600 text-white'
                          : isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {sort === 'date' ? 'Most Recent' : 'Highest Salary'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-red-800 dark:text-red-200'>{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        )}

        {/* Job Cards */}
        {!isLoading && jobs.length > 0 && (
          <div className='space-y-4'>
            {jobs.map((job) => (
              <div key={job.id} className={`rounded-2xl p-6 transition-all hover:shadow-lg ${cardClass}`}>
                <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      {job.isStormChain && (
                        <span className='inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-500'>
                          <Zap className='w-3 h-3' /> StormChain
                        </span>
                      )}
                      {job.remoteAllowed && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                          Remote OK
                        </span>
                      )}
                    </div>

                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {job.title}
                    </h3>

                    <div className={`flex flex-wrap items-center gap-4 text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div className='flex items-center gap-1'>
                        <Building2 className='w-4 h-4' />
                        <span>{job.company}</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <MapPin className='w-4 h-4' />
                        <span>{job.location}</span>
                      </div>
                      {job.salary && (
                        <div className={`flex items-center gap-1 font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                          <DollarSign className='w-4 h-4' />
                          <span>{job.salary}</span>
                        </div>
                      )}
                    </div>

                    {job.description && (
                      <p className={`mb-3 line-clamp-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {truncateText(job.description)}
                      </p>
                    )}

                    <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {job.category && (
                        <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {job.category}
                        </span>
                      )}
                      {job.contractType && (
                        <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {job.contractType}
                        </span>
                      )}
                      <span>{formatDate(job.created)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex-shrink-0 flex flex-col gap-2'>
                    {job.isStormChain && userAddress ? (
                      <button
                        onClick={() => { setSelectedJob(job); setApplyModalOpen(true) }}
                        className='flex items-center gap-2 px-5 py-2.5 font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white whitespace-nowrap'
                      >
                        <FileText className='w-4 h-4' />
                        Apply with Career Card
                      </button>
                    ) : !job.isStormChain && userAddress ? (
                      <button
                        onClick={() => { setSelectedJob(job); setApplyModalOpen(true) }}
                        className='flex items-center gap-2 px-5 py-2.5 font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white whitespace-nowrap'
                      >
                        <FileText className='w-4 h-4' />
                        Apply with StormChain
                      </button>
                    ) : null}
                    {job.redirectUrl && (
                      <a
                        href={job.redirectUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`flex items-center gap-2 px-5 py-2.5 font-semibold rounded-lg whitespace-nowrap ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                        }`}
                      >
                        View Original
                        <ExternalLink className='w-4 h-4' />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && jobs.length === 0 && !error && (
          <div className='text-center py-16'>
            <Briefcase className={`w-14 h-14 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {activeTab === 'stormchain' ? 'No StormChain jobs yet' : 'No jobs found'}
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {activeTab === 'stormchain'
                ? 'Employers are getting set up — check External listings or come back soon.'
                : 'Try adjusting your search criteria'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && jobs.length > 0 && (
          <div className='mt-8 flex justify-center gap-2'>
            <button
              onClick={() => fetchJobs(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                isDark
                  ? 'bg-gray-700 border border-gray-600 text-white hover:bg-gray-600'
                  : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <span className='px-4 py-2 rounded-lg font-medium bg-teal-600 text-white'>
              Page {currentPage}
            </span>
            <button
              onClick={() => fetchJobs(currentPage + 1)}
              disabled={jobs.length < 20 || isLoading}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                isDark
                  ? 'bg-gray-700 border border-gray-600 text-white hover:bg-gray-600'
                  : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <ApplyWithStormChainModal
        isOpen={applyModalOpen}
        onClose={() => { setApplyModalOpen(false); setSelectedJob(null) }}
        job={selectedJob ? {
          id: selectedJob.id,
          title: selectedJob.title,
          company: selectedJob.company,
          location: selectedJob.location,
          description: selectedJob.description ?? '',
          salary: selectedJob.salary,
          salary_min: selectedJob.salaryMin,
          salary_max: selectedJob.salaryMax,
          created: selectedJob.created,
          redirect_url: selectedJob.redirectUrl ?? '',
          category: selectedJob.category ?? '',
          contract_type: selectedJob.contractType,
          is_external: !selectedJob.isStormChain,
        } : null}
        userAddress={userAddress}
        onApplicationSubmitted={() => {
          console.log('Application submitted')
        }}
      />
    </div>
  )
}
