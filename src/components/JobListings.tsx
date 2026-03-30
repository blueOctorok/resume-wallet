'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Sparkles,
  Star,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import BackToHubButton from './ui/BackToHubButton'
import Button from '@/components/ui/Button'
import dynamic from 'next/dynamic'
import type { StormiUsageInfo } from '@/lib/ava-chat'
import { useSavedJobsStore, type SavedJobEntry } from '@/stores/saved-jobs-store'
import { cn } from '@/lib/utils'

const ApplyWithStormChainModal = dynamic(() => import('./ApplyWithStormChainModal'), {
  ssr: false,
})
const StormiCreditModal = dynamic(() => import('@/components/StormiCreditModal'), { ssr: false })

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
  /** Stormi job match (external recommended only) */
  matchScore?: number
  matchReason?: string
}

type TabId = 'stormchain' | 'external' | 'saved'

function savedEntryToListing(e: SavedJobEntry): JobListing {
  return {
    id: e.id,
    title: e.title,
    company: e.company,
    location: e.location,
    description: e.description,
    salary: e.salary,
    salaryMin: null,
    salaryMax: null,
    created: e.savedAt,
    redirectUrl: e.redirectUrl,
    category: null,
    contractType: null,
    isStormChain: e.isStormChain,
    jobType: null,
    targetRole: null,
    remoteAllowed: null,
  }
}

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
  /**
   * Guest browse (Indeed-style): search StormChain + external listings without a wallet.
   * Apply / Stormi ranking require `onSignIn` → connect flow.
   */
  publicBrowseMode?: boolean
  onSignIn?: () => void
  backLabel?: string
}

