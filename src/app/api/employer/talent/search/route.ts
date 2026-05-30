import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getBlockDefinition } from '@/lib/block-registry'

/**
 * GET /api/employer/talent/search
 * 
 * Searches for candidates (drivers & developers) using the career_cards view.
 * Uses the search_talent() SQL function for efficient filtering.
 * 
 * Query params:
 *   - role: 'driver' | 'developer' | null (all)
 *   - cdlClass: Filter by CDL class (A, B, C) - drivers only
 *   - state: Filter by state
 *   - minExperience: Minimum years of experience
 *   - hasMvr: Only show candidates with MVR
 *   - hasDriverApp: Only show candidates with DOT application
 *   - endorsements: Comma-separated endorsements (all must match)
 *   - search: Text search (name, city, email)
 *   - limit: Results limit (default 50, max 100)
 *   - offset: Pagination offset (default 0)
 *   - blockTypes: Comma-separated hub block_type ids — candidate must have all listed blocks installed
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    
    // Parse query params
    const role = searchParams.get('role') || null
    const cdlClass = searchParams.get('cdlClass')
    const state = searchParams.get('state')
    const minExperience = searchParams.get('minExperience')
    const hasMvr = searchParams.get('hasMvr')
    const hasDriverApp = searchParams.get('hasDriverApp')
    const endorsements = searchParams.get('endorsements')
    const searchText = searchParams.get('search')
    const blockTypesRaw = searchParams.get('blockTypes')
    const requiredBlockTypes = blockTypesRaw
      ? blockTypesRaw
          .split(',')
          .map((s) => s.trim())
          .filter((id) => getBlockDefinition(id))
      : []
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(limitRaw, 100)
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10)
    const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw)

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Check company membership (supports multi-user companies)
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    // Fallback to legacy employer_user_id if no membership
    let companyId: string | null = membership?.company_id || null
    
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
        .single()
      
      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company access. You must be part of a company to search talent.' },
        { status: 403 }
      )
    }

    // Validate minExperience to avoid passing NaN
    const minExpNum = minExperience ? parseInt(minExperience, 10) : null
    const pMinExperience = minExpNum !== null && !Number.isNaN(minExpNum) ? minExpNum : null

    // Call the search_talent() function, or fall back to direct view query if RPC fails
    let candidates: Array<{
      user_id: string
      full_name: string | null
      email: string | null
      city: string | null
      state: string | null
      years_experience: number | null
      cdl_class: string | null
      endorsements: string[] | null
      completeness_score: number | null
      has_mvr: boolean
      has_driver_app: boolean
      has_resume: boolean
      verified_jobs_count: number
      member_since: string
      role: string | null
    }> | null = null

    // Note: p_cdl_class and p_endorsements must be TEXT[] (not VARCHAR[]) to match
    // the text[] columns in career_cards. The function was updated in migration 029.
    const { data: rpcData, error: searchError } = await supabase
      .rpc('search_talent', {
        p_role: role || null,
        p_cdl_class: cdlClass ? [cdlClass] : null,
        p_state: state || null,
        p_min_experience: pMinExperience,
        p_has_mvr: hasMvr === 'true' ? true : hasMvr === 'false' ? false : null,
        p_has_driver_app: hasDriverApp === 'true' ? true : hasDriverApp === 'false' ? false : null,
        p_endorsements: endorsements
          ? endorsements.split(',').map((e: string) => e.trim()).filter(Boolean)
          : null,
        p_search_text: searchText || null,
        p_limit: limit,
        p_offset: offset,
      })

    if (searchError) {
      console.error('[TALENT SEARCH] RPC error:', searchError.message)

      // Fallback: query career_cards view directly with simple filters
      const viewQuery = supabase
        .from('career_cards')
        .select(`
          user_id,
          full_name,
          email,
          city,
          state,
          years_experience,
          cdl_class,
          endorsements,
          completeness_score,
          has_mvr,
          has_driver_app,
          has_resume,
          verified_jobs_count,
          member_since,
          role
        `)
        .order('completeness_score', { ascending: false })
        .order('member_since', { ascending: false })
        .range(offset, offset + limit - 1)

      if (role) viewQuery.eq('role', role)
      if (state) viewQuery.eq('state', state)
      if (cdlClass) viewQuery.eq('cdl_class', cdlClass)
      if (pMinExperience != null) viewQuery.gte('years_experience', pMinExperience)
      if (hasMvr === 'true') viewQuery.eq('has_mvr', true)
      if (hasMvr === 'false') viewQuery.eq('has_mvr', false)
      if (hasDriverApp === 'true') viewQuery.eq('has_driver_app', true)
      if (hasDriverApp === 'false') viewQuery.eq('has_driver_app', false)
      if (searchText) {
        viewQuery.or(`full_name.ilike.%${searchText}%,city.ilike.%${searchText}%,email.ilike.%${searchText}%`)
      }

      const { data: viewData, error: viewError } = await viewQuery

      if (viewError) {
        console.error('[TALENT SEARCH] Fallback view error:', viewError)
        return NextResponse.json(
          { error: 'Failed to search candidates', details: searchError.message },
          { status: 500 }
        )
      }

      candidates = viewData as typeof candidates
    } else {
      candidates = rpcData as typeof candidates
      console.log('[TALENT SEARCH] RPC returned', candidates?.length ?? 0, 'candidates')
    }

    // Get company's job postings for context (active jobs shown in UI dropdown)
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('id, title, target_role, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get ALL job posting IDs for this company (including inactive Talent Pool)
    // This ensures we detect candidates already in the pipeline via Talent Pool
    const { data: allCompanyJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', companyId)

    // Check which candidates have already applied to this company
    const candidateIds = (candidates || []).map((c: { user_id: string }) => c.user_id)
    
    let existingApplications: { applicant_user_id: string }[] = []
    if (candidateIds.length > 0) {
      const allJobIds = (allCompanyJobs || []).map(j => j.id)
      if (allJobIds.length > 0) {
        const { data: apps } = await supabase
          .from('applications')
          .select('applicant_user_id')
          .in('applicant_user_id', candidateIds)
          .in('job_posting_id', allJobIds)
        
        existingApplications = apps || []
      }
    }

    const appliedSet = new Set(existingApplications.map(a => a.applicant_user_id))

    type RawCandidate = {
      user_id: string
      full_name: string | null
      email: string | null
      city: string | null
      state: string | null
      years_experience: number | null
      cdl_class: string | null
      endorsements: string[] | null
      completeness_score: number | null
      has_mvr: boolean
      has_driver_app: boolean
      has_resume: boolean
      verified_jobs_count: number
      member_since: string
      role: string | null
    }

    // Filter out users whose profile was deleted — they have no name and shouldn't appear.
    // This is a safety net until migration 026 is applied to the DB, which fixes this at
    // the view level by requiring dp.id IS NOT NULL OR devp.id IS NOT NULL.
    let validCandidates = (candidates || []).filter(
      (c: RawCandidate) => c.full_name !== null && c.full_name.trim() !== ''
    )

    // Optional: must have every listed block installed (hub_blocks)
    if (requiredBlockTypes.length > 0 && validCandidates.length > 0) {
      const uids = validCandidates.map((c: RawCandidate) => c.user_id)
      const { data: hubRows } = await supabase
        .from('hub_blocks')
        .select('user_id, block_type')
        .in('user_id', uids)

      const byUser = new Map<string, Set<string>>()
      for (const row of hubRows ?? []) {
        const uid = row.user_id as string
        const bt = row.block_type as string
        if (!byUser.has(uid)) byUser.set(uid, new Set())
        byUser.get(uid)!.add(bt)
      }

      validCandidates = validCandidates.filter((c: RawCandidate) => {
        const set = byUser.get(c.user_id) ?? new Set<string>()
        return requiredBlockTypes.every((bt) => set.has(bt))
      })
    }

    // Transform results
    const results = validCandidates.map((c: RawCandidate) => ({
      userId: c.user_id,
      name: c.full_name!,
      email: c.email,
      location: c.city && c.state ? `${c.city}, ${c.state}` : c.state || c.city || null,
      state: c.state,
      yearsExperience: c.years_experience,
      cdlClass: c.cdl_class,
      endorsements: c.endorsements || [],
      completenessScore: c.completeness_score || 0,
      hasMvr: c.has_mvr,
      hasDriverApp: c.has_driver_app,
      hasResume: c.has_resume,
      verifiedJobsCount: c.verified_jobs_count,
      memberSince: c.member_since,
      hasApplied: appliedSet.has(c.user_id),
      // Role derived from profile data in view — not users.role
      role: c.role,
    }))

    return NextResponse.json({
      success: true,
      candidates: results,
      jobs: jobs || [],
      pagination: {
        limit,
        offset,
        count: results.length,
        hasMore: results.length === limit,
      },
    })

  } catch (error) {
    console.error('[TALENT SEARCH] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
