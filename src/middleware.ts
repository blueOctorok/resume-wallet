import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

/**
 * Refreshes Supabase Auth session cookies on each request (dual-mode: Alchemy
 * remains the active sign-in path until T1.12). No redirects here — see
 * updateSession in utils/supabase/middleware.ts.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Skip static assets. All other routes get a session refresh so cookies stay
     * valid once sign-in ships (T1.11). API/webhook routes are included but
     * updateSession does not block unauthenticated requests.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
