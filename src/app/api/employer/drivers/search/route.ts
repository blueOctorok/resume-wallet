import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/drivers/search
 * 
 * Searches for drivers who match job criteria.
 * This is for proactive discovery - finding drivers who haven't applied yet.
 * 
 * Query params:
 *   - jobId: Match drivers to a specific job's criteria
 *   - cdlClass: Filter by CDL class (A, B, C)
 *   - cdlState: Filter by CDL state
 *   - minExperience: Minimum years of experience
 *   - locationState: Filter by driver's state
 *   - locationCity: Filter by driver's city
 *   - hasVerifiedResume: Only show drivers with verified resumes
 *   - hasCompleteDotApp: Only show drivers with complete DOT applications
 *   - hasCleanMvr: Only show drivers with clean MVR records
 *   - limit: Results limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { searchParams } = new URL(request.url)
    
    // Query params
    const jobId = searchParams.get('jobId')
    const cdlClass = searchParams.get('cdlClass')
    const cdlState = searchParams.get('cdlState')
    const minExperience = searchParams.get('minExperience')
    const locationState = searchParams.get('locationState')
    const locationCity = searchParams.get('locationCity')
    const hasVerifiedResume = searchParams.get('hasVerifiedResume') === 'true'
    const hasCompleteDotApp = searchParams.get('hasCompleteDotApp') === 'true'
    const hasCleanMvr = searchParams.get('hasCleanMvr') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

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

    // If jobId provided, get job criteria
    let jobCriteria: any = null
    if (jobId) {
      const { data: job } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .eq('company_id', company.id)
        .single()

      if (job) {
        jobCriteria = {
          cdlClass: job.cdl_class_required,
          cdlState: job.cdl_state_required,
          minExperience: job.experience_required,
          locationState: job.location_state,
          locationCity: job.location_city,
          equipmentType: job.equipment_type,
        }
      }
    }

    // Build driver search query
    let query = supabase
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
        cdl_class,
        cdl_state,
        cdl_expiration,
        endorsements,
        experience_years,
        mvr_license_status,
        mvr_violation_count,
        mvr_total_points,
        share_token,
        share_settings,
        created_at,
        updated_at
      `)
      .not('first_name', 'is', null) // Only drivers with profiles
      .limit(limit)

    // Apply filters (use job criteria if available, otherwise use query params)
    const filterCdlClass = jobCriteria?.cdlClass || cdlClass
    const filterCdlState = jobCriteria?.cdlState || cdlState
    const filterMinExp = jobCriteria?.minExperience || minExperience
    const filterLocationState = jobCriteria?.locationState || locationState
    const filterLocationCity = jobCriteria?.locationCity || locationCity

    if (filterCdlClass) {
      query = query.eq('cdl_class', filterCdlClass)
    }

    if (filterCdlState) {
      query = query.eq('cdl_state', filterCdlState)
    }

    if (filterMinExp) {
      query = query.gte('experience_years', parseInt(filterMinExp))
    }

    if (filterLocationState) {
      query = query.eq('state', filterLocationState)
    }

    if (filterLocationCity) {
      query = query.eq('city', filterLocationCity)
    }

    // MVR filter (clean record)
    if (hasCleanMvr || jobCriteria) {
      query = query.eq('mvr_license_status', 'Valid')
      query = query.eq('mvr_violation_count', 0)
    }

    const { data: profiles, error: profilesError } = await query

    if (profilesError) {
      console.error('[DRIVER SEARCH] Error:', profilesError)
      return NextResponse.json(
        { error: 'Failed to search drivers' },
        { status: 500 }
      )
    }

    // Get additional data for each driver
    const driverIds = (profiles || []).map(p => p.user_id)
    
    // Get resumes
    const { data: resumes } = await supabase
      .from('resumes')
      .select('user_id, id, title, filename, ipfs_hash, verification_status')
      .in('user_id', driverIds)
      .order('created_at', { ascending: false })

    // Get DOT applications
    const { data: dotApps } = await supabase
      .from('driver_applications')
      .select('user_id, id, verification_status, is_complete')
      .in('user_id', driverIds)
      .order('created_at', { ascending: false })

    // Get existing applications to this company's jobs (to exclude them or mark them)
    // First get company's job IDs
    const { data: companyJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', company.id)

    const jobIds = (companyJobs || []).map(j => j.id)
    
    const { data: existingApps } = jobIds.length > 0 && driverIds.length > 0
      ? await supabase
          .from('applications')
          .select('driver_user_id, job_posting_id, status')
          .in('driver_user_id', driverIds)
          .in('job_posting_id', jobIds)
      : { data: null }

    // Process results
    const drivers = (profiles || []).map(profile => {
      // Get driver's latest verified resume
      const driverResumes = (resumes || []).filter(r => r.user_id === profile.user_id)
      const verifiedResume = driverResumes.find(r => r.verification_status === 'VERIFIED')
      const latestResume = driverResumes[0]

      // Get driver's DOT app
      const driverDotApps = (dotApps || []).filter(a => a.user_id === profile.user_id)
      const completeDotApp = driverDotApps.find(a => a.is_complete)

      // Check if already applied
      const hasApplied = (existingApps || []).some(a => a.driver_user_id === profile.user_id)

      // Apply additional filters
      if (hasVerifiedResume && !verifiedResume) {
        return null // Filter out if no verified resume
      }

      if (hasCompleteDotApp && !completeDotApp) {
        return null // Filter out if no complete DOT app
      }

      return {
        driverId: profile.user_id,
        profileId: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
        email: profile.email,
        phone: profile.phone,
        location: profile.city && profile.state 
          ? `${profile.city}, ${profile.state}` 
          : profile.state || null,
        professionalSummary: profile.professional_summary,
        // CDL info
        cdlClass: profile.cdl_class,
        cdlState: profile.cdl_state,
        cdlExpiration: profile.cdl_expiration,
        endorsements: profile.endorsements || [],
        experienceYears: profile.experience_years,
        // Credentials
        hasResume: !!latestResume,
        hasVerifiedResume: !!verifiedResume,
        resumeId: verifiedResume?.id || latestResume?.id || null,
        resumeTitle: verifiedResume?.title || latestResume?.title || null,
        resumeIpfsHash: verifiedResume?.ipfs_hash || latestResume?.ipfs_hash || null,
        hasCompleteDotApp: !!completeDotApp,
        dotAppVerified: completeDotApp?.verification_status === 'VERIFIED',
        // MVR
        mvrStatus: profile.mvr_license_status,
        mvrViolations: profile.mvr_violation_count || 0,
        mvrPoints: profile.mvr_total_points || 0,
        hasCleanMvr: profile.mvr_license_status === 'Valid' && (profile.mvr_violation_count || 0) === 0,
        // Share
        shareToken: profile.share_token,
        shareEnabled: !!profile.share_token && (profile.share_settings as any)?.allowConnect !== false,
        // Status
        hasApplied,
        profileCreatedAt: profile.created_at,
      }
    }).filter(d => d !== null) // Remove filtered out drivers

    // Get job postings for reference
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('id, title, is_active')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      drivers,
      jobs: jobs || [],
      criteria: jobCriteria || {
        cdlClass: filterCdlClass,
        cdlState: filterCdlState,
        minExperience: filterMinExp,
        locationState: filterLocationState,
        locationCity: filterLocationCity,
      },
      total: drivers.length,
    })

  } catch (error) {
    console.error('[DRIVER SEARCH] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
