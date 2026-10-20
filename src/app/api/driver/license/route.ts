import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { presentLicenseScan } from '@/lib/license-scan-view'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = await getAdminSupabaseClient()
    const scan = await presentLicenseScan(supabase, userId)
    return NextResponse.json({ scan })
  } catch (error) {
    console.error('[LICENSE] GET failed:', error)
    return NextResponse.json({ error: 'Could not load the license' }, { status: 500 })
  }
}
