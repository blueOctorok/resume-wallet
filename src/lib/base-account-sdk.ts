// Base Account SDK Configuration - using hardcoded values to avoid build-time imports
export const baseAccountConfig = {
  appName: 'Resume Wallet',
  appLogoUrl: '/logo.png', // Update this to your app logo
  appChainIds: [8453, 84532], // Base Mainnet and Base Sepolia chain IDs
  preference: {
    attribution: {
      auto: true, // Enable auto attribution for proper transaction tracking
    },
    telemetry: true, // Enable telemetry for better debugging
  },
  paymasterUrls: {
    8453: 'https://paymaster.base.org/api/v1/sponsor',
    84532: 'https://paymaster.base-sepolia.org/api/v1/sponsor',
  },
}

// Base network constants - hardcoded to avoid build-time imports
export const BASE_CHAIN_IDS = {
  MAINNET: 8453, // Base Mainnet chain ID
  SEPOLIA: 84532, // Base Sepolia chain ID
} as const

// Create Base Account SDK instance (client-side only with dynamic import)
let baseAccountSDK: any = null
let baseProvider: any = null

// Initialize SDK only on client side with dynamic import
if (typeof window !== 'undefined') {
  try {
    // Use dynamic import to avoid module loading issues at build time
    import('@base-org/account')
      .then(({ createBaseAccountSDK }) => {
        baseAccountSDK = createBaseAccountSDK(baseAccountConfig)
        baseProvider = baseAccountSDK.getProvider()
        console.log('✅ Base Account SDK initialized successfully')
      })
      .catch((error) => {
        console.error('❌ Failed to initialize Base Account SDK:', error)
      })
  } catch (error) {
    console.error('❌ Failed to initialize Base Account SDK:', error)
  }
}

export { baseAccountSDK, baseProvider }

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
