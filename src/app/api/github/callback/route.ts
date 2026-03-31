import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { saveDevGithub } from '@/lib/block-data'


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
      'User-Agent': 'Storm-GitHubSync',
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

    // Top repos by stars (descending), keep top 5 for career card display
    const topRepos = repos
      .filter((r: Record<string, unknown>) => !r.fork)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.stargazers_count as number) || 0) - ((a.stargazers_count as number) || 0)
      )
      .slice(0, 5)
      .map((r: Record<string, unknown>) => ({
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        stars: (r.stargazers_count as number) || 0,
        language: (r.language as string | null) ?? null,
        url: (r.html_url as string) || `https://github.com/${githubUsername}/${r.name}`,
        isPrivate: !!r.private,
      }))

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
      topRepos,
      syncedAt: new Date().toISOString(),
    }

    // Store in block table
    const supabase = await getAdminSupabaseClient()
    try {
      await saveDevGithub(supabase, userId, { data: githubData })
      console.log('[GITHUB SYNC] Successfully synced GitHub data:', {
        repos: repos.length,
        stars: totalStars,
        languages: topLanguages.length,
      })
    } catch (err) {
      console.error('[GITHUB SYNC] Failed to store data:', err)
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
  // Prefer NEXT_PUBLIC_APP_URL for the same reason as the oauth route: reverse proxies may
  // expose an internal hostname in request.url that differs from the user-facing domain.
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denying access
    if (error) {
      console.log('[GITHUB CALLBACK] User denied access:', error)
      return NextResponse.redirect(`${origin}/?github_error=denied`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${origin}/?github_error=missing_params`)
    }

    // Decode state to get wallet address
    let wallet: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      wallet = decoded.wallet

      // Check if state is too old (more than 10 minutes)
      if (Date.now() - decoded.ts > 10 * 60 * 1000) {
        return NextResponse.redirect(`${origin}/?github_error=expired`)
      }
    } catch {
      return NextResponse.redirect(`${origin}/?github_error=invalid_state`)
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[GITHUB CALLBACK] GitHub OAuth credentials not configured')
      return NextResponse.redirect(`${origin}/?github_error=not_configured`)
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
      return NextResponse.redirect(`${origin}/?github_error=token_failed`)
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
      return NextResponse.redirect(`${origin}/?github_error=user_fetch_failed`)
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
      return NextResponse.redirect(`${origin}/?github_error=user_not_found`)
    }

    // Write username + token, then sync full GitHub data (repos, languages, etc.)
    // IMPORTANT: Both must complete before redirecting. Vercel serverless functions
    // terminate after the response is sent, so fire-and-forget calls get killed.
    try {
      await saveDevGithub(supabase, user.id, {
        username: githubUsername,
        access_token: accessToken,
        connected_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[GITHUB CALLBACK] Failed to save github data:', err)
    }

    await syncGitHubData(user.id, accessToken, githubUsername)

    console.log(
      `[GITHUB CALLBACK] Successfully connected GitHub @${githubUsername} for wallet ${wallet}`
    )

    return NextResponse.redirect(`${origin}/?github_connected=true`)
  } catch (error) {
    console.error('[GITHUB CALLBACK] Error:', error)
    return NextResponse.redirect(`${origin}/?github_error=unknown`)
  }
}
