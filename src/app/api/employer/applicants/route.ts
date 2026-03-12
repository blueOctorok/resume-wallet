import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/applicants
 *
 * Fetches all applicants who have applied to this employer's job postings.
 * Supports team-based access via company_members table.
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
        { status: 401 },
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check company_members for team-based access
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id

    // Fall back to legacy employer_user_id check
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Build query
    // applications has applicant_user_id → users (renamed from driver_user_id in migration 016)
    // driver_profiles has user_id → users
    // So we get driver_profiles via users (no direct FK from applications to driver_profiles)
    let query = supabase
      .from('applications')
      .select(
        `
        id,
        status,
        applied_at,
        view_count,
        last_viewed_at,
        cover_letter,
        reviewer_notes,
        share_token,
        applicant_user_id,
        job_posting_id,
        job_postings!inner (
          id,
          title,
          company_id,
          target_role
        ),
        users!applications_applicant_user_id_fkey (
          id,
          wallet_address,
          email,
          role,
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
          )
        ),
        resumes (
          id,
          title,
          filename,
          ipfs_hash,
          verification_status
        )
      `,
      )
      .eq('job_postings.company_id', companyId)

    // Filter by job if specified
    if (jobId) {
      query = query.eq('job_posting_id', jobId)
    }

    // Filter by status if specified
    if (status) {
      query = query.eq('status', status)
    }

    // Sort (only by application fields; name sort done in JS below)
    const orderBy = sortBy === 'name' ? 'applied_at' : sortBy
    query = query.order(orderBy, { ascending: sortOrder === 'asc' })

    const { data: applications, error: appsError } = await query

    if (appsError) {
      console.error('[APPLICANTS] Error:', appsError)
      return NextResponse.json(
        { error: 'Failed to fetch applicants' },
        { status: 500 },
      )
    }

    // Process applicants (driver_profiles is nested under users)
    // Generic naming with backward compatibility
    const applicants = (applications || []).map((app) => {
      const applicantUser = app.users as {
        id: string
        wallet_address?: string
        email?: string
        role?: string
        driver_profiles?: unknown
      } | null
      const driverProfiles = applicantUser?.driver_profiles
      const driverProfile = Array.isArray(driverProfiles)
        ? driverProfiles[0]
        : driverProfiles
      const resume = Array.isArray(app.resumes) ? app.resumes[0] : app.resumes
      const jobPosting = app.job_postings as any

      const name = driverProfile
        ? `${driverProfile.first_name || ''} ${driverProfile.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown'
      const email = driverProfile?.email || applicantUser?.email || null
      const phone = driverProfile?.phone || null

      return {
        applicationId: app.id,
        status: app.status,
        appliedAt: app.applied_at,
        viewCount: app.view_count || 0,
        lastViewedAt: app.last_viewed_at,
        coverLetter: app.cover_letter,
        reviewerNotes: app.reviewer_notes,
        shareToken: app.share_token,
        // Applicant info (generic)
        applicantUserId: app.applicant_user_id,
        applicantRole: applicantUser?.role || 'driver',
        applicantName: name,
        applicantEmail: email,
        applicantPhone: phone,
        applicantLocation:
          driverProfile?.city && driverProfile?.state
            ? `${driverProfile.city}, ${driverProfile.state}`
            : driverProfile?.state || null,
        // CDL info (driver-specific)
        cdlClass: driverProfile?.cdl_class || null,
        cdlState: driverProfile?.cdl_state || null,
        cdlExpiration: driverProfile?.cdl_expiration || null,
        experienceYears: driverProfile?.experience_years || null,
        professionalSummary: driverProfile?.professional_summary || null,
        // Job info
        jobPostingId: app.job_posting_id,
        jobTitle: jobPosting?.title || 'Unknown Position',
        jobTargetRole: jobPosting?.target_role || 'driver',
        // Resume info
        hasResume: !!resume,
        resumeId: resume?.id || null,
        resumeTitle: resume?.title || resume?.filename || null,
        resumeVerified: resume?.verification_status === 'VERIFIED',
        resumeIpfsHash: resume?.ipfs_hash || null,
        // Legacy aliases for backward compatibility
        driverUserId: app.applicant_user_id,
        driverName: name,
        driverEmail: email,
        driverPhone: phone,
        driverLocation:
          driverProfile?.city && driverProfile?.state
            ? `${driverProfile.city}, ${driverProfile.state}`
            : driverProfile?.state || null,
      }
    })

    // Sort by name client-side if requested (driver_profiles is nested, not in DB order)
    if (sortBy === 'name' && applicants.length > 0) {
      applicants.sort((a, b) => {
        const nameA = (a.driverName || '').toLowerCase()
        const nameB = (b.driverName || '').toLowerCase()
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA)
      })
    }

    // Batch-fetch live MVR status and bgcheck consent for all applicants.
    // We do this after the main map so we can use a single query per table
    // instead of one query per applicant (N+1 problem).
    const userIds = applicants.map(a => a.driverUserId).filter(Boolean)

    // FCRA isolation: only surface self-ordered MVRs OR this company's own orders.
    const [{ data: mvrOrders }, { data: consents }] = await Promise.all([
      userIds.length
        ? supabase
            .from('mvr_orders')
            .select('driver_user_id, status, ordered_by_company_id, ordered_at')
            .in('driver_user_id', userIds)
            // self-ordered (NULL) OR this company's private order
            .or(`ordered_by_company_id.is.null,ordered_by_company_id.eq.${companyId}`)
            .order('ordered_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase
            .from('bgcheck_consents')
            .select('driver_user_id')
            .in('driver_user_id', userIds)
            .eq('company_id', companyId)
        : Promise.resolve({ data: [] }),
    ])

    // Build lookup maps userId → latest MVR + whether consent exists
    const mvrByUser = new Map<string, { status: string; orderedByThisCompany: boolean }>()
    for (const order of mvrOrders ?? []) {
      if (!mvrByUser.has(order.driver_user_id)) {
        mvrByUser.set(order.driver_user_id, {
          status: order.status,
          orderedByThisCompany: order.ordered_by_company_id === companyId,
        })
      }
    }
    const consentUserIds = new Set((consents ?? []).map(c => c.driver_user_id))

    // Merge MVR + consent data into each applicant
    const enrichedApplicants = applicants.map(a => ({
      ...a,
      hasMvr: mvrByUser.has(a.driverUserId),
      mvrStatus: mvrByUser.get(a.driverUserId)?.status ?? null,
      mvrOrderedByThisCompany: mvrByUser.get(a.driverUserId)?.orderedByThisCompany ?? false,
      hasBgcheckConsent: consentUserIds.has(a.driverUserId),
    }))

    // Get job postings for filter dropdown
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('id, title, is_active, target_role')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Stats
    const stats = {
      total: applicants.length,
      new: applicants.filter((a) => a.status === 'submitted').length,
      reviewing: applicants.filter((a) =>
        ['reviewing', 'viewed'].includes(a.status),
      ).length,
      interviewing: applicants.filter((a) =>
        ['interview', 'interviewing'].includes(a.status),
      ).length,
      offerSent: applicants.filter((a) =>
        ['offer_sent', 'offer'].includes(a.status),
      ).length,
      hired: applicants.filter((a) => a.status === 'hired').length,
      rejected: applicants.filter((a) => a.status === 'rejected').length,
    }

    return NextResponse.json({
      success: true,
      applicants: enrichedApplicants,
      jobs: jobs || [],
      stats,
    })
  } catch (error) {
    console.error('[APPLICANTS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/employer/applicants
 *
 * Updates an application's status or adds reviewer notes.
 * Supports team-based access - requires recruiter role or above.
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { applicationId, status, reviewerNotes } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 },
      )
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check company_members for team-based access with appropriate role
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    const userRole = membership?.role

    // Fall back to legacy employer_user_id check
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check if user has permission to update applications
    // Requires owner, admin, hr_manager, hiring_manager, or recruiter role
    const canUpdateRoles = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter']
    if (userRole && !canUpdateRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to update applications' },
        { status: 403 },
      )
    }

    // Verify application belongs to this company
    const { data: application } = await supabase
      .from('applications')
      .select(
        `
        id,
        job_postings!inner (company_id)
      `,
      )
      .eq('id', applicationId)
      .single()

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      )
    }

    const jobPosting = application.job_postings as any
    if (jobPosting.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
        { status: 500 },
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
      { status: 500 },
    )
  }
}
