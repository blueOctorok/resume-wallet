import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * Helper to get employer's company ID
 */
async function getEmployerCompanyId(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  employerUserId: string
): Promise<{ companyId?: string; employerId?: string; error?: string; status?: number }> {
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', employerUserId)
    .eq('is_active', true)
    .single()

  let companyId = membership?.company_id || null

  if (!companyId) {
    const { data: legacyCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', employerUserId)
      .single()

    companyId = legacyCompany?.id || null
  }

  if (!companyId) return { error: 'No company found. Set up your company first.', status: 403 }

  return { companyId, employerId: employerUserId }
}

/**
 * GET /api/employer/jobs
 * Fetches all job postings for the employer's company.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const result = await getEmployerCompanyId(supabase, userId)

    if (result.error) {
      // No company = empty jobs list (not an error for GET)
      if (result.status === 403) return NextResponse.json({ jobs: [] })
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { data: jobs, error } = await supabase
      .from('job_postings')
      .select(`
        id, title, description, requirements, target_role,
        location_city, location_state, salary_min, salary_max,
        job_type, route_type, experience_required, remote_allowed,
        is_active, created_at, updated_at
      `)
      .eq('company_id', result.companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[EMPLOYER JOBS] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({
      jobs: (jobs || []).map(job => ({
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        targetRole: job.target_role,
        locationCity: job.location_city,
        locationState: job.location_state,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        jobType: job.job_type,
        routeType: job.route_type,
        experienceRequired: job.experience_required,
        remoteAllowed: job.remote_allowed,
        isActive: job.is_active,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
    })
  } catch (error) {
    console.error('[EMPLOYER JOBS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employer/jobs
 * Creates a new job posting for the employer's company.
 * 
 * Body:
 *   - title (required)
 *   - description
 *   - requirements
 *   - targetRole: 'driver' | 'developer' | etc.
 *   - locationCity, locationState
 *   - salaryMin, salaryMax
 *   - jobType: 'full-time' | 'part-time' | 'contract'
 *   - routeType (driver): 'long-haul' | 'regional' | 'local'
 *   - experienceRequired
 *   - remoteAllowed (developer)
 *   - isActive (default true)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      requirements,
      targetRole = 'driver',
      locationCity,
      locationState,
      salaryMin,
      salaryMax,
      jobType,
      routeType,
      experienceRequired,
      remoteAllowed,
      isActive = true,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const result = await getEmployerCompanyId(supabase, userId)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { data: job, error } = await supabase
      .from('job_postings')
      .insert({
        company_id: result.companyId,
        title: title.trim(),
        description: description?.trim() || null,
        requirements: requirements?.trim() || null,
        target_role: targetRole,
        location_city: locationCity?.trim() || null,
        location_state: locationState?.trim() || null,
        salary_min: salaryMin ? parseInt(salaryMin, 10) : null,
        salary_max: salaryMax ? parseInt(salaryMax, 10) : null,
        job_type: jobType || null,
        route_type: routeType || null,
        experience_required: experienceRequired || null,
        remote_allowed: !!remoteAllowed,
        is_active: isActive,
      })
      .select()
      .single()

    if (error) {
      console.error('[EMPLOYER JOBS] Create error:', error)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    console.log(`[EMPLOYER JOBS] Created job "${title}" for company ${result.companyId}`)

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        description: job.description,
        targetRole: job.target_role,
        isActive: job.is_active,
        createdAt: job.created_at,
      },
    })
  } catch (error) {
    console.error('[EMPLOYER JOBS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
