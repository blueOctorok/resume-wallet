import type { SupabaseClient } from '@supabase/supabase-js'
import { addOwnerToCompanyWallet, createCompanySharedWallet } from '@/lib/company-wallet-server'

/**
 * Persists companies.wallet_address when unset. Safe to call multiple times.
 */
export async function persistCompanyWalletIfMissing(
  supabase: SupabaseClient,
  companyId: string,
  creatorSmartAccountAddress: string
): Promise<{ walletAddress: string; created: boolean } | null> {
  const { data: row } = await supabase
    .from('companies')
    .select('wallet_address')
    .eq('id', companyId)
    .maybeSingle()

  if (row?.wallet_address) {
    return { walletAddress: row.wallet_address, created: false }
  }

  try {
    const { address } = await createCompanySharedWallet({
      companyId,
      creatorSmartAccountAddress,
    })
    const addrLower = address.toLowerCase()
    const { error } = await supabase
      .from('companies')
      .update({ wallet_address: addrLower })
      .eq('id', companyId)

    if (error) {
      console.error('[COMPANY WALLET] Failed to update companies row:', error)
      return null
    }
    return { walletAddress: addrLower, created: true }
  } catch (e) {
    console.error('[COMPANY WALLET] Not created (check COMPANY_WALLET_SERVICE_PRIVATE_KEY):', e)
    return null
  }
}

/** Adds on-chain owners for every active member except the designated employer user (already in the initial owner set). */
export async function syncCoOwnersAfterWalletCreation(
  supabase: SupabaseClient,
  companyId: string,
  companyWalletAddress: string,
  employerUserId: string
): Promise<void> {
  const { data: members } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .not('user_id', 'is', null)

  for (const row of members ?? []) {
    if (!row.user_id || row.user_id === employerUserId) continue
    const { data: u } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', row.user_id)
      .maybeSingle()
    if (!u?.wallet_address) continue
    try {
      await addOwnerToCompanyWallet({
        companyId,
        companyWalletAddress,
        newOwnerSmartAccountAddress: u.wallet_address,
      })
    } catch (e) {
      console.warn('[COMPANY WALLET] Could not add member as co-owner:', row.user_id, e)
    }
  }
}
