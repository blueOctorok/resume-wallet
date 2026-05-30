import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/jobs
 * Returns all job postings with company info for admin management.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const supabase = await getAdminSupabaseClient()

    const { data: jobs, error } = await supabase
      .from('job_postings')
      .select(`
        id, title, description, target_role, location_city, location_state,
        salary_min, salary_max, job_type, is_active, is_external, external_source,
        created_at, updated_at,
        company_id,
        companies (
          id, company_name, dot_number
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ADMIN JOBS] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    // Get application counts for each job
    const { data: applications } = await supabase
      .from('applications')
      .select('job_posting_id')
    
    const appCounts: Record<string, number> = {}
    for (const app of applications || []) {
      appCounts[app.job_posting_id] = (appCounts[app.job_posting_id] || 0) + 1
    }

    return NextResponse.json({
      jobs: (jobs || []).map(job => {
        const company = job.companies as { id: string; company_name: string; dot_number: string | null } | null
        return {
          id: job.id,
          title: job.title,
          description: job.description,
          targetRole: job.target_role,
          locationCity: job.location_city,
          locationState: job.location_state,
          salaryMin: job.salary_min,
          salaryMax: job.salary_max,
          jobType: job.job_type,
          isActive: job.is_active,
          isExternal: job.is_external ?? false,
          externalSource: job.external_source ?? null,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          companyId: job.company_id,
          companyName: company?.company_name || 'Unknown',
          companyDotNumber: company?.dot_number,
          applicationCount: appCounts[job.id] || 0,
        }
      }),
    })
  } catch (error) {
    console.error('[ADMIN JOBS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
