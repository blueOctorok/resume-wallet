import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

// Valid data types for employer candidate data
const VALID_DATA_TYPES = [
  'note',           // Internal notes
  'rating',         // 1-5 star rating
  'tag',            // Custom tags
  'document',       // Uploaded documents (MVR, PSP, etc.)
  'interview',      // Interview notes and scheduling
  'assessment',     // Skills assessment results
  'offer',          // Offer details
  'rejection_reason' // Why candidate was rejected
]

// Roles that can add/view candidate data
const CAN_VIEW_ROLES = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer', 'viewer']
const CAN_ADD_ROLES = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer']

/**
 * GET /api/employer/candidate-data
 * 
 * Gets all employer data for a specific candidate.
 * Query params:
 *   - candidateId: Required - the user ID of the candidate
 *   - type: Optional - filter by data type
 *   - applicationId: Optional - filter by specific application
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidateId')
    const dataType = searchParams.get('type')
    const applicationId = searchParams.get('applicationId')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidateId is required' },
        { status: 400 }
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

    // Get user's company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    let userRole = membership?.role

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
      userRole = 'owner'
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check permission
    if (!CAN_VIEW_ROLES.includes(userRole || '')) {
      return NextResponse.json(
        { error: 'You do not have permission to view candidate data' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('employer_candidate_data')
      .select(`
        id,
        data_type,
        content,
        visible_to_candidate,
        application_id,
        created_by,
        updated_by,
        created_at,
        updated_at,
        users!employer_candidate_data_created_by_fkey (
          name,
          email
        )
      `)
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateId)
      .order('created_at', { ascending: false })

    if (dataType) {
      query = query.eq('data_type', dataType)
    }

    if (applicationId) {
      query = query.eq('application_id', applicationId)
    }

    const { data: candidateData, error: dataError } = await query

    if (dataError) {
      console.error('[CANDIDATE-DATA] Error fetching data:', dataError)
      return NextResponse.json(
        { error: 'Failed to fetch candidate data' },
        { status: 500 }
      )
    }

    // Process data
    const processedData = (candidateData || []).map(item => {
      const creator = item.users as any
      return {
        id: item.id,
        dataType: item.data_type,
        content: item.content,
        visibleToCandidate: item.visible_to_candidate,
        applicationId: item.application_id,
        createdBy: {
          name: creator?.name || 'Unknown',
          email: creator?.email,
        },
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    })

    // Group by type for convenience
    const byType = VALID_DATA_TYPES.reduce((acc, type) => {
      acc[type] = processedData.filter(d => d.dataType === type)
      return acc
    }, {} as Record<string, typeof processedData>)

    return NextResponse.json({
      success: true,
      data: processedData,
      byType,
      stats: {
        total: processedData.length,
        notes: byType.note.length,
        documents: byType.document.length,
        interviews: byType.interview.length,
      }
    })

  } catch (error) {
    console.error('[CANDIDATE-DATA] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employer/candidate-data
 * 
 * Adds new data to a candidate's profile.
 * Body:
 *   - candidateId: Required - the user ID of the candidate
 *   - dataType: Required - one of the valid data types
 *   - content: Required - the data content (JSONB)
 *   - visibleToCandidate: Optional - whether candidate can see this (default false)
 *   - applicationId: Optional - link to specific application
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { candidateId, dataType, content, visibleToCandidate = false, applicationId } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!candidateId || !dataType || !content) {
      return NextResponse.json(
        { error: 'candidateId, dataType, and content are required' },
        { status: 400 }
      )
    }

    if (!VALID_DATA_TYPES.includes(dataType)) {
      return NextResponse.json(
        { error: `Invalid dataType. Must be one of: ${VALID_DATA_TYPES.join(', ')}` },
        { status: 400 }
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

    // Get user's company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    let userRole = membership?.role

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
      userRole = 'owner'
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check permission
    if (!CAN_ADD_ROLES.includes(userRole || '')) {
      return NextResponse.json(
        { error: 'You do not have permission to add candidate data' },
        { status: 403 }
      )
    }

    // Verify candidate exists
    const { data: candidate } = await supabase
      .from('users')
      .select('id')
      .eq('id', candidateId)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // If applicationId provided, verify it belongs to this company
    if (applicationId) {
      const { data: application } = await supabase
        .from('applications')
        .select(`
          id,
          job_postings!inner (company_id)
        `)
        .eq('id', applicationId)
        .single()

      if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
      }

      const jobPosting = application.job_postings as any
      if (jobPosting.company_id !== companyId) {
        return NextResponse.json({ error: 'Application does not belong to your company' }, { status: 403 })
      }
    }

    // Create the data entry
    const { data: newData, error: insertError } = await supabase
      .from('employer_candidate_data')
      .insert({
        company_id: companyId,
        candidate_user_id: candidateId,
        data_type: dataType,
        content,
        visible_to_candidate: visibleToCandidate,
        application_id: applicationId || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CANDIDATE-DATA] Error creating data:', insertError)
      return NextResponse.json(
        { error: 'Failed to add candidate data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Candidate data added successfully',
      data: {
        id: newData.id,
        dataType: newData.data_type,
        content: newData.content,
        visibleToCandidate: newData.visible_to_candidate,
        createdAt: newData.created_at,
      }
    })

  } catch (error) {
    console.error('[CANDIDATE-DATA] Error adding data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
