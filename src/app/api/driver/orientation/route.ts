import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { parseDriverOrientation, recordBriefShown } from '@/lib/driver-orientation'

/**
 * GET/PATCH /api/driver/orientation
 *
 * Memory for the brief popup. The client decides when to show it.
 * This route only records which brief was shown, how often, and when.
 */

const MAX_BRIEF_KEY_LENGTH = 300

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('users')
      .select('driver_orientation')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[ORIENTATION] Load error:', error)
      return NextResponse.json({ error: 'Failed to load orientation' }, { status: 500 })
    }

    return NextResponse.json({
      orientation: parseDriverOrientation(data?.driver_orientation),
    })
  } catch (err) {
    console.error('[ORIENTATION] GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as { briefKey?: unknown } | null
    const briefKey = body?.briefKey
    if (typeof briefKey !== 'string' || !briefKey || briefKey.length > MAX_BRIEF_KEY_LENGTH) {
      return NextResponse.json({ error: 'briefKey is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('users')
      .select('driver_orientation')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[ORIENTATION] Read error:', error)
      return NextResponse.json({ error: 'Failed to update orientation' }, { status: 500 })
    }

    const next = recordBriefShown(
      parseDriverOrientation(data?.driver_orientation),
      briefKey,
      new Date().toISOString(),
    )

    const { error: updateError } = await supabase
      .from('users')
      .update({ driver_orientation: next })
      .eq('id', userId)

    if (updateError) {
      console.error('[ORIENTATION] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update orientation' }, { status: 500 })
    }

    return NextResponse.json({ orientation: next })
  } catch (err) {
    console.error('[ORIENTATION] PATCH unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
