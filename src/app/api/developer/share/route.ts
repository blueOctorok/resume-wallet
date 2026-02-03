import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/developer/share
 *
 * Gets the current share token and settings for the authenticated developer (Career Card).
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('developer_profiles')
      .select(
        'share_token, share_settings, share_token_created_at, share_views_count'
      )
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
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
      shareToken: profile.share_token,
      shareSettings: profile.share_settings || {
        showResume: true,
        showPortfolio: true,
        showGitHub: true,
        showContact: false,
        allowConnect: true,
      },
      shareTokenCreatedAt: profile.share_token_created_at,
      shareViewsCount: profile.share_views_count || 0,
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error getting share info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/developer/share
 *
 * Generates a new share token for the developer (Career Card).
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json().catch(() => ({}))
    const { regenerate = false } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: existingProfile } = await supabase
      .from('developer_profiles')
      .select('id, share_token')
      .eq('user_id', user.id)
      .single()

    if (existingProfile?.share_token && !regenerate) {
      return NextResponse.json({
        success: true,
        shareToken: existingProfile.share_token,
        message: 'Existing token returned',
        isNew: false,
      })
    }

    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let newToken = ''
    for (let i = 0; i < 12; i++) {
      newToken += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    if (existingProfile) {
      const { error: updateError } = await supabase
        .from('developer_profiles')
        .update({
          share_token: newToken,
          share_token_created_at: new Date().toISOString(),
          share_views_count: regenerate
            ? 0
            : existingProfile.share_token
              ? undefined
              : 0,
        })
        .eq('id', existingProfile.id)

      if (updateError) {
        console.error('[DEVELOPER SHARE] Error updating token:', updateError)
        return NextResponse.json(
          { error: 'Failed to generate share token' },
          { status: 500 }
        )
      }
    } else {
      const { error: insertError } = await supabase
        .from('developer_profiles')
        .insert({
          user_id: user.id,
          share_token: newToken,
          share_token_created_at: new Date().toISOString(),
          share_views_count: 0,
        })

      if (insertError) {
        console.error(
          '[DEVELOPER SHARE] Error creating profile with token:',
          insertError
        )
        return NextResponse.json(
          { error: 'Failed to generate share token' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      shareToken: newToken,
      message: regenerate
        ? 'New token generated (old token invalidated)'
        : 'Token generated',
      isNew: true,
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error generating token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/developer/share
 *
 * Updates share settings (privacy controls) for Career Card.
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const { shareSettings } = body

    if (!shareSettings || typeof shareSettings !== 'object') {
      return NextResponse.json(
        { error: 'shareSettings object is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('developer_profiles')
      .update({
        share_settings: shareSettings,
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[DEVELOPER SHARE] Error updating settings:', updateError)
      return NextResponse.json(
        { error: 'Failed to update share settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      shareSettings,
      message: 'Share settings updated',
    })
  } catch (error) {
    console.error('[DEVELOPER SHARE] Error updating settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
