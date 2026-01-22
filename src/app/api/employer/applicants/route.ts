import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/applicants
 * 
 * Fetches all applicants who have applied to this employer's job postings.
 * Includes filtering, sorting, and status management.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { searchParams } = new URL(request.url)
    
    // Query params
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'applied_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user and company
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

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('applications')
      .select(`
        id,
        status,
        applied_at,
        view_count,
        last_viewed_at,
        cover_letter,
        reviewer_notes,
        share_token,
        driver_user_id,
        job_posting_id,
        job_postings!inner (
          id,
          title,
          company_id
        ),
        users!applications_driver_user_id_fkey (
          id,
          wallet_address,
          email
        ),
        driver_profiles (
          first_name,
          last_name,
          phone,
          email,
          cdl_number,
          cdl_class,
          cdl_state,
          cdl_expiration,
          experience_years,
          city,
          state,
          professional_summary
        ),
        resumes (
          id,
          title,
          filename,
          ipfs_hash,
          verification_status
        )
      `)
      .eq('job_postings.company_id', company.id)

    // Filter by job if specified
    if (jobId) {
      query = query.eq('job_posting_id', jobId)
    }

    // Filter by status if specified
    if (status) {
      query = query.eq('status', status)
    }

    // Sort
    const orderBy = sortBy === 'name' ? 'driver_profiles.first_name' : sortBy
    query = query.order(orderBy, { ascending: sortOrder === 'asc' })

    const { data: applications, error: appsError } = await query

    if (appsError) {
      console.error('[APPLICANTS] Error:', appsError)
      return NextResponse.json(
        { error: 'Failed to fetch applicants' },
        { status: 500 }
      )
    }

    // Process applicants
    const applicants = (applications || []).map(app => {
      const driverProfile = Array.isArray(app.driver_profiles) 
        ? app.driver_profiles[0] 
        : app.driver_profiles
      const resume = Array.isArray(app.resumes) ? app.resumes[0] : app.resumes
      const jobPosting = app.job_postings as any
      const driverUser = app.users as any

      return {
        applicationId: app.id,
        status: app.status,
        appliedAt: app.applied_at,
        viewCount: app.view_count || 0,
        lastViewedAt: app.last_viewed_at,
        coverLetter: app.cover_letter,
        reviewerNotes: app.reviewer_notes,
        shareToken: app.share_token,
        // Driver info
        driverUserId: app.driver_user_id,
        driverName: driverProfile 
          ? `${driverProfile.first_name || ''} ${driverProfile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown',
        driverEmail: driverProfile?.email || driverUser?.email || null,
        driverPhone: driverProfile?.phone || null,
        driverLocation: driverProfile?.city && driverProfile?.state
          ? `${driverProfile.city}, ${driverProfile.state}`
          : driverProfile?.state || null,
        // CDL info
        cdlClass: driverProfile?.cdl_class || null,
        cdlState: driverProfile?.cdl_state || null,
        cdlExpiration: driverProfile?.cdl_expiration || null,
        experienceYears: driverProfile?.experience_years || null,
        professionalSummary: driverProfile?.professional_summary || null,
        // Job info
        jobPostingId: app.job_posting_id,
        jobTitle: jobPosting?.title || 'Unknown Position',
        // Resume info
        hasResume: !!resume,
        resumeId: resume?.id || null,
        resumeTitle: resume?.title || resume?.filename || null,
        resumeVerified: resume?.verification_status === 'VERIFIED',
        resumeIpfsHash: resume?.ipfs_hash || null,
      }
    })

    // Get job postings for filter dropdown
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('id, title, is_active')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    // Stats
    const stats = {
      total: applicants.length,
      new: applicants.filter(a => a.status === 'submitted').length,
      reviewing: applicants.filter(a => ['reviewing', 'viewed'].includes(a.status)).length,
      interviewing: applicants.filter(a => ['interview', 'interviewing'].includes(a.status)).length,
      offerSent: applicants.filter(a => ['offer_sent', 'offer'].includes(a.status)).length,
      hired: applicants.filter(a => a.status === 'hired').length,
      rejected: applicants.filter(a => a.status === 'rejected').length,
    }

    return NextResponse.json({
      success: true,
      applicants,
      jobs: jobs || [],
      stats,
    })

  } catch (error) {
    console.error('[APPLICANTS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/employer/applicants
 * 
 * Updates an application's status or adds reviewer notes.
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { applicationId, status, reviewerNotes } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user and company
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Verify application belongs to this company
    const { data: application } = await supabase
      .from('applications')
      .select(`
        id,
        job_postings!inner (company_id)
      `)
      .eq('id', applicationId)
      .single()

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    const jobPosting = application.job_postings as any
    if (jobPosting.company_id !== company.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Update application
    const updateData: any = {}
    if (status) {
      updateData.status = status
      updateData.last_viewed_at = new Date().toISOString()
    }
    if (reviewerNotes !== undefined) {
      updateData.reviewer_notes = reviewerNotes
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update(updateData)
      .eq('id', applicationId)

    if (updateError) {
      console.error('[APPLICANTS] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Application updated successfully',
    })

  } catch (error) {
    console.error('[APPLICANTS] Update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
