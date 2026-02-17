import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      walletAddress,
      jobId,
      jobTitle,
      employerName,
      jobLocation,
      jobSalaryMin,
      jobSalaryMax,
      jobUrl,
      coverLetter,
      jobSource = 'adzuna'
    } = body

    console.log('[APPLICATION SUBMIT] Starting submission:', {
      walletAddress,
      jobId,
      jobTitle,
      employerName
    })

    if (!walletAddress || !jobId || !jobTitle || !employerName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[APPLICATION SUBMIT] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create driver profile
    let { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If profile doesn't exist, create a basic one
    if (profileError && profileError.code === 'PGRST116') {
      console.log('[APPLICATION SUBMIT] Creating new profile for user:', user.id)
      
      const { data: newProfile, error: createError } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: user.id,
          profile_completion_score: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('[APPLICATION SUBMIT] Error creating profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create driver profile' },
          { status: 500 }
        )
      }

      profile = newProfile
    } else if (profileError) {
      console.error('[APPLICATION SUBMIT] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch driver profile' },
        { status: 500 }
      )
    }

    // Check if job_posting exists for this external job, create if not
    let jobPostingId = null
    
    const { data: existingJob } = await supabase
      .from('job_postings')
      .select('id')
      .eq('external_job_id', jobId)
      .eq('is_external', true)
      .single()

    if (existingJob) {
      jobPostingId = existingJob.id
    } else {
      // Create job posting for this external job
      const { data: newJob, error: jobError } = await supabase
        .from('job_postings')
        .insert({
          title: jobTitle,
          is_external: true,
          external_source: jobSource,
          external_job_id: jobId,
          redirect_url: jobUrl,
          location_city: jobLocation?.split(',')[0]?.trim() || null,
          location_state: jobLocation?.split(',')[1]?.trim() || null,
          pay_range_min: jobSalaryMin,
          pay_range_max: jobSalaryMax,
          is_active: true
        })
        .select('id')
        .single()

      if (jobError) {
        console.error('[APPLICATION SUBMIT] Error creating job posting:', jobError)
        return NextResponse.json(
          { error: 'Failed to create job posting' },
          { status: 500 }
        )
      }

      jobPostingId = newJob.id
    }

    // Check for duplicate application
    // Note: Column renamed from driver_user_id to applicant_user_id in migration 016
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('applicant_user_id', user.id)
      .eq('job_posting_id', jobPostingId)
      .single()

    if (existingApp) {
      return NextResponse.json(
        { error: 'You have already applied to this job' },
        { status: 409 }
      )
    }

    // Generate unique share token
    const shareToken = nanoid(16)

    // Prepare application data snapshot
    const applicationData = {
      applicant_name: user.name,
      applicant_email: user.email,
      // Driver-specific fields (will be null for non-drivers)
      cdl_class: profile.cdl_class,
      cdl_endorsements: profile.cdl_endorsements,
      cdl_state: profile.cdl_state,
      experience_years: profile.experience_years,
      resume_url: profile.resume_url,
      dot_application: profile.dot_application_data,
      submitted_at: new Date().toISOString()
    }

    // Create application record
    // Note: Column renamed from driver_user_id to applicant_user_id in migration 016
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        applicant_user_id: user.id,
        job_posting_id: jobPostingId,
        driver_application_id: profile.driver_application_id,
        resume_id: profile.resume_id,
        cover_letter: coverLetter,
        application_data: applicationData,
        share_token: shareToken,
        status: 'submitted'
      })
      .select()
      .single()

    if (appError) {
      console.error('[APPLICATION SUBMIT] Error creating application:', appError)
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      )
    }

    console.log('[APPLICATION SUBMIT] Application created:', application.id)

    // TODO: Queue email delivery job (we'll implement this next)
    // For now, we'll just mark it as pending
    // In the next step, we'll integrate Resend to send the actual email

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        shareToken: application.share_token,
        shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/application/${application.share_token}`,
        status: application.status
      }
    })

  } catch (error) {
    console.error('[APPLICATION SUBMIT] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

