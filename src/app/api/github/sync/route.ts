import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getDevGithub, saveDevGithub } from '@/lib/block-data'

/**
 * POST /api/github/sync
 *
 * Re-syncs GitHub data (repos, languages, stats) using the stored access token.
 * Called from the GitHubPage "Refresh" button and can be used to backfill data.
 *
 * Headers:
 *   - x-wallet-address: Wallet address to identify the user
 */
export async function POST(request: NextRequest) {
  try {
    const wallet = request.headers.get('x-wallet-address')
    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', wallet)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const github = await getDevGithub(supabase, user.id)
    if (!github?.access_token || !github?.username) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StormChain-GitHubSync',
      Authorization: `Bearer ${github.access_token}`,
    }

    // Fetch profile and repos in parallel
    const [userRes, reposRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers }),
      fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers }),
    ])

    const userData = await userRes.json()
    const reposData = await reposRes.json()
    const repos = Array.isArray(reposData) ? reposData : []

    if (userData?.message) {
      console.error('[GITHUB SYNC] API error:', userData.message)
      return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })
    }

    const totalStars = repos.reduce(
      (sum: number, r: Record<string, unknown>) => sum + ((r.stargazers_count as number) || 0), 0
    )
    const totalForks = repos.reduce(
      (sum: number, r: Record<string, unknown>) => sum + ((r.forks_count as number) || 0), 0
    )
    const privateRepos = repos.filter((r: Record<string, unknown>) => r.private).length

    const langCount: Record<string, number> = {}
    repos.forEach((r: Record<string, unknown>) => {
      const lang = r.language as string | null
      if (lang) langCount[lang] = (langCount[lang] || 0) + 1
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
        url: (r.html_url as string) || `https://github.com/${github.username}/${r.name}`,
        isPrivate: !!r.private,
      }))

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

    await saveDevGithub(supabase, user.id, { data: githubData })

    return NextResponse.json({
      success: true,
      repos: repos.length,
      stars: totalStars,
      languages: topLanguages.length,
    })
  } catch (error) {
    console.error('[GITHUB SYNC] Error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
