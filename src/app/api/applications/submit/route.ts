import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { nanoid } from 'nanoid'
import { getCdlData } from '@/lib/block-data'

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
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[APPLICATION SUBMIT] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Read block data and source tables directly
    const adminSupabaseForBlocks = await getAdminSupabaseClient()

    const [cdlData, { data: latestResume }, { data: latestDotApp }] = await Promise.all([
      getCdlData(adminSupabaseForBlocks, user.id),
      adminSupabaseForBlocks
        .from('resumes')
        .select('id, ipfs_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabaseForBlocks
        .from('driver_applications')
        .select('id, application_data')
        .eq('user_id', user.id)
        .eq('is_complete', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

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

    // Fetch name from user_profiles for the application snapshot
    const { data: userProfile } = await adminSupabaseForBlocks
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const applicantName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() || null

    // Prepare application data snapshot — CDL from block tables, rest from source tables
    const applicationData = {
      applicant_name: applicantName,
      applicant_email: user.email,
      cdl_class: cdlData?.cdl_class ?? null,
      cdl_endorsements: cdlData?.endorsements ?? null,
      cdl_state: cdlData?.cdl_state ?? null,
      resume_url: latestResume?.ipfs_url ?? null,
      dot_application: latestDotApp?.application_data ?? null,
      submitted_at: new Date().toISOString()
    }

    // Create application record
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        applicant_user_id: user.id,
        job_posting_id: jobPostingId,
        driver_application_id: latestDotApp?.id ?? null,
        resume_id: latestResume?.id ?? null,
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

