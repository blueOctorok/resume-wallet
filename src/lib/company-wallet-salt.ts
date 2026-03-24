import { hexToBigInt, keccak256, stringToBytes } from 'viem'

/**
 * Deterministic salt for MultiOwnerLightAccount per company.
 * Must match server deploy and client first-tx init code.
 */
export function companyIdToWalletSalt(companyId: string): bigint {
  return hexToBigInt(keccak256(stringToBytes(companyId)))
}
