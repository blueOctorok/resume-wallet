/**
 * Client-safe: service co-owner address must match server COMPANY_WALLET_SERVICE_PRIVATE_KEY
 * and be listed in MultiOwnerLightAccount `owners` alongside each member's Light Account.
 */
export function getCompanyWalletServiceOwnerAddress(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_COMPANY_WALLET_SERVICE_ADDRESS?.trim()
  if (!raw || !raw.startsWith('0x') || raw.length < 42) return null
  return raw as `0x${string}`
}
