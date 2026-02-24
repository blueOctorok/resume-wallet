/**
 * User-by-wallet: single place for "get or create user" by wallet address
 *
 * MODEL (wallet-first, lazy user record):
 * - There is no traditional sign-up. The user connects a wallet.
 * - The `users` table row is created lazily the first time any backend action
 *   needs it (DOT form save, resume upload, role selection, MVR order, etc.).
 * - One wallet address = exactly one user record. Identity is the wallet.
 * - Names and other profile data live in driver_profiles, employer profiles,
 *   application_data, etc. — not in the initial user row.
 *
 * To avoid duplicate user rows, all code that might create a user must use
 * getOrCreateUserByWallet() instead of inlining their own "select then insert".
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const WALLET_ADDRESS_KEY = 'wallet_address' as const

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
