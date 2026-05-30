import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/developer/share
 * Gets the current share token and settings for the authenticated developer (Career Card).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // CASE 3: needs share_token/settings columns, so we keep a lookup (by id).
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, share_token, share_settings, share_token_created_at, share_views_count')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.share_token) {
      return NextResponse.json({
        success: true,
        hasProfile: false,
        shareToken: null,
        shareSettings: null,
      })
    }

    return NextResponse.json({
      success: true,
      hasProfile: true,
      shareToken: user.share_token,
      shareSettings: user.share_settings || {
        showResume: true,
        showPortfolio: true,
        showGitHub: true,
        showContact: false,
        allowConnect: true,
      },
      shareTokenCreatedAt: user.share_token_created_at,
      shareViewsCount: user.share_views_count || 0,
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error getting share info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/developer/share
 * Generates a new share token for the developer (Career Card).
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

    // CASE 3: this handler needs share_token (not just the id), so we still
    // read the row — but keyed by the resolved userId instead of the wallet.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, share_token')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.share_token && !regenerate) {
      return NextResponse.json({
        success: true,
        shareToken: user.share_token,
        message: 'Existing token returned',
        isNew: false,
      })
    }

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let newToken = ''
    for (let i = 0; i < 12; i++) {
      newToken += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        share_token: newToken,
        share_token_created_at: new Date().toISOString(),
        share_views_count: regenerate ? 0 : (user.share_token ? undefined : 0),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[DEVELOPER SHARE] Error updating token:', updateError)
      return NextResponse.json({ error: 'Failed to generate share token' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      shareToken: newToken,
      message: regenerate ? 'New token generated (old token invalidated)' : 'Token generated',
      isNew: true,
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error generating token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/developer/share
 * Updates share settings (privacy controls) for Career Card.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    const { shareSettings } = body
    if (!shareSettings || typeof shareSettings !== 'object') {
      return NextResponse.json({ error: 'shareSettings object is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { error: updateError } = await supabase
      .from('users')
      .update({ share_settings: shareSettings })
      .eq('id', userId)

    if (updateError) {
      console.error('[DEVELOPER SHARE] Error updating settings:', updateError)
      return NextResponse.json({ error: 'Failed to update share settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      shareSettings,
      message: 'Share settings updated',
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error updating settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
