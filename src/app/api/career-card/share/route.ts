import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

function generateToken(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * GET /api/career-card/share
 *
 * Returns the current share token and settings for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user } = await supabase
      .from('users')
      .select('share_token, share_settings, share_views_count, discoverable_to_employers, discoverable_prompt_seen_at')
      .eq('id', userId)
      .single()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const row = user as Record<string, unknown>
    return NextResponse.json({
      success: true,
      shareToken: (row.share_token as string | null) ?? null,
      shareSettings: row.share_settings ?? {
        showContact: false,
        allowConnect: true,
      },
      shareViewsCount: row.share_views_count ?? 0,
      discoverableToEmployers: row.discoverable_to_employers === true,
      discoverablePromptSeen: row.discoverable_prompt_seen_at != null,
    })
  } catch (error) {
    console.error('[CAREER CARD SHARE] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/career-card/share
 *
 * Generates or regenerates a share token for the user.
 * Body: { regenerate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { regenerate = false } = body

    const supabase = await getAdminSupabaseClient()

    // CASE 3: we need the existing share_token to decide whether to reuse or regenerate.
    const { data: user } = await supabase
      .from('users')
      .select('share_token')
      .eq('id', userId)
      .single()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingToken = (user as Record<string, unknown>).share_token as string | null
    if (existingToken && !regenerate) {
      return NextResponse.json({
        success: true,
        shareToken: existingToken,
        isNew: false,
      })
    }

    const newToken = generateToken()

    const { error: updateError } = await supabase
      .from('users')
      .update({
        share_token: newToken,
        share_token_created_at: new Date().toISOString(),
        ...(regenerate ? { share_views_count: 0 } : {}),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[CAREER CARD SHARE] Token generation error:', updateError)
      return NextResponse.json({ error: 'Failed to generate share token' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      shareToken: newToken,
      isNew: true,
    })
  } catch (error) {
    console.error('[CAREER CARD SHARE] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/career-card/share
 *
 * Updates share settings (privacy controls).
 * Body: { shareSettings: { showContact, allowConnect } }
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { shareSettings, discoverableToEmployers, markPromptSeen } = body as {
      shareSettings?: { showContact?: boolean; allowConnect?: boolean }
      discoverableToEmployers?: boolean
      markPromptSeen?: boolean
    }

    const patch: Record<string, unknown> = {}
    if (shareSettings && typeof shareSettings === 'object') {
      patch.share_settings = shareSettings
    }
    if (typeof discoverableToEmployers === 'boolean') {
      patch.discoverable_to_employers = discoverableToEmployers
      patch.discoverable_prompt_seen_at = new Date().toISOString()
    } else if (markPromptSeen === true) {
      patch.discoverable_prompt_seen_at = new Date().toISOString()
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { error: updateError } = await supabase.from('users').update(patch).eq('id', userId)

    if (updateError) {
      console.error('[CAREER CARD SHARE] Settings update error:', updateError)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      shareSettings: patch.share_settings ?? shareSettings ?? null,
      discoverableToEmployers:
        typeof patch.discoverable_to_employers === 'boolean' ? patch.discoverable_to_employers : undefined,
    })
  } catch (error) {
    console.error('[CAREER CARD SHARE] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
