'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  MapPin,
  DollarSign,
  ExternalLink,
  Briefcase,
  Filter,
  FileText,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import LoadingScreen from './LoadingScreen'
import BackToHubButton from './ui/BackToHubButton'
import dynamic from 'next/dynamic'

const ApplyWithStormChainModal = dynamic(() => import('./ApplyWithStormChainModal'), {
  ssr: false,
})

interface Job {
  id: string
  title: string
  company: string
  location: string
  description: string
  salary: string | null
  salary_min: number | null
  salary_max: number | null
  created: string
  redirect_url: string
  category: string
  contract_type: string | null
  is_external: boolean
}

interface JobListingsProps {
  onClose?: () => void
  onBack: () => void
  userAddress: string | null
}

export default function JobListings({
  onClose,
  onBack,
  userAddress,
}: JobListingsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const [keywords, setKeywords] = useState('truck driver CDL')
  const [location, setLocation] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'date' | 'salary' | 'relevance'>('date')
  const [showFilters, setShowFilters] = useState(false)

  const fetchJobs = async (page = 1) => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        keywords,
        location,
        page: page.toString(),
        results_per_page: '20',
        sort_by: sortBy,
      })

      const response = await fetch(`/api/jobs/external/search?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }

      const data = await response.json()

      if (data.success) {
        setJobs(data.results)
        setTotalCount(data.count)
        setCurrentPage(page)
      } else {
        throw new Error(data.error || 'Failed to load jobs')
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs(1)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchJobs(1)
  }

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const truncateDescription = (text: string, maxLength = 200) => {
    const clean = stripHtml(text)
    if (clean.length <= maxLength) return clean
    return clean.substring(0, maxLength) + '...'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const cardClass = isDark
    ? 'bg-gray-800/50 border border-gray-700'
    : 'bg-white border border-gray-200'

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <BackToHubButton onClick={onBack} className="mb-4" />
          <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Browse Jobs
          </h1>
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {totalCount > 0 && `${totalCount.toLocaleString()} trucking jobs available`}
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className='mb-6'>
          <div className={`rounded-2xl p-6 ${cardClass}`}>
            {/* Main search inputs */}
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
                className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                  isDark
                    ? 'bg-teal-600 hover:bg-teal-500 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {isLoading ? 'Searching...' : 'Search Jobs'}
              </button>
            </div>

            {/* Filters toggle */}
            <button
              type='button'
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-sm ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'}`}
            >
              <Filter className='w-4 h-4' />
              {showFilters ? 'Hide' : 'Show'} filters
            </button>

            {/* Filter options */}
            {showFilters && (
              <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Sort by
                </label>
                <div className='flex gap-2 flex-wrap'>
                  {(['date', 'salary', 'relevance'] as const).map((sort) => (
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
                      {sort === 'date' ? 'Most Recent' : sort === 'salary' ? 'Highest Salary' : 'Most Relevant'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Error state */}
        {error && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-red-800 dark:text-red-200'>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <LoadingScreen message='Searching for jobs...' fullScreen={false} />
        )}

        {/* Jobs list */}
        {!isLoading && jobs.length > 0 && (
          <div className='space-y-4'>
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`rounded-2xl p-6 transition-all hover:shadow-lg ${cardClass}`}
              >
                <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-4'>
                  <div className='flex-1'>
                    {/* Job title */}
                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {job.title}
                    </h3>

                    {/* Company and location */}
                    <div className={`flex flex-wrap items-center gap-4 text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div className='flex items-center gap-1'>
                        <Briefcase className='w-4 h-4' />
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

                    {/* Description */}
                    <p className={`mb-4 line-clamp-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {truncateDescription(job.description)}
                    </p>

                    {/* Meta info */}
                    <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`px-2 py-1 rounded ${isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'}`}>
                        {job.category}
                      </span>
                      {job.contract_type && (
                        <span className={`px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                          {job.contract_type}
                        </span>
                      )}
                      <span>{formatDate(job.created)}</span>
                    </div>
                  </div>

                  {/* Apply buttons */}
                  <div className='flex-shrink-0 flex flex-col gap-2'>
                    {userAddress && (
                      <button
                        onClick={() => {
                          setSelectedJob(job)
                          setApplyModalOpen(true)
                        }}
                        className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                          isDark
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                      >
                        <FileText className='w-4 h-4' />
                        Apply with StormChain
                      </button>
                    )}
                    <a
                      href={job.redirect_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isDark
                          ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                      }`}
                    >
                      View Original
                      <ExternalLink className='w-4 h-4' />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && jobs.length === 0 && !error && (
          <div className='text-center py-12'>
            <Briefcase className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No jobs found
            </h3>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Try adjusting your search criteria
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
            <span className={`px-4 py-2 rounded-lg font-medium ${isDark ? 'bg-teal-600 text-white' : 'bg-teal-600 text-white'}`}>
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
        onClose={() => {
          setApplyModalOpen(false)
          setSelectedJob(null)
        }}
        job={selectedJob}
        userAddress={userAddress}
        onApplicationSubmitted={() => {
          console.log('Application submitted successfully')
        }}
      />
    </div>
  )
}
