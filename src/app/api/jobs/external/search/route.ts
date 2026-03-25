import { NextRequest, NextResponse } from 'next/server'
import { searchAdzunaJobsServer } from '@/lib/adzuna-server'

/**
 * Adzuna Job Search API Proxy — keys stay server-side.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const keywords = searchParams.get('keywords') || 'truck driver CDL'
    const location = searchParams.get('location') || ''
    const page = parseInt(searchParams.get('page') || '1', 10) || 1
    const resultsPerPage = searchParams.get('results_per_page') || '20'
    const sortBy = searchParams.get('sort_by') === 'salary' ? 'salary' : 'date'

    const { results, count } = await searchAdzunaJobsServer({
      keywords,
      location: location || undefined,
      page,
      resultsPerPage: parseInt(resultsPerPage, 10) || 20,
      sortBy,
    })

    const transformedResults = results.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      salary: j.salary,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      created: j.created,
      redirect_url: j.redirect_url,
      category: j.category,
      contract_type: j.contract_type,
      is_external: true,
    }))

    return NextResponse.json({
      success: true,
      results: transformedResults,
      count,
      page,
      results_per_page: parseInt(resultsPerPage, 10) || 20,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg === 'ADZUNA_NOT_CONFIGURED') {
      console.error('[JOB API] Adzuna API credentials not configured')
      return NextResponse.json(
        {
          error: 'Job search service not configured',
          debug:
            process.env.NODE_ENV === 'development'
              ? { ADZUNA_APP_ID: process.env.ADZUNA_APP_ID ? 'SET' : 'MISSING' }
              : undefined,
        },
        { status: 500 },
      )
    }
    console.error('[JOB API] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
