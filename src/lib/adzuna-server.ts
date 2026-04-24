/**
 * Server-only Adzuna job search (keys stay on the server).
 * Shared by /api/jobs/external/search and job recommendation AI.
 */

export interface AdzunaJobNormalized {
  id: string | number
  title: string
  company: string
  location: string
  description: string | null
  salary: string | null
  salary_min: number | null
  salary_max: number | null
  created: string
  redirect_url: string | null
  category: string | null
  contract_type: string | null
}

export async function searchAdzunaJobsServer(params: {
  keywords: string
  location?: string
  page?: number
  resultsPerPage?: number
  sortBy?: 'date' | 'salary'
  /** Minimum annual salary floor. Adzuna accepts this server-side. */
  salaryMin?: number | null
  /** Contract type flag — Adzuna uses separate boolean params per type. */
  jobType?: 'full_time' | 'part_time' | 'contract' | null
}): Promise<{ results: AdzunaJobNormalized[]; count: number }> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    throw new Error('ADZUNA_NOT_CONFIGURED')
  }

  const page = params.page ?? 1
  const resultsPerPage = params.resultsPerPage ?? 20
  const sortBy = params.sortBy ?? 'date'

  const adzunaUrl = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`)
  adzunaUrl.searchParams.set('app_id', appId)
  adzunaUrl.searchParams.set('app_key', appKey)
  adzunaUrl.searchParams.set('results_per_page', String(resultsPerPage))
  adzunaUrl.searchParams.set('what', params.keywords || 'jobs')
  adzunaUrl.searchParams.set('content-type', 'application/json')
  if (params.location?.trim()) {
    adzunaUrl.searchParams.set('where', params.location.trim())
  }
  adzunaUrl.searchParams.set('sort_by', sortBy === 'salary' ? 'salary' : 'date')
  if (params.salaryMin && params.salaryMin > 0) {
    adzunaUrl.searchParams.set('salary_min', String(Math.floor(params.salaryMin)))
  }
  // Adzuna uses mutually-exclusive boolean flags for contract type
  if (params.jobType === 'full_time') adzunaUrl.searchParams.set('full_time', '1')
  else if (params.jobType === 'part_time') adzunaUrl.searchParams.set('part_time', '1')
  else if (params.jobType === 'contract') adzunaUrl.searchParams.set('contract', '1')

  const response = await fetch(adzunaUrl.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Adzuna HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    results?: Array<Record<string, unknown>>
    count?: number
  }

  const results: AdzunaJobNormalized[] = (data.results ?? []).map((job) => ({
    id: job.id as string | number,
    title: (job.title as string) || 'Untitled',
    company: (job.company as { display_name?: string })?.display_name || 'Company not listed',
    location: (job.location as { display_name?: string })?.display_name || 'Location not specified',
    description: (job.description as string) || null,
    salary:
      job.salary_min && job.salary_max
        ? `$${Math.round(job.salary_min as number).toLocaleString()} - $${Math.round(job.salary_max as number).toLocaleString()}`
        : job.salary_min
          ? `$${Math.round(job.salary_min as number).toLocaleString()}+`
          : null,
    salary_min: (job.salary_min as number) ?? null,
    salary_max: (job.salary_max as number) ?? null,
    created: (job.created as string) || new Date().toISOString(),
    redirect_url: (job.redirect_url as string) || null,
    category: (job.category as { label?: string })?.label || null,
    contract_type: (job.contract_type as string) || null,
  }))

  return { results, count: data.count ?? results.length }
}
