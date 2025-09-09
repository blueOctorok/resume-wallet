// Simple wallet utilities for Base Account SDK
// This replaces the complex Dynamic.xyz wallet-transactions.ts

export const getWalletBalance = async (
  address: string,
  provider: any
): Promise<string> => {
  try {
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })
    return balance
  } catch (error) {
    console.error('Error getting wallet balance:', error)
    return '0'
  }
}

export const signMessage = async (
  message: string,
  provider: any
): Promise<string> => {
  try {
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, await getCurrentAccount(provider)],
    })
    return signature
  } catch (error) {
    console.error('Error signing message:', error)
    throw error
  }
}

export const getCurrentAccount = async (provider: any): Promise<string> => {
  try {
    const accounts = await provider.request({ method: 'eth_accounts' })
    return accounts[0] || ''
  } catch (error) {
    console.error('Error getting current account:', error)
    return ''
  }
}

// Placeholder functions for compatibility
export const sendTransaction = async () => {
  throw new Error('Transaction sending not implemented yet')
}

export const signTypedData = async () => {
  throw new Error('Typed data signing not implemented yet')
}

export const hasSufficientBalance = async () => {
  return true // Placeholder
}

export const sendAtomicTransactions = async () => {
  throw new Error('Atomic transactions not implemented yet')
}

export const sendAtomicTransactionsEnhanced = async () => {
  throw new Error('Enhanced atomic transactions not implemented yet')
}

export const supportsAtomicTransactions = () => {
  return false // Placeholder
}

export const supportsPaymasterServices = () => {
  return false // Placeholder
}

export const getWalletCapabilities = () => {
  return {} // Placeholder
}

export const decodeSignature = () => {
  throw new Error('Signature decoding not implemented yet')
}

export const verifySignature = () => {
  throw new Error('Signature verification not implemented yet')
}

export const signAndVerifyMessage = () => {
  throw new Error('Sign and verify not implemented yet')
}

// Network utilities
export const getEnabledNetworks = () => {
  return [
    {
      chainId: 8453,
      name: 'Base Mainnet',
      rpcUrl: 'https://mainnet.base.org',
    },
    {
      chainId: 84532,
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
    },
  ]
}

export const getNetworkInfo = (chainId: number) => {
  const networks = getEnabledNetworks()
  return networks.find((network) => network.chainId === chainId)
}

export const isNetworkEnabled = (chainId: number) => {
  return getEnabledNetworks().some((network) => network.chainId === chainId)
}

export const getEnabledChainIds = () => {
  return getEnabledNetworks().map((network) => network.chainId)
}

export const getNetworkDisplayInfo = (chainId: number) => {
  const network = getNetworkInfo(chainId)
  return network
    ? {
        name: network.name,
        chainId: network.chainId,
        rpcUrl: network.rpcUrl,
      }
    : null
}

// RPC provider utilities
export const createRpcProviderUtils = () => {
  return {
    getBlockchainData: async () => ({}),
    verifyAddressOnChain: async () => true,
  }
}

export const getBlockchainData = async () => {
  return {}
}

export const verifyAddressOnChain = async () => {
  return true
}
