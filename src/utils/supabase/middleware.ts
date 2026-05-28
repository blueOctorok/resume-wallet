import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes Supabase Auth session cookies on each request.
 *
 * HOTFIX 2026-05-28: prod outage after the @supabase/ssr 0.1 → 0.10.3 upgrade.
 * Two changes here:
 *   1. Use the new `getAll` / `setAll` cookies API. The old `get/set/remove`
 *      shape is deprecated in ≥0.5 and was breaking on every request, which
 *      bricked page loads with 500s and blocked Alchemy OTP completion.
 *   2. Wrap the auth call + cookie write in try/catch so a Supabase outage,
 *      bad env var, or future SDK change can NEVER take down the whole app.
 *      Failures here are logged but pass-through to NextResponse.next().
 *
 * Phase 1 dual-mode: Alchemy is still the active sign-in path until T1.12.
 * This middleware exists only to keep Supabase Auth cookies fresh once T1.11
 * sign-in ships. It must never block the request.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are missing in this environment, do nothing — never 500 the request.
  if (!url || !anon) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    })

    // IMPORTANT: keep this immediately after createServerClient.
    await supabase.auth.getUser()
  } catch (err) {
    // Auth refresh failed — log and pass through. The page still renders;
    // the user just won't get a refreshed Supabase cookie this hop. Once
    // sign-in actually uses Supabase (T1.11+), revisit this guard.
    console.error('[middleware] supabase session refresh failed:', err)
    return NextResponse.next({ request })
  }

  return supabaseResponse
}
