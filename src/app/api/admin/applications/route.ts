import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { anyFieldMatchesSearch, paginateInMemory } from '@/lib/admin-search'

/**
 * GET /api/admin/applications
 * List all job applications with related data
 * 
 * Query params:
 *   status - Filter by status
 *   search - Search by applicant name/email or job title
 *   limit - Results per page (default 20)
 *   offset - Pagination offset
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const supabase = await getAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const hasSearch = search.length > 0

    // Build query with joins to get all related data
    // Note: We fetch user data separately since the FK name may vary
    // Note: Column renamed from driver_user_id to applicant_user_id in migration 016
    // Note: applications table uses 'applied_at' not 'created_at'
    //
    // Search spans joined fields (name, job, company) — when active we fetch the
    // status-filtered set WITHOUT range, filter in memory, then paginate. Otherwise
    // we'd only search the current page (the old bug).
    let query = supabase
      .from('applications')
      .select(`
        id, status, cover_letter, applied_at, updated_at,
        job_posting_id, applicant_user_id, driver_application_id, resume_id,
        job_postings(id, title, companies(id, company_name)),
        resumes(id, title, filename),
        driver_applications(id, is_complete, verification_status)
      `, { count: hasSearch ? undefined : 'exact' })
      .order('applied_at', { ascending: false })

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (!hasSearch) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: applications, error, count } = await query

    if (error) {
      console.error('[ADMIN APPLICATIONS] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Fetch user data separately (FK relationship name varies)
    const userIds = [...new Set((applications || []).map((a: any) => a.applicant_user_id).filter(Boolean))]
    let usersMap: Record<string, any> = {}
    let profileMap: Record<string, { first_name: string | null; last_name: string | null }> = {}
    
    if (userIds.length > 0) {
      const [{ data: users }, { data: userProfiles }] = await Promise.all([
        supabase.from('users').select('id, wallet_address, email').in('id', userIds),
        supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', userIds),
      ])
      
      if (users) usersMap = Object.fromEntries(users.map(u => [u.id, u]))
      const upMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])
      for (const id of userIds) {
        const up = upMap.get(id)
        if (up?.first_name) profileMap[id] = up
      }
    }

    // Transform for cleaner response
    const transformed = (applications || []).map((app: any) => {
      const user = usersMap[app.applicant_user_id]
      const profile = profileMap[app.applicant_user_id]
      const applicantName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || null
      return {
        id: app.id,
        status: app.status,
        coverLetter: app.cover_letter,
        createdAt: app.applied_at,
        updatedAt: app.updated_at,
        jobId: app.job_posting_id,
        jobTitle: app.job_postings?.title || 'Unknown Job',
        companyName: app.job_postings?.companies?.company_name || 'Unknown Company',
        applicantId: app.applicant_user_id,
        applicantWallet: user?.wallet_address,
        applicantEmail: user?.email,
        applicantName,
        resumeId: app.resume_id,
        resumeTitle: app.resumes?.title || app.resumes?.filename || null,
        dotApplicationId: app.driver_application_id,
        dotApplicationComplete: app.driver_applications?.is_complete || false,
        dotApplicationStatus: app.driver_applications?.verification_status || null,
      }
    })

    const filtered = hasSearch
      ? transformed.filter((app: {
          applicantName: string | null
          applicantEmail: string | null
          jobTitle: string
          companyName: string
          applicantWallet: string | undefined
        }) =>
          anyFieldMatchesSearch(
            search,
            app.applicantName,
            app.applicantEmail,
            app.jobTitle,
            app.companyName,
            app.applicantWallet,
          ),
        )
      : transformed

    const page = hasSearch ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      applications: page,
      total: hasSearch ? filtered.length : (count || 0),
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN APPLICATIONS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
