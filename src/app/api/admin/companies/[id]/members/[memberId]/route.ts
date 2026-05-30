import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

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
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { id: companyId, memberId } = await params

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

    // FULL DELETE: Remove team member = delete from platform entirely
    // This prevents fired employees from coming back and seeing anything
    const targetUserId = member.user_id

    // 1. Delete company_members record first
    const { error: memberDeleteError } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId)

    if (memberDeleteError) {
      console.error('[ADMIN MEMBERS] Error deleting member:', memberDeleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    // 2. If user exists, do full cascade delete (employer team members have no driver/dev data)
    if (targetUserId) {
      // Delete any other company memberships (edge case: shouldn't have any)
      await supabase.from('company_members').delete().eq('user_id', targetUserId)
      
      // Delete candidate_requests they initiated
      await supabase.from('candidate_requests').delete().eq('requested_by_user_id', targetUserId)
      
      // Delete the user record itself
      const { error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', targetUserId)

      if (userDeleteError) {
        console.error('[ADMIN MEMBERS] Error deleting user:', userDeleteError)
        // Don't fail - membership is removed, user is locked out
      }

      console.log(`[ADMIN MEMBERS] Full delete: removed user ${targetUserId} from platform`)
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed and deleted from platform',
    })

  } catch (error) {
    console.error('[ADMIN MEMBERS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
