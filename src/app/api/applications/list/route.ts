import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get all applications for this user with job details
    // Note: Column renamed from driver_user_id to applicant_user_id in migration 016
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select(`
        *,
        job_postings (
          title,
          location_city,
          location_state,
          pay_range_min,
          pay_range_max,
          redirect_url,
          external_source,
          target_role,
          company_id,
          companies (
            company_name
          )
        )
      `)
      .eq('applicant_user_id', sessionUserId)
      .order('applied_at', { ascending: false })

    if (appsError) {
      console.error('[APPLICATIONS LIST] Error fetching applications:', appsError)
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Transform the data to flatten job details
    const transformedApplications = (applications || []).map(app => {
      const jobPosting = app.job_postings
      const location = jobPosting?.location_city && jobPosting?.location_state
        ? `${jobPosting.location_city}, ${jobPosting.location_state}`
        : jobPosting?.location_city || jobPosting?.location_state || 'Location not specified'
      
      const employerName = jobPosting?.companies?.company_name || 
                          (jobPosting?.external_source ? `Via ${jobPosting.external_source}` : 'Unknown Employer')
      
      return {
        id: app.id,
        job_title: jobPosting?.title || 'Job title not available',
        employer_name: employerName,
        job_location: location,
        job_salary_min: jobPosting?.pay_range_min,
        job_salary_max: jobPosting?.pay_range_max,
        job_url: jobPosting?.redirect_url,
        status: app.status,
        candidate_status: app.candidate_status ?? null,
        created_at: app.applied_at,
        view_count: app.view_count || 0,
        last_viewed_at: app.last_viewed_at,
        share_token: app.share_token,
        cover_letter: app.cover_letter
      }
    })

    return NextResponse.json({
      success: true,
      applications: transformedApplications
    })

  } catch (error) {
    console.error('[APPLICATIONS LIST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

