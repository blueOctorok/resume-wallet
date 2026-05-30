import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Supabase Auth redirect target (T1.11b).
 *
 * Google OAuth, magic links, and password-reset links all redirect here with a
 * `?code=` to exchange for a session. Password sign-in does NOT hit this route
 * (it gets a session client-side). The public.users bootstrap (ensureUserRow)
 * for ALL sign-in methods happens in /api/auth/sync, called from the client
 * auth-sync hook — so this route's only job is the code-for-session exchange
 * (which writes the session cookies) and the redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` lets invite/onboard deep-links survive the auth round-trip.
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[AUTH CALLBACK] code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
