import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { nanoid } from 'nanoid'
import { getCdlData, getDevGithub, getDevPortfolio } from '@/lib/block-data'

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
      jobSource = 'adzuna',
      // Career Card Lens snapshot. Both fields are optional; default-lens
      // submissions send neither and get NULLs, which is fine.
      lensId,
      lensName,
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

    const [
      cdlData,
      { data: latestResume },
      { data: latestDotApp },
      { data: hubBlockRows },
      { data: userProfile },
      { data: mvrOrderRow },
      { data: devProjectRow },
      devPortfolio,
      devGithub,
    ] = await Promise.all([
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
        .select('id, application_data, is_complete')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabaseForBlocks
        .from('hub_blocks')
        .select('block_type')
        .eq('user_id', user.id)
        .order('position', { ascending: true }),
      adminSupabaseForBlocks
        .from('user_profiles')
        .select(
          'first_name, last_name, headline, professional_summary, city, state, email, phone',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      adminSupabaseForBlocks
        .from('mvr_orders')
        .select('id')
        .eq('driver_user_id', user.id)
        .limit(1)
        .maybeSingle(),
      adminSupabaseForBlocks
        .from('developer_projects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
      getDevPortfolio(adminSupabaseForBlocks, user.id),
      getDevGithub(adminSupabaseForBlocks, user.id),
    ])

    const installedBlockTypes = (hubBlockRows ?? []).map((r) => r.block_type as string)

    const applicantName =
      [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() || null
    const profileLocation =
      userProfile?.city && userProfile?.state
        ? `${userProfile.city}, ${userProfile.state}`
        : userProfile?.city || userProfile?.state || null

    const hasIdentity =
      !!(applicantName && applicantName.length > 0) ||
      !!(userProfile?.headline?.trim()) ||
      !!(userProfile?.professional_summary?.trim())
    const hasCareerArtifact =
      !!latestResume?.id ||
      !!latestDotApp?.id /* in-progress DOT still shows on career card */ ||
      !!(cdlData?.cdl_class && String(cdlData.cdl_class).trim()) ||
      !!(devPortfolio?.portfolio_url?.trim()) ||
      !!(devGithub?.username?.trim()) ||
      !!mvrOrderRow?.id ||
      !!devProjectRow?.id

    if (!hasIdentity) {
      return NextResponse.json(
        { error: 'Add your name or a professional headline in your profile before applying.' },
        { status: 400 },
      )
    }
    if (!hasCareerArtifact) {
      return NextResponse.json(
        {
          error:
            'Your career card needs content first — add a resume, portfolio link, or complete a hub block.',
        },
        { status: 400 },
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

    // Validate lens (if provided) belongs to this user before snapshotting.
    // A hostile/broken client could pass someone else's lens id; we fail
    // soft — just strip the bad reference rather than rejecting the apply.
    let verifiedLensId: string | null = null
    let verifiedLensName: string | null = null
    let lensVisibleBlockTypes: string[] | null = null
    if (typeof lensId === 'string' && lensId) {
      const { data: lensRow } = await adminSupabaseForBlocks
        .from('career_card_lenses')
        .select('id, name, visible_block_types, is_default')
        .eq('id', lensId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (lensRow) {
        verifiedLensId = lensRow.id
        verifiedLensName = (typeof lensName === 'string' && lensName.trim()) || lensRow.name
        // Default lens = full profile; only respect filtering when non-default.
        if (!lensRow.is_default) {
          lensVisibleBlockTypes = lensRow.visible_block_types ?? null
        }
      }
    }

    // If the applied lens hides block types, filter the snapshot so the
    // employer sees exactly what the candidate intended. Default lens or a
    // NULL visibility list both mean "show everything" — no filtering.
    const snapshotInstalledBlockTypes = lensVisibleBlockTypes
      ? installedBlockTypes.filter((bt) => lensVisibleBlockTypes!.includes(bt))
      : installedBlockTypes

    // Helper: `block_type` is hidden if the lens exists AND its visibility
    // list doesn't include it. `null` lens = full profile = nothing hidden.
    const lensHides = (blockType: string) =>
      lensVisibleBlockTypes !== null && !lensVisibleBlockTypes.includes(blockType)

    // Career-card style snapshot for all candidates; CDL/DOT when present.
    // Fields tied to lens-hidden blocks are nulled so employers see exactly
    // the framing the candidate submitted with — not their full profile.
    const applicationData = {
      applicant_name: applicantName,
      applicant_email: userProfile?.email ?? user.email,
      applicant_phone: userProfile?.phone ?? null,
      occupation: userProfile?.headline ?? null,
      professional_summary: userProfile?.professional_summary ?? null,
      location: profileLocation,
      installed_block_types: snapshotInstalledBlockTypes,
      cdl_class: lensHides('driver-cdl-credentials') ? null : cdlData?.cdl_class ?? null,
      cdl_endorsements: lensHides('driver-cdl-credentials') ? null : cdlData?.endorsements ?? null,
      cdl_state: lensHides('driver-cdl-credentials') ? null : cdlData?.cdl_state ?? null,
      resume_url:
        lensHides('general-resume') && lensHides('driver-resume') && lensHides('developer-resume')
          ? null
          : latestResume?.ipfs_url ?? null,
      dot_application:
        lensHides('driver-dot-application')
          ? null
          : latestDotApp?.is_complete
            ? latestDotApp.application_data ?? null
            : null,
      submitted_at: new Date().toISOString(),
    }

    // Create application record
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        applicant_user_id: user.id,
        job_posting_id: jobPostingId,
        driver_application_id:
          latestDotApp?.is_complete ? latestDotApp.id : null,
        resume_id: latestResume?.id ?? null,
        cover_letter: coverLetter,
        application_data: applicationData,
        share_token: shareToken,
        status: 'submitted',
        lens_id_snapshot: verifiedLensId,
        lens_name_snapshot: verifiedLensName,
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

