import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

// Roles that can update their own data
const CAN_UPDATE_OWN_ROLES = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer']
// Roles that can update any data
const CAN_UPDATE_ALL_ROLES = ['owner', 'admin', 'hr_manager']
// Roles that can delete data
const CAN_DELETE_ROLES = ['owner', 'admin', 'hr_manager']

/**
 * GET /api/employer/candidate-data/[id]
 * 
 * Gets a specific candidate data entry.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Data ID is required' },
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

    // Get the data entry
    const { data: entry, error: entryError } = await supabase
      .from('employer_candidate_data')
      .select(`
        id,
        company_id,
        candidate_user_id,
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
      .eq('id', id)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // Verify it belongs to user's company
    if (entry.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const creator = entry.users as any

    return NextResponse.json({
      success: true,
      data: {
        id: entry.id,
        candidateUserId: entry.candidate_user_id,
        dataType: entry.data_type,
        content: entry.content,
        visibleToCandidate: entry.visible_to_candidate,
        applicationId: entry.application_id,
        createdBy: {
          name: creator?.name || 'Unknown',
          email: creator?.email,
        },
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
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
 * PATCH /api/employer/candidate-data/[id]
 * 
 * Updates a candidate data entry.
 * Users can update their own entries; admins can update any.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id } = await params
    const body = await request.json()
    const { content, visibleToCandidate } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Data ID is required' },
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

    // Get the data entry
    const { data: entry } = await supabase
      .from('employer_candidate_data')
      .select('id, company_id, created_by')
      .eq('id', id)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // Verify it belongs to user's company
    if (entry.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check permission - can update own data or admin can update any
    const isOwnData = entry.created_by === user.id
    const canUpdateOwn = CAN_UPDATE_OWN_ROLES.includes(userRole || '')
    const canUpdateAll = CAN_UPDATE_ALL_ROLES.includes(userRole || '')

    if (!((isOwnData && canUpdateOwn) || canUpdateAll)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this data' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    }
    if (content !== undefined) updateData.content = content
    if (visibleToCandidate !== undefined) updateData.visible_to_candidate = visibleToCandidate

    // Update the entry
    const { error: updateError } = await supabase
      .from('employer_candidate_data')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('[CANDIDATE-DATA] Error updating:', updateError)
      return NextResponse.json(
        { error: 'Failed to update data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Candidate data updated successfully',
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
 * DELETE /api/employer/candidate-data/[id]
 * 
 * Deletes a candidate data entry.
 * Requires admin role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Data ID is required' },
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
    if (!CAN_DELETE_ROLES.includes(userRole || '')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete candidate data' },
        { status: 403 }
      )
    }

    // Get the data entry
    const { data: entry } = await supabase
      .from('employer_candidate_data')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // Verify it belongs to user's company
    if (entry.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the entry
    const { error: deleteError } = await supabase
      .from('employer_candidate_data')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[CANDIDATE-DATA] Error deleting:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Candidate data deleted successfully',
    })

  } catch (error) {
    console.error('[CANDIDATE-DATA] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
