import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/jobs/search
 *
 * Searches employer-posted (Storm) jobs. No auth required — these are
 * public listings. External/Adzuna jobs are handled by /api/jobs/external/search.
 *
 * Query params:
 *   keywords  — free-text search (matches title, description, company name)
 *   location  — matches location_city or location_state
 *   role      — target_role filter (driver, developer, etc.)
 *   type      — job_type filter (full-time, part-time, contract)
 *   sort      — 'date' (default) | 'salary'
 *   page      — 1-based page number (default 1)
 *   limit     — results per page (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const keywords = searchParams.get('keywords')?.trim() || ''
    const location = searchParams.get('location')?.trim() || ''
    const role = searchParams.get('role')?.trim() || ''
    const type = searchParams.get('type')?.trim() || ''
    const sort = searchParams.get('sort') || 'date'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const supabase = await getAdminSupabaseClient()

    let query = supabase
      .from('job_postings')
      .select(`
        id, title, description, target_role,
        location_city, location_state,
        salary_min, salary_max, job_type, route_type,
        experience_required, remote_allowed,
        created_at, updated_at,
        companies ( id, company_name, logo_url )
      `)
      .eq('is_active', true)
      .eq('is_external', false)
      .neq('title', '— Talent Pool —')

    if (role) {
      query = query.eq('target_role', role)
    }

    if (type) {
      query = query.eq('job_type', type)
    }

    if (keywords) {
      // ilike across title and description; company name is filtered client-side
      // since Supabase doesn't support OR across joined tables easily
      query = query.or(`title.ilike.%${keywords}%,description.ilike.%${keywords}%`)
    }

    if (location) {
      query = query.or(`location_city.ilike.%${location}%,location_state.ilike.%${location}%`)
    }

    if (sort === 'salary') {
      query = query.order('salary_max', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)

    const { data: jobs, error, count } = await query

    if (error) {
      console.error('[JOBS SEARCH]', error)
      return NextResponse.json({ error: 'Failed to search jobs' }, { status: 500 })
    }

    interface CompanyRow { id: string; company_name: string; logo_url: string | null }
    interface JobRow {
      id: string; title: string; description: string | null; target_role: string | null
      location_city: string | null; location_state: string | null
      salary_min: number | null; salary_max: number | null
      job_type: string | null; route_type: string | null
      experience_required: string | null; remote_allowed: boolean | null
      created_at: string; updated_at: string
      companies: CompanyRow | CompanyRow[] | null
    }

    const results = (jobs as JobRow[] || []).map((job) => {
      const company = Array.isArray(job.companies) ? job.companies[0] : job.companies
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        targetRole: job.target_role,
        company: company?.company_name || 'Company',
        companyLogoUrl: company?.logo_url || null,
        locationCity: job.location_city,
        locationState: job.location_state,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        jobType: job.job_type,
        routeType: job.route_type,
        experienceRequired: job.experience_required,
        remoteAllowed: job.remote_allowed,
        createdAt: job.created_at,
        isStormChain: true,
      }
    })

    return NextResponse.json({
      success: true,
      results,
      count: count ?? results.length,
      page,
      limit,
    })
  } catch (e) {
    console.error('[JOBS SEARCH]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
