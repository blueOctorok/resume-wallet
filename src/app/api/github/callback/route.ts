import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'


/**
 * Fetch GitHub data and store it in the database.
 * This is the proper sync pattern - fetch once, store, then read from DB.
 */
async function syncGitHubData(
  userId: string,
  accessToken: string,
  githubUsername: string
) {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StormChain-GitHubSync',
      Authorization: `Bearer ${accessToken}`,
    }

    // Fetch user profile
    const userRes = await fetch('https://api.github.com/user', { headers })
    const userData = await userRes.json()

    if (!userData || userData.message) {
      console.error('[GITHUB SYNC] Failed to fetch user:', userData?.message)
      return
    }

    // Fetch repos (includes private with OAuth token)
    const reposRes = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      { headers }
    )
    const reposData = await reposRes.json()
    const repos = Array.isArray(reposData) ? reposData : []

    // Calculate totals
    const totalStars = repos.reduce(
      (sum: number, r: Record<string, unknown>) =>
        sum + ((r.stargazers_count as number) || 0),
      0
    )
    const totalForks = repos.reduce(
      (sum: number, r: Record<string, unknown>) =>
        sum + ((r.forks_count as number) || 0),
      0
    )
    const privateRepos = repos.filter(
      (r: Record<string, unknown>) => r.private
    ).length

    // Calculate language stats
    const langCount: Record<string, number> = {}
    repos.forEach((r: Record<string, unknown>) => {
      const lang = r.language as string | null
      if (lang) {
        langCount[lang] = (langCount[lang] || 0) + 1
      }
    })
    const totalLangs = Object.values(langCount).reduce((a, b) => a + b, 0)
    const topLanguages = Object.entries(langCount)
      .map(([language, count]) => ({
        language,
        count,
        percentage: totalLangs > 0 ? Math.round((count / totalLangs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Build github_data object to store
    const githubData = {
      totalRepos: repos.length,
      publicRepos: repos.length - privateRepos,
      privateRepos,
      totalStars,
      totalForks,
      followers: userData.followers || 0,
      following: userData.following || 0,
      avatarUrl: userData.avatar_url || null,
      bio: userData.bio || null,
      topLanguages,
      syncedAt: new Date().toISOString(),
    }

    // Store in database
    const supabase = await getAdminSupabaseClient()
    const { error } = await supabase
      .from('developer_profiles')
      .update({ github_data: githubData })
      .eq('user_id', userId)

    if (error) {
      console.error('[GITHUB SYNC] Failed to store data:', error)
    } else {
      console.log('[GITHUB SYNC] Successfully synced GitHub data:', {
        repos: repos.length,
        stars: totalStars,
        languages: topLanguages.length,
      })
    }
  } catch (error) {
    console.error('[GITHUB SYNC] Error syncing data:', error)
  }
}

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

    // Sync GitHub data to database (fire and forget - don't block redirect)
    // This stores repos, stars, languages, etc. in github_data column
    syncGitHubData(user.id, accessToken, githubUsername)

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
