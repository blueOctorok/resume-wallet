import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean)

function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase())
}

/**
 * DELETE /api/admin/companies/[id]/members/[memberId]
 * 
 * Removes a member from a company (admin action).
 * This fully deletes the membership record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id: companyId, memberId } = await params

    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await getAdminSupabaseClient()

    // Verify the member exists and belongs to this company
    const { data: member } = await supabase
      .from('company_members')
      .select('id, company_id, role, user_id')
      .eq('id', memberId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.company_id !== companyId) {
      return NextResponse.json(
        { error: 'Member does not belong to this company' },
        { status: 400 }
      )
    }

    // Check if this is the only owner - warn but still allow admin to delete
    if (member.role === 'owner') {
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('role', 'owner')
        .eq('is_active', true)

      if ((count || 0) <= 1) {
        // Admin can still delete, but log a warning
        console.warn(`[ADMIN MEMBERS] Deleting the only owner of company ${companyId}`)
      }
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('[ADMIN MEMBERS] Error deleting member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    })

  } catch (error) {
    console.error('[ADMIN MEMBERS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
