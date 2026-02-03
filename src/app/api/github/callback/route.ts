import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/github/callback
 *
 * Handles GitHub OAuth callback. Exchanges authorization code for access token,
 * fetches GitHub username, and stores token in database.
 *
 * Query params (from GitHub):
 *   - code: Authorization code to exchange for token
 *   - state: Base64-encoded state containing wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denying access
    if (error) {
      console.log('[GITHUB CALLBACK] User denied access:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=denied`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=missing_params`
      )
    }

    // Decode state to get wallet address
    let wallet: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      wallet = decoded.wallet

      // Check if state is too old (more than 10 minutes)
      if (Date.now() - decoded.ts > 10 * 60 * 1000) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=expired`
        )
      }
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=invalid_state`
      )
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[GITHUB CALLBACK] GitHub OAuth credentials not configured')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=not_configured`
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    )

    const tokenData = await tokenResponse.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error('[GITHUB CALLBACK] Token exchange failed:', tokenData.error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=token_failed`
      )
    }

    const accessToken = tokenData.access_token

    // Fetch GitHub user info to get username
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    const userData = await userResponse.json()

    if (!userData.login) {
      console.error('[GITHUB CALLBACK] Failed to fetch GitHub user')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=user_fetch_failed`
      )
    }

    const githubUsername = userData.login

    // Store token in database
    const supabase = await getAdminSupabaseClient()

    // Find user by wallet
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', wallet)
      .single()

    if (userError || !user) {
      console.error('[GITHUB CALLBACK] User not found:', wallet)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=user_not_found`
      )
    }

    // Update or create developer profile with GitHub token
    const { data: existingProfile } = await supabase
      .from('developer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('developer_profiles')
        .update({
          github_username: githubUsername,
          github_access_token: accessToken,
          github_connected_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)

      if (updateError) {
        console.error(
          '[GITHUB CALLBACK] Failed to update profile:',
          updateError
        )
      }
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('developer_profiles')
        .insert({
          user_id: user.id,
          github_username: githubUsername,
          github_access_token: accessToken,
          github_connected_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error(
          '[GITHUB CALLBACK] Failed to create profile:',
          insertError
        )
      }
    }

    console.log(
      `[GITHUB CALLBACK] Successfully connected GitHub @${githubUsername} for wallet ${wallet}`
    )

    // Redirect back to app with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_connected=true`
    )
  } catch (error) {
    console.error('[GITHUB CALLBACK] Error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?github_error=unknown`
    )
  }
}
