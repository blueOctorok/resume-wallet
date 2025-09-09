import { createBaseAccountSDK, base } from '@base-org/account'

// Base Account SDK Configuration
export const baseAccountConfig = {
  appName: 'Resume Wallet',
  appLogoUrl: '/logo.png', // Update this to your app logo
  appChainIds: [
    base.constants.CHAIN_IDS.base,
    base.constants.CHAIN_IDS.baseSepolia,
  ],
}

// Create Base Account SDK instance (client-side only)
let baseAccountSDK: any = null
let baseProvider: any = null

// Initialize SDK only on client side
if (typeof window !== 'undefined') {
  try {
    baseAccountSDK = createBaseAccountSDK(baseAccountConfig)
    baseProvider = baseAccountSDK.getProvider()
  } catch (error) {
    console.error('Failed to initialize Base Account SDK:', error)
  }
}

export { baseAccountSDK, baseProvider }

// Base network constants
export const BASE_CHAIN_IDS = {
  MAINNET: base.constants.CHAIN_IDS.base,
  SEPOLIA: base.constants.CHAIN_IDS.baseSepolia,
} as const

// Helper function to get current chain ID
export const getCurrentChainId = (): number => {
  // In production, you might want to get this from the connected wallet
  // For now, return Sepolia for development
  return process.env.NODE_ENV === 'production'
    ? BASE_CHAIN_IDS.MAINNET
    : BASE_CHAIN_IDS.SEPOLIA
}

// Helper function to check if we're on Base network
export const isBaseNetwork = (chainId: number): boolean => {
  return (
    chainId === BASE_CHAIN_IDS.MAINNET || chainId === BASE_CHAIN_IDS.SEPOLIA
  )
}

// Export the SDK instance for use in components
export default baseAccountSDK
