'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  MapPin,
  DollarSign,
  ExternalLink,
  Briefcase,
  TrendingUp,
  Filter,
  FileText,
  ArrowLeft,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import LoadingScreen from './LoadingScreen'
import dynamic from 'next/dynamic'

// Dynamically import the modal to reduce initial bundle size
const ApplyWithVereeModal = dynamic(() => import('./ApplyWithVereeModal'), {
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
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  // Search filters
  const [keywords, setKeywords] = useState('truck driver CDL')
  const [location, setLocation] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'date' | 'salary' | 'relevance'>('date')
  const [showFilters, setShowFilters] = useState(false)

  // Fetch jobs
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

  // Initial load
  useEffect(() => {
    fetchJobs(1)
  }, [])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchJobs(1)
  }

  // Strip HTML tags from description
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Truncate description
  const truncateDescription = (text: string, maxLength = 200) => {
    const clean = stripHtml(text)
    if (clean.length <= maxLength) return clean
    return clean.substring(0, maxLength) + '...'
  }

  // Format date
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

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <button
            onClick={onBack}
            className='inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 cursor-pointer'
          >
            <ArrowLeft className='w-5 h-5' />
            Back
          </button>
          <h1
            className={`text-3xl md:text-4xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-brand-sage'
            }`}
          >
            Browse Jobs
          </h1>
          <p
            className={`text-lg ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'
            }`}
          >
            {totalCount > 0 &&
              `${totalCount.toLocaleString()} trucking jobs available`}
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className='mb-6'>
          <div
            className={`rounded-2xl p-6 shadow-2xl border-t-4 ${
              theme === 'dark'
                ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
                : 'bg-white/80 backdrop-blur-xl border-brand-sage'
            }`}
          >
            {/* Main search inputs */}
            <div className='flex flex-col md:flex-row gap-3 mb-3'>
              <div className='flex-1 relative'>
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                />
                <input
                  type='text'
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder='Job title, keywords...'
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-mint ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div className='flex-1 relative'>
                <MapPin
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                />
                <input
                  type='text'
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder='City, state, or zip code'
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-mint ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg hover:shadow-xl ${
                  theme === 'dark'
                    ? 'bg-brand-mint/20 hover:bg-brand-mint/30 text-white border border-brand-mint/50'
                    : 'bg-brand-sage hover:bg-brand-sage-dark text-white'
                }`}
              >
                {isLoading ? 'Searching...' : 'Search Jobs'}
              </button>
            </div>

            {/* Filters toggle */}
            <button
              type='button'
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-sm ${
                theme === 'dark'
                  ? 'text-brand-mint hover:text-brand-mint/80'
                  : 'text-brand-sage hover:text-brand-sage-dark'
              }`}
            >
              <Filter className='w-4 h-4' />
              {showFilters ? 'Hide' : 'Show'} filters
            </button>

            {/* Filter options */}
            {showFilters && (
              <div
                className={`mt-3 pt-3 border-t ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-brand-sage'
                  }`}
                >
                  Sort by
                </label>
                <div className='flex gap-2 flex-wrap'>
                  <button
                    type='button'
                    onClick={() => setSortBy('date')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === 'date'
                        ? theme === 'dark'
                          ? 'bg-brand-mint/30 text-white border border-brand-mint/50 shadow-lg'
                          : 'bg-brand-sage text-white shadow-lg'
                        : theme === 'dark'
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Most Recent
                  </button>
                  <button
                    type='button'
                    onClick={() => setSortBy('salary')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === 'salary'
                        ? theme === 'dark'
                          ? 'bg-brand-mint/30 text-white border border-brand-mint/50 shadow-lg'
                          : 'bg-brand-sage text-white shadow-lg'
                        : theme === 'dark'
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Highest Salary
                  </button>
                  <button
                    type='button'
                    onClick={() => setSortBy('relevance')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === 'relevance'
                        ? theme === 'dark'
                          ? 'bg-brand-mint/30 text-white border border-brand-mint/50 shadow-lg'
                          : 'bg-brand-sage text-white shadow-lg'
                        : theme === 'dark'
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Most Relevant
                  </button>
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
                className={`rounded-2xl p-6 shadow-2xl border-t-4 transition-all hover:shadow-xl ${
                  theme === 'dark'
                    ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint hover:border-brand-mint/80'
                    : 'bg-white/80 backdrop-blur-xl border-brand-sage hover:border-brand-sage-dark'
                }`}
              >
                <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-4'>
                  <div className='flex-1'>
                    {/* Job title */}
                    <h3
                      className={`text-xl font-bold mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-brand-sage'
                      }`}
                    >
                      {job.title}
                    </h3>

                    {/* Company and location */}
                    <div
                      className={`flex flex-wrap items-center gap-4 text-sm mb-3 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      <div className='flex items-center gap-1'>
                        <Briefcase className='w-4 h-4' />
                        <span>{job.company}</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <MapPin className='w-4 h-4' />
                        <span>{job.location}</span>
                      </div>
                      {job.salary && (
                        <div
                          className={`flex items-center gap-1 font-semibold ${
                            theme === 'dark'
                              ? 'text-brand-mint'
                              : 'text-brand-sage'
                          }`}
                        >
                          <DollarSign className='w-4 h-4' />
                          <span>{job.salary}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p
                      className={`mb-4 line-clamp-3 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {truncateDescription(job.description)}
                    </p>

                    {/* Meta info */}
                    <div
                      className={`flex items-center gap-3 text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      <span
                        className={`px-2 py-1 rounded ${
                          theme === 'dark'
                            ? 'bg-brand-mint/20 text-brand-mint'
                            : 'bg-brand-sage/20 text-brand-sage'
                        }`}
                      >
                        {job.category}
                      </span>
                      {job.contract_type && (
                        <span
                          className={`px-2 py-1 rounded ${
                            theme === 'dark'
                              ? 'bg-slate-700 text-gray-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
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
                        className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap shadow-lg hover:shadow-xl ${
                          theme === 'dark'
                            ? 'bg-brand-mint/30 hover:bg-brand-mint/40 text-white border border-brand-mint/50'
                            : 'bg-brand-sage hover:bg-brand-sage-dark text-white'
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
                      className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap shadow-lg hover:shadow-xl ${
                        theme === 'dark'
                          ? 'bg-slate-800 hover:bg-slate-700 text-white border border-gray-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-brand-sage border border-gray-300'
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
            <Briefcase
              className={`w-16 h-16 mx-auto mb-4 ${
                theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
              }`}
            />
            <h3
              className={`text-xl font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-brand-sage'
              }`}
            >
              No jobs found
            </h3>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
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
                theme === 'dark'
                  ? 'bg-slate-800 border border-gray-600 text-white hover:bg-slate-700'
                  : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <span
              className={`px-4 py-2 rounded-lg font-medium shadow-lg ${
                theme === 'dark'
                  ? 'bg-brand-mint/30 text-white border border-brand-mint/50'
                  : 'bg-brand-sage text-white'
              }`}
            >
              Page {currentPage}
            </span>
            <button
              onClick={() => fetchJobs(currentPage + 1)}
              disabled={jobs.length < 20 || isLoading}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 border border-gray-600 text-white hover:bg-slate-700'
                  : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <ApplyWithVereeModal
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
