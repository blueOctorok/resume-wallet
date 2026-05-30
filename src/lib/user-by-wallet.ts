/**
 * User-by-wallet: single place for "get or create user" by wallet address
 *
 * MODEL (wallet-first, lazy user record):
 * - There is no traditional sign-up. The user connects a wallet.
 * - The `users` table row is created lazily the first time any backend action
 *   needs it (DOT form save, resume upload, role selection, MVR order, etc.).
 * - One wallet address = exactly one user record. Identity is the wallet.
 * - Names and other profile data live in user_profiles, block_* tables,
 *   application_data, etc. — not in the initial user row.
 *
 * To avoid duplicate user rows, all code that might create a user must use
 * getOrCreateUserByWallet() instead of inlining their own "select then insert".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isAuthOnlyWalletPlaceholder } from '@/lib/user-bootstrap'

const WALLET_ADDRESS_KEY = 'wallet_address' as const
const AUTH_WALLET_PREFIX = 'auth:' as const

/** Normalize wallet for storage and lookup (lowercase) */
export function normalizeWalletAddress(wallet: string): string {
  return wallet.trim().toLowerCase()
}

export interface UserRow {
  id: string
  wallet_address?: string
  email?: string | null
  role?: string | null
  is_active?: boolean
  created_at?: string
  [key: string]: unknown
}

/**
 * Get the single user record for this wallet, if any.
 * Use this when you must NOT create a user (e.g. profile lookup, hub "new user" check).
 * Handles existing duplicates by returning the most recently created row.
 */
export async function getUserByWallet(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<UserRow | null> {
  const normalized = normalizeWalletAddress(walletAddress)
  const { data: rows, error } = await supabase
    .from('users')
    .select('*')
    .ilike(WALLET_ADDRESS_KEY, normalized)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to fetch user by wallet: ${error.message}`)
  }
  return rows?.[0] ?? null
}

/**
 * Get the user for this wallet, or create one if none exists.
 * Use this whenever an action (DOT save, resume upload, set-role, MVR order, etc.)
 * requires a user row and is allowed to create it.
 *
 * Returns the user row and whether it was just created.
 * If duplicates already exist, returns the most recent and does not create another.
 */
export async function getOrCreateUserByWallet(
  supabase: SupabaseClient,
  walletAddress: string,
  options?: { role?: string | null }
): Promise<{ user: UserRow; isNew: boolean }> {
  const normalized = normalizeWalletAddress(walletAddress)

  // Supabase-auth placeholder (`auth:<uuid>`): identity is the auth user id, NOT
  // the wallet string. By the T1.3 convention `users.id = auth.users.id`, so we
  // must resolve (and, if missing, create) by `id` — never mint a fresh-UUID row.
  // The wallet-first INSERT below would generate a brand-new id, orphaning the
  // user from auth.users (breaks session-keyed lookups + blocks the T1.12.1 FK).
  // Seen in prod 2026-05-30: a migrated employer got a spurious duplicate this way.
  if (isAuthOnlyWalletPlaceholder(normalized)) {
    return getOrCreateAuthUserById(supabase, normalized.slice(AUTH_WALLET_PREFIX.length), normalized, options)
  }

  // 1. Look up existing (handle duplicates by taking most recent)
  const existing = await getUserByWallet(supabase, walletAddress)
  if (existing) {
    return { user: existing as UserRow, isNew: false }
  }

  // 2. Insert one row (normalized wallet)
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      wallet_address: normalized,
      is_active: true,
      ...(options?.role !== undefined && { role: options.role }),
    })
    .select('*')
    .single()

  if (insertError) {
    // Duplicate key or race: another request created the user; fetch again
    if (insertError.code === '23505' || insertError.message?.toLowerCase().includes('duplicate')) {
      const again = await getUserByWallet(supabase, walletAddress)
      if (again) return { user: again as UserRow, isNew: false }
    }
    throw new Error(`Failed to create user: ${insertError.message}`)
  }

  if (!newUser) {
    throw new Error('Failed to create user: no data returned')
  }

  return { user: newUser as UserRow, isNew: true }
}

/**
 * Resolve-or-create a user by Supabase auth id (for `auth:<uuid>` placeholders).
 * Mirrors ensureUserRow: the row's `id` is pinned to the auth user id so it always
 * matches auth.users. Race-safe via upsert(onConflict: 'id', ignoreDuplicates).
 */
async function getOrCreateAuthUserById(
  supabase: SupabaseClient,
  authUserId: string,
  placeholderWallet: string,
  options?: { role?: string | null }
): Promise<{ user: UserRow; isNew: boolean }> {
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Failed to fetch user by auth id: ${fetchError.message}`)
  }
  if (existing) {
    return { user: existing as UserRow, isNew: false }
  }

  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: authUserId,
      wallet_address: placeholderWallet,
      is_active: true,
      ...(options?.role !== undefined && { role: options.role }),
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (upsertError) {
    throw new Error(`Failed to create auth user: ${upsertError.message}`)
  }

  const { data: row, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .single()

  if (selectError || !row) {
    throw new Error(`Auth user row missing after upsert: ${selectError?.message ?? 'no data'}`)
  }

  return { user: row as UserRow, isNew: true }
}
