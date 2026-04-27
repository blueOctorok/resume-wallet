'use client'

/**
 * SimpleJobRail — the left column of Simple mode.
 *
 * Shows a tight list of jobs with a single search bar. Clicking a card
 * updates `useSimpleModeStore.selectedJobSnapshot`; the right panel reacts.
 *
 * Kept deliberately simple vs the legacy `JobListings` component — Simple
 * mode owns a different UX (no tabs dominating the screen, one source at a
 * time, tight density). Heavy power-user features (filters, pagination) live
 * under a collapsible control so first-run users see just results.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, MapPin, Loader2, Search, Globe, Zap, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useJobSearch, type JobListing, type JobSource } from '@/hooks/use-job-search'
import {
  useSimpleModeStore,
  type SelectedJobSnapshot,
} from '@/stores/simple-mode-store'
import { useHubOnboarding, useInstalledBlocks } from '@/stores/hub-blocks-store'
import { buildAdzunaSmartDefaults } from '@/lib/adzuna-smart-defaults'
import HubSectionPanel from '@/components/hub/HubSectionPanel'

/** Chip-style salary floor options — round numbers that match user mental models. */
const SALARY_FLOORS: { label: string; value: number }[] = [
  { label: '$40k+', value: 40_000 },
  { label: '$60k+', value: 60_000 },
  { label: '$80k+', value: 80_000 },
  { label: '$100k+', value: 100_000 },
]

/** First-run shortcut chips shown when the user has no query committed. */
const TRENDING_SEARCHES: { label: string; keywords: string }[] = [
  { label: 'Remote software engineer', keywords: 'software engineer remote' },
  { label: 'CDL truck driver', keywords: 'cdl truck driver' },
  { label: 'Warehouse / logistics', keywords: 'warehouse logistics' },
]

interface SimpleJobRailProps {
  userAddress: string | null
  /** Called when the user picks a job — parent may open the mobile sheet here. */
  onJobSelected?: (snapshot: SelectedJobSnapshot) => void
}

function jobToSnapshot(job: JobListing, source: JobSource): SelectedJobSnapshot {
  return {
    id: job.id,
    source: source === 'stormchain' ? 'stormchain' : 'adzuna',
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    salary: job.salary,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    redirectUrl: job.redirectUrl,
    targetRole: job.targetRole,
    remoteAllowed: job.remoteAllowed,
    isStormChain: job.isStormChain,
  }
}

