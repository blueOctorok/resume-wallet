import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get all applications for this user with job details
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
          company_id,
          companies (
            company_name
          )
        )
      `)
      .eq('driver_user_id', user.id)
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

