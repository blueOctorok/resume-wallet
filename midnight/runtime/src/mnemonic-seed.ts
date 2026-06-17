import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist as english } from '@scure/bip39/wordlists/english.js'
import { Buffer } from 'buffer'

/** Normalize Lace / .env mnemonic to a single space-separated phrase. */
export function normalizeMnemonic(raw: string): string {
  const stripped = raw.trim().replace(/^["']|["']$/g, '')
  return stripped.replace(/\s+/g, ' ').trim()
}

/** BIP39 phrase → full master seed for HDWallet.fromSeed (matches Chrome Lace extension). */
export function mnemonicToSeedBuffer(mnemonic: string): Buffer {
  const phrase = normalizeMnemonic(mnemonic)
  if (!validateMnemonic(phrase, english)) {
    throw new Error('Invalid BIP39 mnemonic in MIDNIGHT_WALLET_MNEMONIC')
  }
  return Buffer.from(mnemonicToSeedSync(phrase))
}

/** Hex seed (64 chars) for deployment.json compatibility with create-mn-app. */
export function mnemonicToHexSeed(mnemonic: string): string {
  return mnemonicToSeedBuffer(mnemonic).subarray(0, 32).toString('hex')
}

export function resolveSeedBuffer(input: {
  mnemonic?: string
  hexSeed?: string
}): Buffer {
  if (input.hexSeed?.trim()) {
    return Buffer.from(input.hexSeed.trim(), 'hex')
  }
  if (input.mnemonic?.trim()) {
    return mnemonicToSeedBuffer(input.mnemonic)
  }
  throw new Error('Wallet seed required (mnemonic or hexSeed)')
}

/** Log-friendly address check — compare to Lace unshielded receive address. */
export function seedDescription(input: { mnemonic?: string; hexSeed?: string }): string {
  if (input.hexSeed?.trim()) return 'hex seed (64 chars)'
  if (input.mnemonic?.trim()) return 'BIP39 mnemonic (full seed — verify vs Lace Unshielded)'
  return 'none'
}
