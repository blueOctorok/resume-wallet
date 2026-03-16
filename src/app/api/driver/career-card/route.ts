import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/driver/career-card
 *
 * Returns the authenticated driver's own career card data in the exact same
 * shape as /api/employer/talent/[userId] so both views use the same
 * CareerCard component.
 *
 * No company context is included — pendingRequests and existingApplication
 * are always empty since this is a self-view.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve wallet → user
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, avatar_url, headline, email, phone, city, state')
      .eq('user_id', userId)
      .maybeSingle()

    // Career card view — aggregates profile, resume, DOT app, MVR flags
    const { data: careerCard, error: cardError } = await supabase
      .from('career_cards')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (cardError || !careerCard) {
      // User exists but has no career card entry yet (no profile data) —
      // return a minimal empty card rather than 404
      return NextResponse.json({
        success: true,
        careerCard: {
          userId,
          role: user.role,
          name: 'Unknown',
          email: user.email,
          phone: null,
          location: null,
          memberSince: user.created_at,
          profile: null,
          resume: null,
          driverApplication: null,
          mvr: null,
          workHistory: [],
          verifications: [],
          completenessScore: 0,
          workHistoryCount: 0,
          verifiedJobsCount: 0,
          hasProfile: false,
          hasResume: false,
          hasDriverApp: false,
          hasMvr: false,
          hasWorkHistory: false,
          pendingRequests: [],
          existingApplication: null,
          hasBgcheckConsent: false,
          bgcheckConsentSignedAt: null,
        },
      })
    }

    // Driver profile
    let driverProfile = null
    if (careerCard.driver_profile_id) {
      const { data: dp } = await supabase
        .from('driver_profiles')
        .select(
          `id, professional_summary, cdl_class, cdl_state, cdl_number,
           cdl_expiration, endorsements, cdl_endorsements, restrictions,
           experience_years, employment_history, education, skills,
           share_token, share_settings, created_at`,
        )
        .eq('id', careerCard.driver_profile_id)
        .single()
      driverProfile = dp
    }

    // Developer profile (if no driver profile)
    let developerProfile = null
    if (!driverProfile) {
      const { data: devp } = await supabase
        .from('developer_profiles')
        .select(
          `id, professional_summary, title, years_experience, employment_history,
           github_url, linkedin_url, portfolio_url, skills, education,
           share_token, share_settings`,
        )
        .eq('user_id', userId)
        .single()
      developerProfile = devp
    }

    // Resume
    let resume = null
    if (careerCard.resume_id) {
      const { data: res } = await supabase
        .from('resumes')
        .select('id, title, filename, ipfs_hash, verification_status, structured_data, created_at')
        .eq('id', careerCard.resume_id)
        .single()
      resume = res
    }

    // DOT application
    let driverApplication = null
    if (careerCard.driver_application_id) {
      const { data: da } = await supabase
        .from('driver_applications')
        .select('id, verification_status, is_complete, created_at')
        .eq('id', careerCard.driver_application_id)
        .single()
      driverApplication = da
    }

    // MVR
    let mvrData = null
    if (careerCard.latest_mvr_id) {
      const { data: mvr } = await supabase
        .from('mvr_orders')
        .select('id, status, dl_state, created_at, completed_at, ordered_by_company_id')
        .eq('id', careerCard.latest_mvr_id)
        .single()

      if (mvr) {
        const { data: mvrResults } = await supabase
          .from('mvr_results')
          .select('id, license_status, license_class, total_points, violation_count')
          .eq('mvr_order_id', mvr.id)
          .single()
        mvrData = { order: mvr, results: mvrResults, wasOrderedByEmployer: !!mvr.ordered_by_company_id }
      }
    }

    // Employment verifications
    const { data: verifications } = await supabase
      .from('employment_verification_requests')
      .select(
        'id, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, status, verified_at',
      )
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })

    // Construct response — same shape as /api/employer/talent/[userId]
    const upName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ')
    const effectiveRole = driverProfile ? 'driver' : developerProfile ? 'developer' : user.role

    return NextResponse.json({
      success: true,
      careerCard: {
        userId: user.id,
        role: effectiveRole,
        name: upName || careerCard.full_name || 'Unknown',
        avatarUrl: userProfile?.avatar_url ?? null,
        email: userProfile?.email || user.email,
        phone: userProfile?.phone || null,
        location: userProfile?.city && userProfile?.state
          ? `${userProfile.city}, ${userProfile.state}`
          : careerCard.state || null,
        memberSince: user.created_at,

        profile: driverProfile || developerProfile ? { ...(driverProfile || developerProfile), fullName: upName || 'Unknown' } : null,

        resume: resume
          ? {
              id: resume.id,
              title: resume.title,
              filename: resume.filename,
              ipfsHash: resume.ipfs_hash,
              verificationStatus: resume.verification_status,
              structuredData: resume.structured_data,
              createdAt: resume.created_at,
            }
          : null,

        driverApplication: driverApplication
          ? {
              id: driverApplication.id,
              status: driverApplication.verification_status,
              isComplete: driverApplication.is_complete,
              createdAt: driverApplication.created_at,
            }
          : null,

        mvr: mvrData
          ? {
              orderId: mvrData.order.id,
              orderStatus: mvrData.order.status,
              licenseState: mvrData.order.dl_state,
              orderedAt: mvrData.order.created_at,
              completedAt: mvrData.order.completed_at,
              wasOrderedByEmployer: mvrData.wasOrderedByEmployer,
              results: mvrData.results
                ? {
                    licenseStatus: mvrData.results.license_status,
                    licenseClass: mvrData.results.license_class,
                    totalPoints: mvrData.results.total_points,
                    violationCount: mvrData.results.violation_count,
                  }
                : null,
            }
          : null,

        workHistory: driverProfile?.employment_history || developerProfile?.employment_history || [],
        verifications: (verifications || []).map(v => ({
          id: v.id,
          employer: v.previous_employer_name,
          position: v.claimed_position,
          startDate: v.claimed_start_date,
          endDate: v.claimed_end_date,
          status: v.status,
          verifiedAt: v.verified_at,
        })),

        completenessScore: careerCard.completeness_score,
        workHistoryCount: careerCard.work_history_count,
        verifiedJobsCount: careerCard.verified_jobs_count,

        hasProfile: careerCard.has_profile,
        hasResume: careerCard.has_resume,
        hasDriverApp: careerCard.has_driver_app,
        hasMvr: careerCard.has_mvr,
        hasWorkHistory: careerCard.has_work_history,

        // No employer context for self-view
        pendingRequests: [],
        existingApplication: null,
        hasBgcheckConsent: false,
        bgcheckConsentSignedAt: null,
      },
    })
  } catch (error) {
    console.error('[DRIVER CAREER CARD] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
