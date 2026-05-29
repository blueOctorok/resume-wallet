/**
 * Alchemy Smart Wallets Configuration
 *
 * Employer **company shared wallet** (optional):
 * - Server: `COMPANY_WALLET_SERVICE_PRIVATE_KEY` — EOA used as permanent co-owner to add/remove team members on-chain (`company-wallet-server.ts`).
 * - Client: `NEXT_PUBLIC_COMPANY_WALLET_SERVICE_ADDRESS` — same account’s **address** (0x…); required for `MultiOwnerLightAccount` init params when paying from the company wallet (`MvrPaymentButton`).
 *
 * Professional SaaS-first authentication for resume verification platform
 * - Email + OTP login (dead simple for drivers and employers)
 * - Automatic wallet creation (users don't know it's crypto)
 * - USDC payments with sponsored gas
 * - Professional business appearance
 */

import { AlchemyAccountsUIConfig, createConfig } from '@account-kit/react'
import { alchemy, baseSepolia } from '@account-kit/infra'

// Environment variables
const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
const ALCHEMY_POLICY_ID = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID

// CORS workaround (2026-05-29): Alchemy's bare node endpoint
// (`https://base-sepolia.g.alchemy.com/v2` + an `Authorization: Bearer` header —
// the SDK's default `apiKey` mode) started 401-ing the browser CORS preflight
// with no `Access-Control-Allow-Origin`, which blocks smart-account load
// (`eth_getCode`) for every user and triggers an infinite retry storm. The SAME
// endpoint with the key in the URL PATH returns proper CORS headers. So we use a
// split transport below: keep `apiKey` on `alchemyConnection` (the signer at
// api.g.alchemy.com still needs the Bearer header and is unaffected), but route
// plain node RPC through the key-in-path URL via `nodeRpcUrl`, which sends no
// Authorization header and passes CORS.
const ALCHEMY_NODE_RPC_URL = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

if (!ALCHEMY_POLICY_ID) {
  console.warn(
    '⚠️ NEXT_PUBLIC_ALCHEMY_POLICY_ID not set - gas sponsorship may not work'
  )
}

// UI Configuration for Simple Authentication Options
const uiConfig: AlchemyAccountsUIConfig = {
  illustrationStyle: 'outline',
  auth: {
    header: 'Sign In',
    hideSignInText: true,
    sections: [
      [
        {
          type: 'email',
          emailMode: 'otp',
          buttonLabel: 'Continue with Email',
          placeholder: 'Enter your email address',
        },
      ],
      [
        {
          type: 'social',
          authProviderId: 'google',
          mode: 'popup',
        },
      ],
    ],
  },
}

// Smart Wallets configuration for resume verification platform (Sepolia testnet)
let alchemyAccountConfig: any
let alchemyAccountConfigProduction: any

try {
  alchemyAccountConfig = createConfig(
    {
      transport: alchemy({
        alchemyConnection: { apiKey: ALCHEMY_API_KEY },
        nodeRpcUrl: ALCHEMY_NODE_RPC_URL,
      }),
      chain: baseSepolia,
      policyId: ALCHEMY_POLICY_ID,
      enablePopupOauth: true, // Enable popup OAuth for Google
      // Session configuration - extend session to 7 days for better UX
      sessionConfig: {
        expirationTimeMs: 1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
      },
    },
    uiConfig
  )

  alchemyAccountConfigProduction = createConfig(
    {
      transport: alchemy({
        alchemyConnection: { apiKey: ALCHEMY_API_KEY },
        nodeRpcUrl: ALCHEMY_NODE_RPC_URL,
      }),
      chain: baseSepolia,
      policyId: ALCHEMY_POLICY_ID,
      enablePopupOauth: true, // Enable popup OAuth for Google
      // Session configuration - extend session to 7 days for better UX
      sessionConfig: {
        expirationTimeMs: 1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
      },
    },
    uiConfig
  )
} catch (error) {
  console.error('❌ Failed to create Alchemy config:', error)
}

// Helper to get current config based on environment
export function getAlchemyAccountConfig() {
  const isProduction = process.env.NODE_ENV === 'production'
  const config = isProduction
    ? alchemyAccountConfigProduction
    : alchemyAccountConfig

  if (!config) {
    console.error(
      '❌ Alchemy config is undefined for environment:',
      process.env.NODE_ENV
    )
  }

  return config
}

export { alchemyAccountConfig, alchemyAccountConfigProduction }

// Export chain info for other components
export const currentChain = baseSepolia
export const isTestnet = currentChain.id === baseSepolia.id

// Export policy ID for gas sponsorship
export const policyId = ALCHEMY_POLICY_ID

console.log('🔧 Alchemy Smart Wallets configured:', {
  chain: currentChain.name,
  testnet: isTestnet,
  gasSponsorship: !!ALCHEMY_POLICY_ID,
  apiKey: ALCHEMY_API_KEY.slice(0, 8) + '...',
  authMethods: ['email-otp', 'google'],
  uiConfig: uiConfig,
})
