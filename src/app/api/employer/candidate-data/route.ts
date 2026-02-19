import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const VALID_DATA_TYPES = [
  'note',
  'rating',
  'tag',
  'document',
  'interview',
  'assessment',
  'offer',
  'rejection_reason',
] as const

type DataType = typeof VALID_DATA_TYPES[number]

/**
 * POST /api/employer/candidate-data
 * 
 * Creates a new note, rating, tag, or other data for a candidate.
 * 
 * Body:
 *   - candidateUserId: UUID of the candidate (required)
 *   - dataType: One of the valid data types (required)
 *   - content: JSONB content (required)
 *   - applicationId: Optional link to specific application
 *   - visibleToCandidate: Whether candidate can see this (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()

    const {
      candidateUserId,
      dataType,
      content,
      applicationId,
      visibleToCandidate = false,
    } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!candidateUserId) {
      return NextResponse.json(
        { error: 'candidateUserId is required' },
        { status: 400 }
      )
    }

    if (!dataType || !VALID_DATA_TYPES.includes(dataType)) {
      return NextResponse.json(
        { error: `dataType must be one of: ${VALID_DATA_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'object') {
      return NextResponse.json(
        { error: 'content must be a valid object' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer
    const { data: employer } = await supabase
      .from('users')
      .select('id, name')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get employer's company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Verify candidate exists
    const { data: candidate } = await supabase
      .from('users')
      .select('id')
      .eq('id', candidateUserId)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // For ratings, update existing or create new (only one rating per company per candidate)
    if (dataType === 'rating') {
      const { data: existingRating } = await supabase
        .from('employer_candidate_data')
        .select('id')
        .eq('company_id', companyId)
        .eq('candidate_user_id', candidateUserId)
        .eq('data_type', 'rating')
        .single()

      if (existingRating) {
        const { data: updated, error: updateError } = await supabase
          .from('employer_candidate_data')
          .update({
            content,
            updated_by: employer.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRating.id)
          .select()
          .single()

        if (updateError) {
          console.error('[CANDIDATE DATA] Update error:', updateError)
          return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
        }

        return NextResponse.json({ success: true, item: updated })
      }
    }

    // Create new entry
    const { data: newItem, error: insertError } = await supabase
      .from('employer_candidate_data')
      .insert({
        company_id: companyId,
        candidate_user_id: candidateUserId,
        data_type: dataType,
        content,
        application_id: applicationId || null,
        visible_to_candidate: visibleToCandidate,
        created_by: employer.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CANDIDATE DATA] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    console.log(`[CANDIDATE DATA] Created ${dataType} for candidate ${candidateUserId}`)

    return NextResponse.json({
      success: true,
      item: {
        id: newItem.id,
        dataType: newItem.data_type,
        content: newItem.content,
        createdAt: newItem.created_at,
      },
    })

  } catch (error) {
    console.error('[CANDIDATE DATA] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
