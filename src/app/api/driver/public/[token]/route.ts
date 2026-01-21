import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/driver/public/[token]
 * 
 * Fetches a driver's public profile by their share token.
 * No authentication required - this is the public view for employers.
 * Respects the driver's share_settings for privacy.
 * 
 * Returns:
 *   - profile: Driver's public profile data (filtered by share_settings)
 *   - resume: Latest verified resume (if showResume enabled)
 *   - dotApp: DOT application summary (if showDotApp enabled)
 *   - mvr: MVR summary (if showMvr enabled)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Invalid share token' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Find the driver profile by share token
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone,
        city,
        state,
        professional_summary,
        cdl_number,
        cdl_class,
        cdl_state,
        cdl_expiration,
        endorsements,
        experience_years,
        employment_history,
        education,
        skills,
        share_settings,
        share_views_count,
        mvr_license_status,
        mvr_total_points,
        mvr_violation_count,
        mvr_last_ordered_at,
        created_at,
        updated_at
      `)
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found or sharing is disabled' },
        { status: 404 }
      )
    }

    // Parse share settings
    const settings = profile.share_settings as {
      showResume?: boolean
      showDotApp?: boolean
      showMvr?: boolean
      showContact?: boolean
      allowConnect?: boolean
    } || {
      showResume: true,
      showDotApp: true,
      showMvr: true,
      showContact: false,
      allowConnect: true,
    }

    // Increment view count (fire and forget)
    supabase
      .from('driver_profiles')
      .update({ share_views_count: (profile.share_views_count || 0) + 1 })
      .eq('id', profile.id)
      .then(() => {})
      .catch(() => {})

    // Build the public profile based on settings
    const publicProfile: Record<string, any> = {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      location: profile.city && profile.state 
        ? `${profile.city}, ${profile.state}` 
        : profile.state || null,
      summary: profile.professional_summary,
      experienceYears: profile.experience_years,
      // CDL info is always shown (core to trucking)
      cdl: {
        class: profile.cdl_class,
        state: profile.cdl_state,
        expiration: profile.cdl_expiration,
        endorsements: profile.endorsements || [],
        // Don't show CDL number for privacy
      },
    }

    // Contact info only if enabled
    if (settings.showContact) {
      publicProfile.contact = {
        email: profile.email,
        phone: profile.phone,
      }
    }

    // Fetch resume if enabled
    let resume = null
    if (settings.showResume) {
      const { data: resumeData } = await supabase
        .from('resumes')
        .select('id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type')
        .eq('user_id', profile.user_id)
        .eq('verification_status', 'VERIFIED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (resumeData) {
        resume = {
          id: resumeData.id,
          title: resumeData.title,
          filename: resumeData.filename,
          verified: resumeData.verification_status === 'VERIFIED',
          blockchainVerified: !!resumeData.blockchain_tx_hash,
          type: resumeData.resume_type,
          createdAt: resumeData.created_at,
          // Include IPFS hash for viewing
          ipfsHash: resumeData.ipfs_hash,
        }
      }
    }

    // Fetch DOT application summary if enabled
    let dotApp = null
    if (settings.showDotApp) {
      const { data: dotAppData } = await supabase
        .from('driver_applications')
        .select('id, verification_status, blockchain_tx_hash, is_complete, current_step, created_at')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dotAppData) {
        // Calculate completion percentage (6 total steps)
        const totalSteps = 6
        const completionPct = dotAppData.is_complete 
          ? 100 
          : Math.round((dotAppData.current_step / totalSteps) * 100)

        dotApp = {
          id: dotAppData.id,
          verified: dotAppData.verification_status === 'VERIFIED',
          blockchainVerified: !!dotAppData.blockchain_tx_hash,
          isComplete: dotAppData.is_complete,
          completionPercentage: completionPct,
          createdAt: dotAppData.created_at,
        }
      }
    }

    // MVR summary if enabled
    let mvr = null
    if (settings.showMvr && profile.mvr_license_status) {
      mvr = {
        licenseStatus: profile.mvr_license_status,
        totalPoints: profile.mvr_total_points,
        violationCount: profile.mvr_violation_count,
        lastOrdered: profile.mvr_last_ordered_at,
        // Summary status for quick view
        status: profile.mvr_license_status === 'Valid' && (profile.mvr_violation_count || 0) === 0
          ? 'clean'
          : profile.mvr_license_status === 'Valid'
            ? 'valid_with_violations'
            : 'review_needed',
      }
    }

    // Employment history summary (if resume sharing enabled)
    let employmentSummary = null
    if (settings.showResume && profile.employment_history) {
      const history = profile.employment_history as Array<{
        companyName?: string
        position?: string
        startDate?: string
        endDate?: string
        isCurrent?: boolean
      }>
      
      if (Array.isArray(history) && history.length > 0) {
        employmentSummary = history.slice(0, 3).map(emp => ({
          company: emp.companyName,
          position: emp.position,
          startDate: emp.startDate,
          endDate: emp.isCurrent ? 'Present' : emp.endDate,
        }))
      }
    }

    return NextResponse.json({
      success: true,
      profile: publicProfile,
      resume,
      dotApp,
      mvr,
      employmentSummary,
      settings: {
        allowConnect: settings.allowConnect,
      },
      viewCount: (profile.share_views_count || 0) + 1,
    })

  } catch (error) {
    console.error('[PUBLIC PROFILE] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/driver/public/[token]
 * 
 * Creates a "lead" - employer connecting with driver after viewing profile.
 * This is the "I'm Hiring" / "Connect" action from the public profile.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    const {
      employerName,
      employerEmail,
      employerPhone,
      employerCompanyName,
      eventName,
      notes,
      source = 'qr_scan',
    } = body

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Invalid share token' },
        { status: 400 }
      )
    }

    // At least email or phone required for anonymous employers
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress && !employerEmail && !employerPhone) {
      return NextResponse.json(
        { error: 'Contact information required (email or phone)' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Find the driver profile
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('id, user_id, share_settings')
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if connections are allowed
    const settings = profile.share_settings as { allowConnect?: boolean } || {}
    if (settings.allowConnect === false) {
      return NextResponse.json(
        { error: 'This driver has disabled connection requests' },
        { status: 403 }
      )
    }

    // Get employer user and company if logged in
    let employerUserId = null
    let companyId = null

    if (walletAddress) {
      const { data: employerUser } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()

      if (employerUser) {
        employerUserId = employerUser.id

        // Check if employer has a company
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('employer_user_id', employerUser.id)
          .single()

        if (company) {
          companyId = company.id
        }
      }
    }

    // Check for duplicate lead (same employer-driver pair)
    if (employerUserId) {
      const { data: existingLead } = await supabase
        .from('driver_leads')
        .select('id')
        .eq('driver_user_id', profile.user_id)
        .eq('employer_user_id', employerUserId)
        .single()

      if (existingLead) {
        return NextResponse.json({
          success: true,
          message: 'You have already connected with this driver',
          leadId: existingLead.id,
          isExisting: true,
        })
      }
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('driver_leads')
      .insert({
        driver_user_id: profile.user_id,
        driver_profile_id: profile.id,
        employer_user_id: employerUserId,
        company_id: companyId,
        employer_name: employerName,
        employer_email: employerEmail,
        employer_phone: employerPhone,
        employer_company_name: employerCompanyName,
        event_name: eventName,
        notes,
        source,
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError) {
      console.error('[PUBLIC PROFILE] Lead creation error:', leadError)
      return NextResponse.json(
        { error: 'Failed to create connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Connection request sent! The driver will be notified.',
      leadId: lead.id,
    })

  } catch (error) {
    console.error('[PUBLIC PROFILE] Error creating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
