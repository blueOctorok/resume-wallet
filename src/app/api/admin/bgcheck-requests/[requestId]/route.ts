import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * DELETE /api/admin/bgcheck-requests/:requestId
 *
 * Removes a background check request (candidate_requests row).
 * bgcheck_consents has ON DELETE CASCADE on request_id, so the signed consent
 * is removed automatically. Use to clear stuck pending requests or clean up.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { requestId } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: row, error: findError } = await supabase
      .from('candidate_requests')
      .select('id, request_type, status')
      .eq('id', requestId)
      .single()

    if (findError || !row) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (row.request_type !== 'mvr_order') {
      return NextResponse.json(
        { error: 'Only MVR/background check requests can be deleted here' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('candidate_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('[ADMIN BGCHECK] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete background check request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Background check request and any associated consent removed.',
    })
  } catch (err) {
    console.error('[ADMIN BGCHECK] Delete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
