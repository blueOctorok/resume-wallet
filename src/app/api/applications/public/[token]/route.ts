import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Use service role key to bypass RLS for public access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get application with related data (query base tables since service role bypasses RLS)
    const { data: application, error } = await supabase
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
      .eq('share_token', token)
      .single()

    if (error || !application) {
      console.error('[PUBLIC APPLICATION] Not found:', token, error)
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Transform to match expected format
    const jobPosting = application.job_postings
    const location = jobPosting?.location_city && jobPosting?.location_state
      ? `${jobPosting.location_city}, ${jobPosting.location_state}`
      : jobPosting?.location_city || jobPosting?.location_state || 'Location not specified'
    
    const employerName = jobPosting?.companies?.company_name || 
                        (jobPosting?.external_source ? `Via ${jobPosting.external_source}` : 'Unknown Employer')

    // Extract application data (stored as JSONB snapshot)
    const appData = application.application_data || {}
    
    const publicApplication = {
      id: application.id,
      job_title: jobPosting?.title || 'Job title not available',
      employer_name: employerName,
      job_location: location,
      job_salary_min: jobPosting?.pay_range_min || application.job_salary_min,
      job_salary_max: jobPosting?.pay_range_max || application.job_salary_max,
      status: application.status,
      created_at: application.applied_at,
      driver_name: appData.driver_name || 'Driver',
      driver_email: appData.driver_email || null,
      cdl_class: appData.cdl_class || null,
      cdl_endorsements: appData.cdl_endorsements || null,
      cdl_state: appData.cdl_state || null,
      experience_years: appData.experience_years || null,
      resume_url: appData.resume_url || null,
      cover_letter: application.cover_letter,
      application_data: appData
    }

    return NextResponse.json({
      success: true,
      application: publicApplication
    })

  } catch (error) {
    console.error('[PUBLIC APPLICATION] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