export default function SimpleJobRail({ onJobSelected }: SimpleJobRailProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const selectedJobId = useSimpleModeStore((s) => s.selectedJobId)
  const setSelection = useSimpleModeStore((s) => s.setSelection)
  const filters = useSimpleModeStore((s) => s.filters)
  const setFilter = useSimpleModeStore((s) => s.setFilter)
  const resetFilters = useSimpleModeStore((s) => s.resetFilters)
  const onboarding = useHubOnboarding()
  const installedBlocks = useInstalledBlocks()
  const smartDefaults = useMemo(
    () =>
      buildAdzunaSmartDefaults(onboarding, installedBlocks.map((b) => b.blockType)),
    [onboarding, installedBlocks],
  )

  const [source, setSource] = useState<JobSource>('adzuna')
  const [keywords, setKeywords] = useState(smartDefaults.keywords)
  const [location, setLocation] = useState(smartDefaults.location)
  // `committed*` is what actually drives the query — debounces typing
  const [committedKeywords, setCommittedKeywords] = useState(smartDefaults.keywords)
  const [committedLocation, setCommittedLocation] = useState(smartDefaults.location)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Skip the initial fetch entirely when we have no keywords — shows the
  // first-run "ask Stormi" empty state instead of 20 random generic listings.
  const shouldSkipSearch = !committedKeywords.trim() && source === 'adzuna'

  const { jobs, isLoading, error } = useJobSearch({
    source,
    keywords: committedKeywords,
    location: committedLocation,
    skip: shouldSkipSearch,
    salaryMin: filters.salaryFloor,
    jobType: filters.jobType,
    remoteOnly: filters.remoteOnly,
  })

  const activeFilterCount =
    (filters.salaryFloor ? 1 : 0) + (filters.jobType ? 1 : 0) + (filters.remoteOnly ? 1 : 0)

  // When onboarding hydrates after mount, fill empty fields so the first
  // Adzuna fetch uses occupation-derived keywords (no overwrite if user typed).
  useEffect(() => {
    if (!smartDefaults.keywords && !smartDefaults.location) return
    setKeywords((k) => (k.trim() ? k : smartDefaults.keywords))
    setLocation((l) => (l.trim() ? l : smartDefaults.location))
    setCommittedKeywords((k) => (k.trim() ? k : smartDefaults.keywords))
    setCommittedLocation((l) => (l.trim() ? l : smartDefaults.location))
  }, [smartDefaults.keywords, smartDefaults.location])

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setCommittedKeywords(keywords)
      setCommittedLocation(location)
    },
    [keywords, location],
  )

  // One-click trending-category shortcut — updates both fields and commits immediately.
  const handleTrendingPick = useCallback(
    (kw: string) => {
      setKeywords(kw)
      setCommittedKeywords(kw)
    },
    [],
  )

  // Auto-promote the first result when a URL-hydrated selection points to a job
  // we just loaded but don't yet have a snapshot for.
  const snapshotlessSelectedId = useSimpleModeStore(
    (s) => (s.selectedJobId && !s.selectedJobSnapshot ? s.selectedJobId : null),
  )
  useEffect(() => {
    if (!snapshotlessSelectedId) return
    const found = jobs.find((j) => j.id === snapshotlessSelectedId)
    if (found) {
      setSelection(jobToSnapshot(found, source))
    }
  }, [snapshotlessSelectedId, jobs, source, setSelection])

  const handleSelect = useCallback(
    (job: JobListing) => {
      const snap = jobToSnapshot(job, source)
      setSelection(snap)
      onJobSelected?.(snap)
    },
    [source, setSelection, onJobSelected],
  )

  const sourceTabs = useMemo(
    () =>
      [
        { id: 'adzuna' as const, label: 'All jobs', icon: Globe },
        { id: 'stormchain' as const, label: 'Storm employers', icon: Zap },
      ],
    [],
  )

  return (
    <HubSectionPanel
      isDark={isDark}
      accent='teal'
      className='h-full'
      // Tighter padding so search + list read as one column — rail is narrow; vertical space is precious.
      contentClassName='flex flex-col h-full min-h-0 !p-3 sm:!p-4'
    >
      {/* One tight strip: title + source — description lives in title attr so we don't stack 3 text rows */}
      <div className='flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-slate-300/80 dark:border-gray-700/50'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              isDark
                ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30'
                : 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
            )}
          >
            <Briefcase className='h-3.5 w-3.5' />
          </div>
          <h3
            className={cn(
              'min-w-0 truncate text-sm font-semibold tracking-tight',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            title='Pick a role — Stormi shapes your career card around what you target.'
          >
            Find jobs
          </h3>
        </div>
        {/* Source toggle — same row when rail is wide enough; wraps on md split */}
        <div
          className={cn(
            'flex shrink-0 gap-0.5 rounded-full border p-0.5 text-[11px] font-semibold',
            isDark ? 'bg-gray-900/60 border-gray-700' : 'bg-white border-slate-200 shadow-sm',
          )}
        >
        {sourceTabs.map((t) => {
          const Icon = t.icon
          const active = t.id === source
          return (
            <button
              key={t.id}
              type='button'
              onClick={() => setSource(t.id)}
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-1 transition-colors cursor-pointer sm:gap-1 sm:px-2.5 sm:py-1.5',
                active
                  ? isDark
                    ? 'bg-teal-500/25 text-teal-100'
                    : 'bg-teal-500/15 text-teal-700'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-slate-500 hover:text-slate-700',
              )}
              aria-pressed={active}
            >
              <Icon className='w-3.5 h-3.5' />
              {t.label}
            </button>
          )
        })}
        </div>
      </div>

      {/* Search form — sits directly above results */}
      <form onSubmit={handleSearchSubmit} className='mb-2 space-y-1.5'>
        <div className='relative'>
          <Search
            className={cn(
              'absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2',
              isDark ? 'text-gray-500' : 'text-slate-400',
            )}
          />
          <input
            type='text'
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='Job title, skill, or company'
            className={cn(
              'w-full rounded-lg border py-1.5 pl-9 pr-3 text-xs outline-none sm:text-[13px]',
              isDark
                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500',
            )}
          />
          {keywords && (
            <button
              type='button'
              onClick={() => setKeywords('')}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer',
                isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600',
              )}
              aria-label='Clear search'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          )}
        </div>
        <div className='relative'>
          <MapPin
            className={cn(
              'absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2',
              isDark ? 'text-gray-500' : 'text-slate-400',
            )}
          />
          <input
            type='text'
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder='City or ZIP (optional)'
            className={cn(
              'w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs outline-none sm:text-[13px]',
              isDark
                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500',
            )}
          />
        </div>
        <div className='flex gap-1.5'>
          <button
            type='submit'
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer sm:text-sm',
              isDark
                ? 'bg-teal-500 text-white hover:bg-teal-400'
                : 'bg-teal-600 text-white hover:bg-teal-500',
            )}
          >
            Search
          </button>
          {source === 'adzuna' && (
            <button
              type='button'
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer sm:px-3 sm:text-sm',
                filtersOpen || activeFilterCount > 0
                  ? isDark
                    ? 'border-teal-400/60 bg-teal-500/10 text-teal-200'
                    : 'border-teal-500/60 bg-teal-50 text-teal-700'
                  : isDark
                    ? 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              Filters
              {activeFilterCount > 0 && (
                <span
                  className={cn(
                    'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    isDark ? 'bg-teal-400 text-gray-900' : 'bg-teal-600 text-white',
                  )}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Filter chips — Adzuna only; StormChain listings are already curated */}
      {source === 'adzuna' && filtersOpen && (
        <div
          className={cn(
            'mb-2 space-y-2 rounded-lg border p-2.5',
            isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-slate-200',
          )}
        >
          {/* Salary floor */}
          <div>
            <p
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wide mb-1.5',
                isDark ? 'text-gray-400' : 'text-slate-500',
              )}
            >
              Minimum salary
            </p>
            <div className='flex flex-wrap gap-1.5'>
              {SALARY_FLOORS.map((opt) => {
                const active = filters.salaryFloor === opt.value
                return (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => setFilter('salaryFloor', active ? null : opt.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                      active
                        ? isDark
                          ? 'bg-teal-500/25 border-teal-400/60 text-teal-100'
                          : 'bg-teal-500/15 border-teal-500/60 text-teal-700'
                        : isDark
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Job type */}
          <div>
            <p
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wide mb-1.5',
                isDark ? 'text-gray-400' : 'text-slate-500',
              )}
            >
              Job type
            </p>
            <div className='flex flex-wrap gap-1.5'>
              {([
                { label: 'Full-time', value: 'full_time' as const },
                { label: 'Part-time', value: 'part_time' as const },
                { label: 'Contract', value: 'contract' as const },
              ]).map((opt) => {
                const active = filters.jobType === opt.value
                return (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => setFilter('jobType', active ? null : opt.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                      active
                        ? isDark
                          ? 'bg-teal-500/25 border-teal-400/60 text-teal-100'
                          : 'bg-teal-500/15 border-teal-500/60 text-teal-700'
                        : isDark
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Remote toggle + reset */}
          <div className='flex items-center justify-between gap-2'>
            <label
              className={cn(
                'inline-flex items-center gap-2 text-xs font-medium cursor-pointer',
                isDark ? 'text-gray-300' : 'text-slate-700',
              )}
            >
              <input
                type='checkbox'
                checked={filters.remoteOnly}
                onChange={(e) => setFilter('remoteOnly', e.target.checked)}
                className='accent-teal-500'
              />
              Remote only
            </label>
            {activeFilterCount > 0 && (
              <button
                type='button'
                onClick={resetFilters}
                className={cn(
                  'text-xs font-medium underline-offset-2 hover:underline cursor-pointer',
                  isDark ? 'text-gray-400' : 'text-slate-500',
                )}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div
        className={cn(
          'flex-1 min-h-0 -mr-1 space-y-1.5 overflow-y-auto pr-1',
          'scrollbar-none',
        )}
      >
        {isLoading && jobs.length === 0 && (
          <div className='flex items-center justify-center py-8'>
            <Loader2
              className={cn('w-5 h-5 animate-spin', isDark ? 'text-gray-400' : 'text-slate-500')}
            />
          </div>
        )}

        {error && (
          <p
            className={cn(
              'text-xs text-center py-4',
              isDark ? 'text-red-400' : 'text-red-600',
            )}
          >
            {error}
          </p>
        )}

        {/* First-run / zero-context state: no committed search yet. Rather than
            showing 20 random listings, invite the user to pick a trending
            shortcut or lean on Stormi. This is Phase 5's "tame Adzuna" piece. */}
        {!isLoading && !error && jobs.length === 0 && shouldSkipSearch && (
          <div
            className={cn(
              'space-y-2 rounded-lg border p-2.5',
              isDark ? 'border-gray-700 bg-gray-900/40' : 'border-slate-200 bg-white',
            )}
          >
            <div className='flex items-start gap-1.5'>
              <Sparkles
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  isDark ? 'text-teal-300' : 'text-teal-600',
                )}
              />
              <p
                className={cn(
                  'text-[11px] leading-snug sm:text-xs',
                  isDark ? 'text-gray-200' : 'text-slate-700',
                )}
              >
                Pick a trending search below, or ask Stormi in the card column for ideas.
              </p>
            </div>
            <div className='flex flex-wrap gap-1'>
              {TRENDING_SEARCHES.map((t) => (
                <button
                  key={t.label}
                  type='button'
                  onClick={() => handleTrendingPick(t.keywords)}
                  className={cn(
                    'rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 sm:text-xs',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 hover:border-teal-400/60 hover:text-teal-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-500/60 hover:text-teal-700',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Committed-search empty state — query returned nothing */}
        {!isLoading && !error && jobs.length === 0 && !shouldSkipSearch && (
          <div
            className={cn(
              'rounded-lg border border-dashed py-6 text-center text-xs',
              isDark ? 'border-gray-700 text-gray-500' : 'border-slate-200 text-slate-500',
            )}
          >
            <Briefcase className='mx-auto mb-1.5 size-5 opacity-50' />
            No jobs matched. Try broader keywords or clear a filter.
          </div>
        )}

        {jobs.map((job) => {
          const selected = job.id === selectedJobId
          return (
            <button
              key={`${source}-${job.id}`}
              type='button'
              onClick={() => handleSelect(job)}
              className={cn(
                'w-full cursor-pointer rounded-lg border p-2.5 text-left transition-all',
                selected
                  ? isDark
                    ? 'border-teal-400/60 bg-teal-500/10 shadow-lg shadow-teal-500/10'
                    : 'border-teal-500/60 bg-teal-50/80 shadow-md shadow-teal-500/5'
                  : isDark
                    ? 'border-gray-700 bg-gray-900/60 hover:border-gray-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm',
              )}
            >
              <p
                className={cn(
                  'line-clamp-2 text-[13px] font-semibold leading-snug',
                  isDark ? 'text-white' : 'text-slate-900',
                )}
              >
                {job.title}
              </p>
              <p
                className={cn(
                  'mt-0.5 line-clamp-1 text-[11px]',
                  isDark ? 'text-gray-400' : 'text-slate-600',
                )}
              >
                {job.company}
              </p>
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-[10px]',
                  isDark ? 'text-gray-500' : 'text-slate-500',
                )}
              >
                <MapPin className='w-3 h-3' />
                {job.location}
                {job.salary && <span className='ml-auto font-semibold'>{job.salary}</span>}
              </p>
            </button>
          )
        })}
      </div>
    </HubSectionPanel>
  )
}
