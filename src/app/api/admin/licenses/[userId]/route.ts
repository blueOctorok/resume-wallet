import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { deleteAdminLicense, getAdminLicense } from '@/lib/admin-license'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/** GET /api/admin/licenses/[userId] — one license, including photo links. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { userId } = await params
  try {
    const supabase = await getAdminSupabaseClient()
    const license = await getAdminLicense(supabase, userId)
    if (!license) {
      return NextResponse.json({ error: 'No license on file for this driver' }, { status: 404 })
    }
    return NextResponse.json({ success: true, license })
  } catch (error) {
    console.error('[ADMIN LICENSE]', error)
    return NextResponse.json({ error: 'Could not load license' }, { status: 500 })
  }
}

/** DELETE /api/admin/licenses/[userId] — remove the on-file scan and its photos. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { userId } = await params
  try {
    const supabase = await getAdminSupabaseClient()
    const removed = await deleteAdminLicense(supabase, userId)
    if (!removed) {
      return NextResponse.json({ error: 'No license on file for this driver' }, { status: 404 })
    }
    console.log(`[ADMIN LICENSE] Removed license on file for ${userId} by ${auth.email}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN LICENSE DELETE]', error)
    return NextResponse.json({ error: 'Could not delete license' }, { status: 500 })
  }
}
