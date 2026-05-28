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
     * Skip:
     *   - Next.js internals + image optimizer + favicon + static assets
     *   - All API routes (auth still happens via x-wallet-address header in
     *     dual-mode; Supabase cookies are not required server-side for APIs
     *     until T1.5–T1.8 migrate them. Excluding /api here avoids running
     *     middleware on Alchemy/Stripe/Accio webhook callbacks too.)
     *
     * Re-include /api once T1.5 starts migrating routes to Supabase sessions.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
