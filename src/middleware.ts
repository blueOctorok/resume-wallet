import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

/**
 * Root Next.js middleware.
 *
 * HOTFIX 2026-05-28: wrap updateSession in a final outer guard so that a thrown
 * error here can never return a 500 to the user. Prod outage on the T1.1–1.3
 * deploy was caused by the old cookies API + the @supabase/ssr 0.1 → 0.10.3
 * upgrade — middleware threw, every page load 500'd, users couldn't reach the
 * Alchemy OTP submit. Belt-and-suspenders: updateSession itself is also
 * defensive, but we never want middleware to be a single point of failure for
 * page loads while we're still in dual-mode Alchemy auth.
 */
export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (err) {
    console.error('[middleware] unrecoverable error, passing through:', err)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    /*
     * T1.12a (2026-05-30): /api/* is now INCLUDED so updateSession refreshes
     * the Supabase auth cookie on authenticated API calls (token rotation),
     * which the Phase 1 cutover relies on once clients stop sending
     * x-wallet-address.
     *
     * updateSession only calls supabase.auth.getUser() (reads cookies) — it
     * never touches the request body — so it is safe on routes that parse raw
     * payloads. We still EXCLUDE the externally-called entrypoints below
     * because they carry no user session and must stay byte-for-byte
     * untouched:
     *   - api/webhooks/* + api/mvr/webhook + api/psp/webhook — Accio (Pace) XML
     *     callbacks, authenticated by their own contract, not Supabase cookies.
     *   - api/github/callback — GitHub OAuth callback (own state handshake).
     *
     * Also skip Next.js internals, the image optimizer, favicon, and static
     * assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/mvr/webhook|api/psp/webhook|api/github/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
