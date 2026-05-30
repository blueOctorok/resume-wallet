import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/candidate-data/[candidateId]
 * 
 * Gets all employer data for a specific candidate.
 * Only returns data from the employer's company.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const { candidateId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!candidateId) {
      return NextResponse.json(
        { error: 'Candidate ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
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

    // Fetch all data for this candidate from this company
    const { data: items, error } = await supabase
      .from('employer_candidate_data')
      .select(`
        id,
        data_type,
        content,
        visible_to_candidate,
        application_id,
        created_at,
        updated_at,
        created_by,
        creator:users!employer_candidate_data_created_by_fkey(email)
      `)
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[CANDIDATE DATA] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: (items || []).map(item => ({
        id: item.id,
        dataType: item.data_type,
        content: item.content,
        visibleToCandidate: item.visible_to_candidate,
        applicationId: item.application_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        createdByName: (item.creator as { email: string } | null)?.email || null,
      })),
    })

  } catch (error) {
    console.error('[CANDIDATE DATA] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/employer/candidate-data/[candidateId]
 * 
 * Deletes a specific data item. Requires itemId in query params.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const { candidateId } = await params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
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

    // Delete the item (only if it belongs to this company)
    const { error: deleteError } = await supabase
      .from('employer_candidate_data')
      .delete()
      .eq('id', itemId)
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateId)

    if (deleteError) {
      console.error('[CANDIDATE DATA] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[CANDIDATE DATA] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
