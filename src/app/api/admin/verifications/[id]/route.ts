import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * DELETE /api/admin/verifications/[id]
 * Remove an employment verification request (and its attempts via CASCADE).
 * Use for clearing test data so the applicant can re-run verification.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: row, error: findError } = await supabase
      .from('employment_verification_requests')
      .select('id, previous_employer_name, claimed_position, status')
      .eq('id', id)
      .single()

    if (findError || !row) {
      return NextResponse.json(
        { error: 'Verification request not found' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('employment_verification_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN VERIFICATIONS] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete verification request' },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] Verification deleted: ${id} (${row.previous_employer_name} / ${row.claimed_position}) by admin: ${auth.walletAddress}`
    )

    return NextResponse.json({
      success: true,
      message: 'Verification request removed. Applicant can request again.',
    })
  } catch (err) {
    console.error('[ADMIN VERIFICATIONS] Delete unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
