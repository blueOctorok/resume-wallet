import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listAdminLicenses } from '@/lib/admin-license'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/** GET /api/admin/licenses — every driver license kept on file. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const supabase = await getAdminSupabaseClient()
    const { licenses, total } = await listAdminLicenses(supabase, search, offset, limit)
    return NextResponse.json({ success: true, licenses, total })
  } catch (error) {
    console.error('[ADMIN LICENSES]', error)
    return NextResponse.json({ error: 'Could not load licenses' }, { status: 500 })
  }
}
