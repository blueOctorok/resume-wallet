import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { CdlRow, MvrRow } from '@/lib/block-data'

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
    
    const jobId = searchParams.get('jobId')
    const cdlClass = searchParams.get('cdlClass')
    const cdlState = searchParams.get('cdlState')
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
    let jobCriteria: Record<string, string | null> | null = null
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

    // Resolve final filter values (job criteria takes precedence over query params)
    const filterCdlClass = jobCriteria?.cdlClass || cdlClass
    const filterCdlState = jobCriteria?.cdlState || cdlState
    const filterLocationState = jobCriteria?.locationState || locationState
    const filterLocationCity = jobCriteria?.locationCity || locationCity

    // CDL data lives in block_driver_cdl — filter there
    let cdlQuery = supabase
      .from('block_driver_cdl')
      .select('user_id, cdl_class, cdl_state, cdl_expiration, endorsements')
      .not('cdl_class', 'is', null)
      .limit(limit)

    if (filterCdlClass) {
      cdlQuery = cdlQuery.eq('cdl_class', filterCdlClass)
    }
    if (filterCdlState) {
      cdlQuery = cdlQuery.eq('cdl_state', filterCdlState)
    }

    const { data: cdlRows, error: cdlError } = await cdlQuery

    if (cdlError) {
      console.error('[DRIVER SEARCH] CDL query error:', cdlError)
      return NextResponse.json(
        { error: 'Failed to search drivers' },
        { status: 500 }
      )
    }

    const driverUserIds = (cdlRows || []).map(r => r.user_id)
    if (driverUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        drivers: [],
        jobs: [],
        criteria: jobCriteria || { cdlClass: filterCdlClass, cdlState: filterCdlState, locationState: filterLocationState, locationCity: filterLocationCity },
        total: 0,
      })
    }

    // Build a CDL lookup keyed by user_id
    const cdlMap = new Map<string, Pick<CdlRow, 'cdl_class' | 'cdl_state' | 'cdl_expiration' | 'endorsements'>>()
    for (const row of cdlRows ?? []) cdlMap.set(row.user_id, row)

    // Batch-fetch MVR, share, user profiles, resumes, DOT apps, existing applications
    const [
      { data: mvrRows },
      { data: shareRows },
      { data: userProfiles },
      { data: resumes },
      { data: dotApps },
      { data: companyJobs },
    ] = await Promise.all([
      supabase
        .from('block_driver_mvr')
        .select('user_id, license_status, violation_count, total_points')
        .in('user_id', driverUserIds),
      supabase
        .from('users')
        .select('id, share_token, share_settings, created_at')
        .in('id', driverUserIds),
      supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, email, phone, city, state, headline')
        .in('user_id', driverUserIds),
      supabase
        .from('resumes')
        .select('user_id, id, title, filename, ipfs_hash, verification_status')
        .in('user_id', driverUserIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('driver_applications')
        .select('user_id, id, verification_status, is_complete')
        .in('user_id', driverUserIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_postings')
        .select('id')
        .eq('company_id', company.id),
    ])

    // MVR filter: if caller wants clean MVR, filter user IDs down now
    const mvrMap = new Map<string, Pick<MvrRow, 'license_status' | 'violation_count' | 'total_points'>>()
    for (const row of mvrRows ?? []) mvrMap.set(row.user_id, row)

    let filteredUserIds = driverUserIds
    if (hasCleanMvr || jobCriteria) {
      filteredUserIds = driverUserIds.filter(uid => {
        const mvr = mvrMap.get(uid)
        return mvr && mvr.license_status === 'Valid' && mvr.violation_count === 0
      })
    }

    const shareMap = new Map<string, { share_token: string | null; share_settings: unknown; created_at: string }>()
    for (const row of shareRows ?? []) shareMap.set(row.id, row)

    const upMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; city: string | null; state: string | null; headline: string | null }>()
    for (const p of userProfiles ?? []) upMap.set(p.user_id, p)

    // Existing applications to this company's jobs
    const jobIds = (companyJobs || []).map(j => j.id)
    const { data: existingApps } = jobIds.length > 0 && filteredUserIds.length > 0
      ? await supabase
          .from('applications')
          .select('driver_user_id, job_posting_id, status')
          .in('driver_user_id', filteredUserIds)
          .in('job_posting_id', jobIds)
      : { data: null }

    // Assemble response — same shape as before
    const drivers = filteredUserIds.map(userId => {
      const cdl = cdlMap.get(userId)
      const mvr = mvrMap.get(userId)
      const share = shareMap.get(userId)
      const up = upMap.get(userId)

      const driverResumes = (resumes || []).filter(r => r.user_id === userId)
      const verifiedResume = driverResumes.find(r => r.verification_status === 'VERIFIED')
      const latestResume = driverResumes[0]

      const driverDotApps = (dotApps || []).filter(a => a.user_id === userId)
      const completeDotApp = driverDotApps.find(a => a.is_complete)

      const hasApplied = (existingApps || []).some(a => a.driver_user_id === userId)

      if (hasVerifiedResume && !verifiedResume) return null
      if (hasCompleteDotApp && !completeDotApp) return null

      return {
        driverId: userId,
        profileId: userId,
        name: [up?.first_name, up?.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: up?.email || null,
        phone: up?.phone || null,
        location: up?.city && up?.state ? `${up.city}, ${up.state}` : null,
        professionalSummary: up?.headline ?? null,
        cdlClass: cdl?.cdl_class ?? null,
        cdlState: cdl?.cdl_state ?? null,
        cdlExpiration: cdl?.cdl_expiration ?? null,
        endorsements: cdl?.endorsements || [],
        experienceYears: null as number | null,
        hasResume: !!latestResume,
        hasVerifiedResume: !!verifiedResume,
        resumeId: verifiedResume?.id || latestResume?.id || null,
        resumeTitle: verifiedResume?.title || latestResume?.title || null,
        resumeIpfsHash: verifiedResume?.ipfs_hash || latestResume?.ipfs_hash || null,
        hasCompleteDotApp: !!completeDotApp,
        dotAppVerified: completeDotApp?.verification_status === 'VERIFIED',
        mvrStatus: mvr?.license_status ?? null,
        mvrViolations: mvr?.violation_count ?? 0,
        mvrPoints: mvr?.total_points ?? 0,
        hasCleanMvr: mvr?.license_status === 'Valid' && (mvr?.violation_count ?? 0) === 0,
        shareToken: share?.share_token ?? null,
        shareEnabled: !!share?.share_token && (share?.share_settings as Record<string, unknown>)?.allowConnect !== false,
        hasApplied,
        profileCreatedAt: share?.created_at ?? null,
      }
    }).filter(d => d !== null)

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
