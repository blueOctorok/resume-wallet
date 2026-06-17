'use server'

import { createClient } from '@supabase/supabase-js'

export async function getAdminSupabaseClient() {
  // Read env lazily (at call time, not module load). CLI scripts using tsx load
  // .env.local via dotenv at runtime; ESM hoists imports above that call, so a
  // module-level read here would run before the env is populated.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client is not configured. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

