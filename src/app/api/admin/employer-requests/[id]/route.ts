import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean)

function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase())
}

/**
 * PATCH /api/admin/employer-requests/[id]
 * 
 * Approve or reject an employer access request.
 * Body:
 *   - action: 'approve' | 'reject'
 *   - rejectionReason: string (optional, for rejections)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id } = await params
    const body = await request.json()
    const { action, rejectionReason } = body

    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get the admin user for tracking who reviewed
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress!)
      .maybeSingle()

    // Get the request
    const { data: accessRequest, error: fetchError } = await supabase
      .from('employer_access_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !accessRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${accessRequest.status}` },
        { status: 409 }
      )
    }

    // Handle rejection
    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('employer_access_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || null,
          reviewed_by: adminUser?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('[ADMIN REQUESTS] Reject error:', updateError)
        return NextResponse.json(
          { error: 'Failed to reject request' },
          { status: 500 }
        )
      }

      console.log(`[ADMIN REQUESTS] Rejected: ${accessRequest.company_name} (${accessRequest.email})`)

      return NextResponse.json({
        success: true,
        message: 'Request rejected',
      })
    }

    // Handle approval - create company and set up user as owner
    // 1. Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', accessRequest.wallet_address)
      .maybeSingle()

    if (!user) {
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          wallet_address: accessRequest.wallet_address.toLowerCase(),
          email: accessRequest.email,
          name: accessRequest.name,
          role: 'employer',
        })
        .select('id')
        .single()

      if (createUserError) {
        console.error('[ADMIN REQUESTS] Create user error:', createUserError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }
      user = newUser
    } else {
      // Update existing user to employer role and set name/email if missing
      await supabase
        .from('users')
        .update({
          role: 'employer',
          name: accessRequest.name,
          email: accessRequest.email || undefined,
        })
        .eq('id', user.id)
    }

    // 2. Create the company
    const { data: newCompany, error: createCompanyError } = await supabase
      .from('companies')
      .insert({
        company_name: accessRequest.company_name,
        employer_user_id: user.id,
        designated_owner_email: accessRequest.email,
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: adminUser?.id || null,
        onboarding_completed: false,
      })
      .select('id')
      .single()

    if (createCompanyError) {
      console.error('[ADMIN REQUESTS] Create company error:', createCompanyError)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // 3. Add user as owner in company_members
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: newCompany.id,
        user_id: user.id,
        role: 'owner',
        invite_email: accessRequest.email,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })

    if (memberError) {
      console.error('[ADMIN REQUESTS] Create member error:', memberError)
      // Company created but member failed - still mark as approved
    }

    // 4. Update the request as approved
    const { error: updateError } = await supabase
      .from('employer_access_requests')
      .update({
        status: 'approved',
        reviewed_by: adminUser?.id || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[ADMIN REQUESTS] Update request error:', updateError)
    }

    console.log(`[ADMIN REQUESTS] Approved: ${accessRequest.company_name} -> Company ID: ${newCompany.id}`)

    return NextResponse.json({
      success: true,
      message: `${accessRequest.company_name} has been approved`,
      company: {
        id: newCompany.id,
        name: accessRequest.company_name,
      }
    })

  } catch (error) {
    console.error('[ADMIN REQUESTS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/employer-requests/[id]
 * 
 * Delete a request (any status).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id } = await params

    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await getAdminSupabaseClient()

    const { error } = await supabase
      .from('employer_access_requests')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[ADMIN REQUESTS] Delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Request deleted',
    })

  } catch (error) {
    console.error('[ADMIN REQUESTS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