export default function JobListings({
  onBack,
  userAddress,
  publicBrowseMode = false,
  onSignIn,
  backLabel = 'Back to Hub',
}: JobListingsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const savedJobs = useSavedJobsStore((s) => s.jobs)
  const toggleSavedJob = useSavedJobsStore((s) => s.toggleSaved)
  const jobIsSaved = useSavedJobsStore((s) => s.isSaved)

  const [activeTab, setActiveTab] = useState<TabId>(() =>
    publicBrowseMode ? 'external' : 'stormchain',
  )
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

  const [recoJobs, setRecoJobs] = useState<JobListing[]>([])
  const [recoLoading, setRecoLoading] = useState(false)
  const [recoError, setRecoError] = useState<string | null>(null)
  const [recoKeywords, setRecoKeywords] = useState<string | null>(null)
  const [recoCreditModal, setRecoCreditModal] = useState(false)

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

  const fetchJobs = useCallback(
    (page = 1) => {
      if (activeTab === 'saved') return
      if (activeTab === 'stormchain') return fetchStormChainJobs(page)
      return fetchExternalJobs(page)
    },
    [activeTab, fetchStormChainJobs, fetchExternalJobs],
  )

  const savedListings = useMemo(() => savedJobs.map(savedEntryToListing), [savedJobs])
  const displayJobs = activeTab === 'saved' ? savedListings : jobs
  const listLoading = activeTab === 'saved' ? false : isLoading

  const jobToSavedPayload = useCallback((job: JobListing): Omit<SavedJobEntry, 'savedAt'> => {
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      salary: job.salary,
      redirectUrl: job.redirectUrl,
      isStormChain: job.isStormChain,
    }
  }, [])

  const fetchRecommended = useCallback(
    async (force: boolean) => {
      if (!userAddress || activeTab !== 'external') return
      setRecoLoading(true)
      setRecoError(null)
      try {
        const q = new URLSearchParams()
        if (location.trim()) q.set('location', location.trim())
        if (force) q.set('force', '1')
        const res = await fetch(`/api/jobs/recommended?${q}`, {
          headers: { 'x-wallet-address': userAddress },
        })
        const data = await res.json()
        if (res.status === 402) {
          setRecoCreditModal(true)
          setRecoError(typeof data.message === 'string' ? data.message : 'Stormi credits required.')
          setRecoJobs([])
          return
        }
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load recommendations')
        }
        const mapped: JobListing[] = (data.jobs || []).map((j: Record<string, unknown>) => ({
          id: String(j.id),
          title: j.title as string,
          company: j.company as string,
          companyLogoUrl: null,
          location: j.location as string,
          description: (j.description as string) || null,
          salary: j.salary as string | null,
          salaryMin: j.salary_min as number | null,
          salaryMax: j.salary_max as number | null,
          created: j.created as string,
          redirectUrl: (j.redirect_url as string) || null,
          category: j.category as string | null,
          contractType: j.contract_type as string | null,
          isStormChain: false,
          jobType: j.contract_type as string | null,
          targetRole: null,
          remoteAllowed: null,
          matchScore: typeof j.matchScore === 'number' ? j.matchScore : undefined,
          matchReason: typeof j.matchReason === 'string' ? j.matchReason : undefined,
        }))
        setRecoJobs(mapped)
        setRecoKeywords(typeof data.keywords === 'string' ? data.keywords : null)
      } catch (err) {
        setRecoError(err instanceof Error ? err.message : 'Recommendations unavailable')
        setRecoJobs([])
      } finally {
        setRecoLoading(false)
      }
    },
    [userAddress, activeTab, location],
  )

  // Fetch on mount and when tab changes (saved = local shortlist only)
  useEffect(() => {
    if (activeTab === 'saved') return
    fetchJobs(1)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'external' && userAddress) {
      void fetchRecommended(false)
    } else {
      setRecoJobs([])
      setRecoKeywords(null)
      setRecoError(null)
    }
  }, [activeTab, userAddress, fetchRecommended])

  useEffect(() => {
    if (!userAddress && activeTab === 'saved') {
      setActiveTab('stormchain')
    }
  }, [userAddress, activeTab])

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

  const promptConnect = Boolean(publicBrowseMode && !userAddress && onSignIn)

  // Guests: external first. Logged-in: StormChain + external + optional Saved shortlist (no auto-apply).
  const TABS = useMemo((): {
    id: TabId
    label: string
    hint: string
    icon: React.ReactNode
    description: string
  }[] => {
    if (publicBrowseMode) {
      return [
        {
          id: 'external',
          label: 'External job boards',
          hint: 'Indeed-style aggregate — usually the most results',
          icon: <Globe className='w-5 h-5 shrink-0' />,
          description: 'Listings aggregated from major job boards. Search and open listings without an account.',
        },
        {
          id: 'stormchain',
          label: 'StormChain employers',
          hint: 'Roles posted directly on StormChain',
          icon: <Zap className='w-5 h-5 shrink-0' />,
          description: 'Jobs from employers posting on StormChain — the list grows as companies join.',
        },
      ]
    }
    const base: {
      id: TabId
      label: string
      hint: string
      icon: React.ReactNode
      description: string
    }[] = [
      {
        id: 'stormchain',
        label: 'StormChain',
        hint: 'Employers on our network',
        icon: <Zap className='w-5 h-5 shrink-0' />,
        description: 'Jobs from verified employers on StormChain',
      },
      {
        id: 'external',
        label: 'External boards',
        hint: 'Aggregated listings',
        icon: <Globe className='w-5 h-5 shrink-0' />,
        description: 'Aggregated listings from job boards',
      },
    ]
    if (userAddress) {
      base.push({
        id: 'saved',
        label: 'Saved',
        hint: 'Your shortlist — no auto-apply',
        icon: <Star className='w-5 h-5 shrink-0' />,
        description:
          'Roles you starred from StormChain or external search. Revisit when your Career Card is ready — we never apply for you.',
      })
    }
    return base
  }, [publicBrowseMode, userAddress])

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <BackToHubButton onClick={onBack} label={backLabel} className='mb-4' />
          <h1 className={`text-3xl md:text-4xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {publicBrowseMode ? 'Browse jobs' : 'Find Jobs'}
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {publicBrowseMode
              ? totalCount > 0
                ? `${totalCount.toLocaleString()} listings — connect your wallet to apply with your career card & Stormi`
                : 'Search StormChain and external boards. No account needed to look — wallet required to apply.'
              : activeTab === 'saved'
                ? `${savedJobs.length} saved role${savedJobs.length === 1 ? '' : 's'} — stored on this device; star listings from StormChain or External tabs`
                : totalCount > 0
                  ? `${totalCount.toLocaleString()} jobs found`
                  : 'Search for your next opportunity'}
          </p>
        </div>

        {publicBrowseMode && onSignIn && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              isDark ? 'bg-teal-500/10 border-teal-500/25' : 'bg-teal-50 border-teal-200/80'
            }`}
          >
            <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              <span className='font-semibold'>Applying is wallet-gated.</span>{' '}
              Easy Apply, Stormi match scores, and cover letters use your on-chain career card.
            </p>
            <Button type='button' variant='primary' size='sm' className='shrink-0' onClick={onSignIn}>
              Connect wallet
            </Button>
          </div>
        )}

        {/* Tab switcher — explicit “two sources” so guests don’t miss External vs StormChain */}
        <div className='mb-2'>
          <p
            className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          >
            Job source
          </p>
          <div
            className={`flex flex-col sm:flex-row gap-2 p-1.5 rounded-2xl border-2 ${
              isDark ? 'bg-gray-800/80 border-gray-600' : 'bg-gray-100 border-gray-200'
            }`}
            role='tablist'
            aria-label='Choose where to search for jobs'
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type='button'
                  role='tab'
                  aria-selected={selected}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-3 px-4 py-3 sm:py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    selected
                      ? isDark
                        ? 'bg-teal-600/25 text-white ring-2 ring-teal-500/60 shadow-md'
                        : 'bg-white text-gray-900 ring-2 ring-teal-500/50 shadow-md'
                      : isDark
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                  }`}
                >
                  {tab.icon}
                  <span className='flex flex-col gap-0.5 min-w-0'>
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] font-normal leading-snug ${
                        selected
                          ? isDark
                            ? 'text-gray-300'
                            : 'text-gray-600'
                          : isDark
                            ? 'text-gray-500'
                            : 'text-gray-500'
                      }`}
                    >
                      {tab.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {publicBrowseMode && (
          <p
            className={`text-xs sm:text-sm mb-4 rounded-lg px-3 py-2 border ${
              isDark ? 'bg-gray-800/40 border-gray-700 text-gray-300' : 'bg-sky-50/80 border-sky-200/80 text-gray-700'
            }`}
          >
            <span className='font-semibold'>Browsing without an account?</span> We open{' '}
            <strong>External job boards</strong> first — that’s where most listings live. Use{' '}
            <strong>StormChain employers</strong> to see roles posted only on StormChain (that list may be empty early
            on).
          </p>
        )}

        {/* Active tab detail */}
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {TABS.find((t) => t.id === activeTab)?.description}
        </p>

        {/* Stormi personalized external jobs */}
        {activeTab === 'external' && userAddress && (
          <div
            className={`rounded-2xl p-5 mb-6 border ${
              isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-teal-50/80 border-teal-200/80'
            }`}
          >
            <div className='flex flex-wrap items-start justify-between gap-3 mb-2'>
              <div className='flex items-center gap-2 min-w-0'>
                <Sparkles className={`w-5 h-5 shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Recommended for you
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Stormi scores listings against your career card. One free refresh per day; extra refreshes use 1
                    credit.
                    {recoKeywords ? ` Searching: “${recoKeywords}”.` : ''}
                  </p>
                </div>
              </div>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => void fetchRecommended(true)}
                disabled={recoLoading}
                isLoading={recoLoading}
              >
                Refresh matches
              </Button>
            </div>
            {recoError && (
              <p className={`text-sm mb-3 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{recoError}</p>
            )}
            {recoLoading && recoJobs.length === 0 && (
              <div className='flex justify-center py-8'>
                <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
            )}
            {recoJobs.length > 0 && (
              <div className='space-y-3 mt-2'>
                {recoJobs.map((job) => (
                  <div
                    key={`reco-${job.id}`}
                    className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/50 border-gray-600' : 'bg-white border-gray-200'}`}
                  >
                    <div className='flex flex-wrap items-center gap-2 mb-2'>
                      {job.matchScore != null && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {job.matchScore}% match
                        </span>
                      )}
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>External</span>
                      {userAddress && (
                        <button
                          type='button'
                          aria-label={jobIsSaved(job.id) ? 'Remove from saved' : 'Save job to shortlist'}
                          aria-pressed={jobIsSaved(job.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSavedJob(jobToSavedPayload(job))
                          }}
                          className={cn(
                            'ml-auto p-1 rounded-lg transition-colors',
                            isDark ? 'hover:bg-gray-700/80 text-gray-400' : 'hover:bg-gray-100 text-gray-500',
                          )}
                        >
                          <Star
                            className={cn(
                              'w-4 h-4',
                              jobIsSaved(job.id) && 'fill-amber-400 text-amber-400',
                            )}
                          />
                        </button>
                      )}
                    </div>
                    <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.title}</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {job.company} · {job.location}
                    </p>
                    {job.matchReason && (
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{job.matchReason}</p>
                    )}
                    <div className='flex flex-wrap gap-2 mt-3'>
                      {promptConnect ? (
                        <Button type='button' variant='primary' size='sm' onClick={onSignIn}>
                          Connect to apply
                        </Button>
                      ) : (
                        <Button
                          type='button'
                          variant='primary'
                          size='sm'
                          onClick={() => {
                            setSelectedJob(job)
                            setApplyModalOpen(true)
                          }}
                        >
                          Apply with StormChain
                        </Button>
                      )}
                      {job.redirectUrl && (
                        <a
                          href={job.redirectUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg ${
                            isDark
                              ? 'bg-gray-700 text-white border border-gray-600 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          View original
                          <ExternalLink className='w-3.5 h-3.5' />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!recoLoading && recoJobs.length === 0 && !recoError && (
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                No scored listings yet — add headline, skills, and blocks on your hub, or try again later.
              </p>
            )}
          </div>
        )}

        {/* Search Form — hidden on Saved tab */}
        {activeTab !== 'saved' && (
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
        )}

        {activeTab === 'saved' && userAddress && (
          <p
            className={`text-sm mb-6 rounded-xl px-4 py-3 border ${
              isDark ? 'bg-gray-800/50 border-gray-600 text-gray-300' : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <span className='font-semibold'>Shortlist only.</span> Saving does not notify employers or submit applications
            — same high-signal rules as the rest of StormChain.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-red-800 dark:text-red-200'>{error}</p>
          </div>
        )}

        {/* Loading */}
        {listLoading && (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        )}

        {/* Job Cards */}
        {!listLoading && displayJobs.length > 0 && (
          <div className='space-y-4'>
            {displayJobs.map((job) => (
              <div key={job.id} className={`rounded-2xl p-6 transition-all hover:shadow-lg ${cardClass}`}>
                <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 mb-1'>
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
                      {userAddress && (
                        <button
                          type='button'
                          aria-label={jobIsSaved(job.id) ? 'Remove from saved' : 'Save job to shortlist'}
                          aria-pressed={jobIsSaved(job.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSavedJob(jobToSavedPayload(job))
                          }}
                          className={cn(
                            'ml-auto p-1.5 rounded-lg transition-colors',
                            isDark ? 'hover:bg-gray-700/80 text-gray-400' : 'hover:bg-gray-100 text-gray-500',
                          )}
                        >
                          <Star
                            className={cn(
                              'w-5 h-5',
                              jobIsSaved(job.id) && 'fill-amber-400 text-amber-400',
                            )}
                          />
                        </button>
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
                    {promptConnect ? (
                      <Button
                        type='button'
                        variant='primary'
                        onClick={onSignIn}
                        className='whitespace-nowrap'
                      >
                        <FileText className='w-4 h-4' />
                        Connect to apply
                      </Button>
                    ) : (
                      <>
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
                      </>
                    )}
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
        {!listLoading && displayJobs.length === 0 && !error && (
          <div className='text-center py-16'>
            <Briefcase className={`w-14 h-14 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {activeTab === 'saved'
                ? 'No saved jobs yet'
                : activeTab === 'stormchain'
                  ? 'No StormChain jobs yet'
                  : 'No jobs found'}
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {activeTab === 'saved'
                ? 'Open StormChain or External tabs and tap the star on roles you want to revisit.'
                : activeTab === 'stormchain'
                  ? 'Employers are getting set up — check External listings or come back soon.'
                  : 'Try adjusting your search criteria'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {!listLoading && displayJobs.length > 0 && activeTab !== 'saved' && (
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
        isOpen={applyModalOpen && !publicBrowseMode}
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

      {recoCreditModal && (
        <StormiCreditModal
          walletAddress={userAddress}
          onClose={() => setRecoCreditModal(false)}
          onSuccess={(_u: StormiUsageInfo) => {
            setRecoCreditModal(false)
            void fetchRecommended(true)
          }}
        />
      )}
    </div>
  )
}
