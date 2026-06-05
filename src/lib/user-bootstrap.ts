/**
 * Bootstrap public.users from Supabase Auth (Phase 1 — T1.3).
 *
 * After sign-in, auth.users.id IS users.id. This helper creates the Storm-side
 * row on first callback. Wallet-first users still use getOrCreateUserByWallet().
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const AUTH_WALLET_PREFIX = 'auth:' as const

export interface StormUserRow {
  id: string
  wallet_address: string
  email?: string | null
  role?: string | null
  is_active?: boolean
  created_at?: string
  [key: string]: unknown
}

/**
 * Placeholder wallet_address for auth-only accounts.
 * Column is NOT NULL until T1.12+; not a real chain address.
 */
export function authOnlyWalletPlaceholder(authUserId: string): string {
  return `${AUTH_WALLET_PREFIX}${authUserId}`
}

export function isAuthOnlyWalletPlaceholder(walletAddress: string): boolean {
  return walletAddress.startsWith(AUTH_WALLET_PREFIX)
}

/**
 * Ensure a public.users row exists for this Supabase Auth user.
 * Idempotent: existing row → returned unchanged (ON CONFLICT DO NOTHING).
 */
export async function ensureUserRow(
  supabase: SupabaseClient,
  authUserId: string,
  email?: string | null
): Promise<StormUserRow> {
  const normalizedEmail = email?.trim().toLowerCase() ?? null

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`[USER_BOOTSTRAP] Failed to fetch user: ${fetchError.message}`)
  }

  if (existing) {
    return existing as StormUserRow
  }

  const { error: insertError } = await supabase.from('users').upsert(
    {
      id: authUserId,
      wallet_address: authOnlyWalletPlaceholder(authUserId),
      email: normalizedEmail,
      is_active: true,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (insertError) {
    throw new Error(`[USER_BOOTSTRAP] Failed to create user: ${insertError.message}`)
  }

  const { data: row, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .single()

  if (selectError || !row) {
    throw new Error(
      `[USER_BOOTSTRAP] User row missing after upsert: ${selectError?.message ?? 'no data'}`
    )
  }

  return row as StormUserRow
}
