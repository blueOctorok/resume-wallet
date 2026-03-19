import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/github/oauth
 *
 * Initiates GitHub OAuth flow. Redirects user to GitHub authorization page.
 * After auth, GitHub redirects back to /api/github/callback with a code.
 *
 * Query params:
 *   - wallet: User's wallet address (required, passed through state)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) {
      console.error('[GITHUB OAUTH] GITHUB_CLIENT_ID not configured')
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      )
    }

    // Build the GitHub OAuth URL
    // Scopes: repo (private repos), read:user (profile), user:email
    const scopes = ['repo', 'read:user', 'user:email'].join(' ')

    // State includes wallet address (base64 encoded) for security and to identify user on callback
    const state = Buffer.from(
      JSON.stringify({ wallet, ts: Date.now() })
    ).toString('base64')

    // Prefer NEXT_PUBLIC_APP_URL (canonical domain) since reverse proxies / Vercel may expose
    // an internal origin (e.g. *.vercel.app) in request.url that won't match GitHub's callback URL.
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const redirectUri = `${origin}/api/github/callback`
    console.log('[GITHUB OAUTH] redirect_uri:', redirectUri)

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
    githubAuthUrl.searchParams.set('client_id', clientId)
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri)
    githubAuthUrl.searchParams.set('scope', scopes)
    githubAuthUrl.searchParams.set('state', state)

    return NextResponse.redirect(githubAuthUrl.toString())
  } catch (error) {
    console.error('[GITHUB OAUTH] Error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    )
  }
}
