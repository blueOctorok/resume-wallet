import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Employer access requests are now HISTORY ONLY.
 *
 * The PATCH approve/reject handler was removed along with the self-serve
 * signup flow it served. Approving used to mint an employer account straight
 * from a form submission — creating a company with the requester as owner, or
 * silently adding them to an existing company as a recruiter when the name
 * fuzzy-matched. Employer accounts now come exclusively from
 * /api/admin/companies, where a human names the company and its designated
 * owner.
 *
 * The rows stay queryable: they are the evidence trail for the August 2026
 * access review. DELETE remains for purging genuine junk.
 */

/** DELETE /api/admin/employer-requests/[id] — remove a historical request row. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { id } = await params
    const supabase = await getAdminSupabaseClient()

    const { error } = await supabase.from('employer_access_requests').delete().eq('id', id)

    if (error) {
      console.error('[ADMIN REQUESTS] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Request deleted' })
  } catch (error) {
    console.error('[ADMIN REQUESTS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
