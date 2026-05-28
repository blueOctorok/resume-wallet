import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Server-side Supabase client (cookie session).
 *
 * Updated 2026-05-28 from the deprecated `get/set/remove` cookies API to the
 * `getAll`/`setAll` shape supported by @supabase/ssr ≥0.5. Server Components
 * can't write cookies; the try/catch in setAll preserves that — middleware
 * (`utils/supabase/middleware.ts`) is responsible for writing refreshed
 * cookies, this client only reads.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component — middleware handles refresh.
        }
      },
    },
  })
}
