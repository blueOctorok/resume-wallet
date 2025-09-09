/**
 * Base Network Configuration
 * Centralized configuration for Base network settings
 */

export const BASE_NETWORKS = {
  mainnet: {
    chainId: 8453,
    name: 'Base Mainnet',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorer: 'https://base.blockscout.com/',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia-explorer.base.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const

export const BASE_CHAIN_IDS = {
  MAINNET: 8453,
  SEPOLIA: 84532,
} as const

export const BASE_RPC_URLS = {
  MAINNET: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  SEPOLIA: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
} as const

export const BASE_BLOCK_EXPLORERS = {
  MAINNET: 'https://base.blockscout.com/',
  SEPOLIA: 'https://sepolia-explorer.base.org',
} as const

/**
 * Get Base network configuration by chain ID
 */
export function getBaseNetworkConfig(chainId: number) {
  switch (chainId) {
    case BASE_CHAIN_IDS.MAINNET:
      return BASE_NETWORKS.mainnet
    case BASE_CHAIN_IDS.SEPOLIA:
      return BASE_NETWORKS.sepolia
    default:
      return null
  }
}

/**
 * Check if a chain ID is a Base network
 */
export function isBaseNetwork(chainId: number): boolean {
  return (
    chainId === BASE_CHAIN_IDS.MAINNET || chainId === BASE_CHAIN_IDS.SEPOLIA
  )
}

/**
 * Get the appropriate Base RPC URL for the current environment
 */
export function getBaseRpcUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? BASE_RPC_URLS.MAINNET
    : BASE_RPC_URLS.SEPOLIA
}

/**
 * Get the appropriate Base chain ID for the current environment
 */
export function getBaseChainId(): number {
  return process.env.NODE_ENV === 'production'
    ? BASE_CHAIN_IDS.MAINNET
    : BASE_CHAIN_IDS.SEPOLIA
}
