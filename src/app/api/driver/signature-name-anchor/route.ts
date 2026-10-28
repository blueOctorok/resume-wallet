import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { loadSignatureNameAnchor } from '@/lib/load-signature-name-anchor'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/** Name the DOT signature has to match: MVR when a report is on file, otherwise the license barcode. */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const anchor = await loadSignatureNameAnchor(supabase, userId)
    return NextResponse.json({ anchor })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load signature name'
    console.error('[SIGNATURE NAME] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
