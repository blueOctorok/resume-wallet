'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Shared job-search hook
 *
 * One place to hit Storm's internal `/api/jobs/search` and Adzuna's
 * `/api/jobs/external/search`. Returns a normalized `JobListing[]` used by
 * Guided Mode's `SimpleJobRail` (the only job-discovery surface in the app
 * since the legacy `JobListings` component was removed).
 *
 * Intentionally lean: no recommended-jobs logic — Stormi's lens picker and
 * career-card scoring handle role-aware ranking elsewhere.
 */

export type JobSource = 'stormchain' | 'adzuna'

export interface JobListing {
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

interface UseJobSearchOptions {
  source: JobSource
  keywords: string
  location: string
  sortBy?: 'date' | 'salary'
  page?: number
  resultsPerPage?: number
  /** Skip fetching entirely (handy before the first search commits). */
  skip?: boolean
  /** Adzuna-only: hide listings below this annual salary floor. */
  salaryMin?: number | null
  /** Adzuna-only: contract type filter. */
  jobType?: 'full_time' | 'part_time' | 'contract' | null
  /** Client-side post-filter on title/description text. */
  remoteOnly?: boolean
}

interface UseJobSearchResult {
  jobs: JobListing[]
  totalCount: number
  isLoading: boolean
  error: string | null
  /** Manual refetch (same params). */
  refetch: () => void
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`
  if (min) return `$${min.toLocaleString()}+`
  if (max) return `Up to $${max.toLocaleString()}`
  return null
}

function normalizeStormChainJob(j: Record<string, unknown>): JobListing {
  return {
    id: j.id as string,
    title: j.title as string,
    company: j.company as string,
    companyLogoUrl: (j.companyLogoUrl as string | null) ?? null,
    location: [j.locationCity, j.locationState].filter(Boolean).join(', ') || 'Remote',
    description: (j.description as string) || null,
    salary: formatSalary(j.salaryMin as number | null, j.salaryMax as number | null),
    salaryMin: (j.salaryMin as number | null) ?? null,
    salaryMax: (j.salaryMax as number | null) ?? null,
    created: j.createdAt as string,
    redirectUrl: null,
    category: (j.targetRole as string | null) ?? null,
    contractType: (j.jobType as string | null) ?? null,
    isStormChain: true,
    jobType: (j.jobType as string | null) ?? null,
    targetRole: (j.targetRole as string | null) ?? null,
    remoteAllowed: (j.remoteAllowed as boolean | null) ?? null,
  }
}

function normalizeAdzunaJob(j: Record<string, unknown>): JobListing {
  return {
    id: String(j.id),
    title: j.title as string,
    company: j.company as string,
    companyLogoUrl: null,
    location: j.location as string,
    description: (j.description as string) || null,
    salary: (j.salary as string) || null,
    salaryMin: (j.salary_min as number | null) ?? null,
    salaryMax: (j.salary_max as number | null) ?? null,
    created: (j.created as string) || new Date().toISOString(),
    redirectUrl: (j.redirect_url as string) || null,
    category: (j.category as string | null) ?? null,
    contractType: (j.contract_type as string | null) ?? null,
    isStormChain: false,
    jobType: (j.contract_type as string | null) ?? null,
    targetRole: null,
    remoteAllowed: null,
  }
}

/** Post-filter jobs by remote-ish hints. Cheap and conservative — we only */
/** match listings that explicitly mention remote work to keep false positives low. */
function isRemoteLeaning(job: JobListing): boolean {
  if (job.remoteAllowed === true) return true
  const haystack = `${job.title} ${job.location} ${job.description ?? ''}`.toLowerCase()
  return /\bremote\b|work.{0,4}from.{0,4}home|\bwfh\b|fully remote/.test(haystack)
}

export function useJobSearch(opts: UseJobSearchOptions): UseJobSearchResult {
  const {
    source,
    keywords,
    location,
    sortBy = 'date',
    page = 1,
    resultsPerPage = 20,
    skip = false,
    salaryMin = null,
    jobType = null,
    remoteOnly = false,
  } = opts

  const [jobs, setJobs] = useState<JobListing[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Bump to force refetch without changing params. */
  const [nonce, setNonce] = useState(0)

  // AbortController lets a stale search cancel itself when the user keeps typing
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (skip) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    const run = async () => {
      try {
        if (source === 'stormchain') {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(resultsPerPage),
            sort: sortBy,
          })
          if (keywords) params.set('keywords', keywords)
          if (location) params.set('location', location)
          const res = await fetch(`/api/jobs/search?${params}`, { signal: controller.signal })
          if (!res.ok) throw new Error('Failed to fetch ZKnight jobs')
          const data = await res.json()
          if (!data.success) throw new Error(data.error || 'Failed to load jobs')
          const results = ((data.results as Record<string, unknown>[]) ?? []).map(
            normalizeStormChainJob,
          )
          setJobs(results)
          setTotalCount(data.count ?? results.length)
        } else {
          const params = new URLSearchParams({
            keywords: keywords || 'jobs',
            location,
            page: String(page),
            results_per_page: String(resultsPerPage),
            sort_by: sortBy === 'salary' ? 'salary' : 'date',
          })
          if (salaryMin && salaryMin > 0) params.set('salary_min', String(salaryMin))
          if (jobType) params.set('job_type', jobType)
          const res = await fetch(`/api/jobs/external/search?${params}`, {
            signal: controller.signal,
          })
          if (!res.ok) throw new Error('Failed to fetch external jobs')
          const data = await res.json()
          if (!data.success) throw new Error(data.error || 'Failed to load jobs')
          const raw = ((data.results as Record<string, unknown>[]) ?? []).map(normalizeAdzunaJob)
          // Remote is a client-side post-filter — Adzuna lacks a reliable flag
          const results = remoteOnly ? raw.filter(isRemoteLeaning) : raw
          setJobs(results)
          setTotalCount(data.count ?? results.length)
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load jobs')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void run()

    return () => controller.abort()
  }, [
    source,
    keywords,
    location,
    sortBy,
    page,
    resultsPerPage,
    skip,
    nonce,
    salaryMin,
    jobType,
    remoteOnly,
  ])

  return { jobs, totalCount, isLoading, error, refetch }
}
