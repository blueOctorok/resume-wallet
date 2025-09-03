import {
  formatEther,
  parseEther,
  recoverMessageAddress,
  verifyMessage,
} from 'viem'
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { DynamicWallet } from '@dynamic-labs/sdk-react-core'
import { useRpcProviders } from '@dynamic-labs/sdk-react-core'
import { evmProvidersSelector } from '@dynamic-labs/ethereum-core'

/**
 * Get wallet balance in ETH
 */
export async function getWalletBalance(wallet: DynamicWallet): Promise<string> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    const publicClient = await wallet.getPublicClient()
    const balance = await publicClient.getBalance({
      address: wallet.address as `0x${string}`,
    })

    return formatEther(balance)
  } catch (error) {
    console.error('Failed to get wallet balance:', error)
    throw error
  }
}

/**
 * Sign a message with the embedded wallet
 */
export async function signMessage(
  wallet: DynamicWallet,
  message: string
): Promise<string> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    const walletClient = await wallet.getWalletClient()
    const signature = await walletClient.signMessage({
      message,
      account: wallet.address as `0x${string}`,
    })

    return signature
  } catch (error) {
    console.error('Failed to sign message:', error)
    throw error
  }
}

/**
 * Send a simple ETH transaction
 */
export async function sendTransaction(
  wallet: DynamicWallet,
  to: string,
  amount: string // Amount in ETH as string
): Promise<string> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    const walletClient = await wallet.getWalletClient()
    const publicClient = await wallet.getPublicClient()

    // Get current gas price
    const gasPrice = await publicClient.getGasPrice()

    // Estimate gas for the transaction
    const gasEstimate = await publicClient.estimateGas({
      to: to as `0x${string}`,
      value: parseEther(amount),
      account: wallet.address as `0x${string}`,
    })

    // Send the transaction
    const hash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther(amount),
      gas: gasEstimate,
      gasPrice,
      account: wallet.address as `0x${string}`,
    })

    return hash
  } catch (error) {
    console.error('Failed to send transaction:', error)
    throw error
  }
}

/**
 * Sign typed data (EIP-712)
 */
export async function signTypedData(
  wallet: DynamicWallet,
  domain: any,
  types: any,
  message: any
): Promise<string> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    const walletClient = await wallet.getWalletClient()
    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType: 'ResumeVerification',
      message,
      account: wallet.address as `0x${string}`,
    })

    return signature
  } catch (error) {
    console.error('Failed to sign typed data:', error)
    throw error
  }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  wallet: DynamicWallet,
  txHash: string
): Promise<any> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    const publicClient = await wallet.getPublicClient()
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    })

    return receipt
  } catch (error) {
    console.error('Failed to get transaction receipt:', error)
    throw error
  }
}

/**
 * Check if wallet has sufficient balance for gas
 */
export async function hasSufficientBalance(
  wallet: DynamicWallet,
  requiredAmount: string = '0.001' // Default 0.001 ETH for gas
): Promise<boolean> {
  try {
    const balance = await getWalletBalance(wallet)
    const balanceInEth = parseFloat(balance)
    const requiredInEth = parseFloat(requiredAmount)

    return balanceInEth >= requiredInEth
  } catch (error) {
    console.error('Failed to check balance:', error)
    return false
  }
}

/**
 * Get wallet capabilities (EIP-5792)
 * Returns detailed capability information for the wallet
 */
export async function getWalletCapabilities(wallet: DynamicWallet): Promise<{
  chainId: string
  capabilities: {
    atomic: boolean
    paymasterService: boolean
    atomicStatus: string
    paymasterStatus: string
  }
} | null> {
  if (!isEthereumWallet(wallet)) {
    return null
  }

  try {
    const chainId = await wallet.getNetwork()
    const walletClient = await wallet.getWalletClient()
    const capabilities = await walletClient.getCapabilities()

    if (capabilities && capabilities[chainId]) {
      const chainCapabilities = capabilities[chainId]
      const paymasterServiceSupported =
        chainCapabilities.paymasterService?.supported || false
      const atomicStatus = chainCapabilities.atomic?.status || 'unsupported'
      const atomicSupported =
        atomicStatus === 'ready' || atomicStatus === 'supported'

      return {
        chainId: chainId.toString(),
        capabilities: {
          atomic: atomicSupported,
          paymasterService: paymasterServiceSupported,
          atomicStatus,
          paymasterStatus: paymasterServiceSupported
            ? 'supported'
            : 'unsupported',
        },
      }
    }

    return null
  } catch (error) {
    console.error('Failed to get wallet capabilities:', error)
    return null
  }
}

/**
 * Send multiple transactions atomically (EIP-5792)
 * Enhanced version with proper capability checking and paymaster support
 */
export async function sendAtomicTransactionsEnhanced(
  wallet: DynamicWallet,
  calls: Array<{
    to: string
    value?: string
    data?: string
  }>,
  options?: {
    usePaymaster?: boolean
    paymasterUrl?: string
  }
): Promise<{
  id: string
  capabilities: {
    atomic: boolean
    paymasterService: boolean
    atomicStatus: string
    paymasterStatus: string
  }
}> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    // Get detailed capabilities
    const capabilities = await getWalletCapabilities(wallet)
    if (!capabilities) {
      throw new Error('Failed to get wallet capabilities')
    }

    if (!capabilities.capabilities.atomic) {
      throw new Error(
        `Atomic transactions not supported. Status: ${capabilities.capabilities.atomicStatus}`
      )
    }

    const formattedCalls = calls.map((call) => ({
      to: call.to as `0x${string}`,
      value: call.value ? parseEther(call.value) : BigInt(0),
      data: call.data as `0x${string}` | undefined,
    }))

    const callParams: any = {
      calls: formattedCalls,
      version: '2.0.0',
    }

    // Add paymaster support if available and requested
    if (options?.usePaymaster && capabilities.capabilities.paymasterService) {
      callParams.capabilities = {
        paymasterService: {
          url: options.paymasterUrl || undefined,
        },
      }
    }

    const result = await wallet.sendCalls(callParams)

    return {
      id: result.id,
      capabilities: capabilities.capabilities,
    }
  } catch (error) {
    console.error('Failed to send atomic transactions:', error)
    throw error
  }
}

/**
 * Send multiple transactions atomically (EIP-5792)
 * Requires wallet to support atomic transactions
 */
export async function sendAtomicTransactions(
  wallet: DynamicWallet,
  calls: Array<{
    to: string
    value?: string
    data?: string
  }>
): Promise<string> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    // Check if wallet supports atomic transactions
    const supportsAtomic = await wallet.isAtomicSupported()
    if (!supportsAtomic) {
      throw new Error('Wallet does not support atomic transactions (EIP-5792)')
    }

    // Convert calls to the format expected by sendCalls
    const formattedCalls = calls.map((call) => ({
      to: call.to as `0x${string}`,
      value: call.value ? parseEther(call.value) : BigInt(0),
      data: call.data as `0x${string}` | undefined,
    }))

    // Send atomic transactions
    const result = await wallet.sendCalls({
      calls: formattedCalls,
      version: '2.0.0',
    })

    return result.id
  } catch (error) {
    console.error('Failed to send atomic transactions:', error)
    throw error
  }
}

/**
 * Check if wallet supports atomic transactions (EIP-5792)
 */
export async function supportsAtomicTransactions(
  wallet: DynamicWallet
): Promise<boolean> {
  if (!isEthereumWallet(wallet)) {
    return false
  }

  try {
    return await wallet.isAtomicSupported()
  } catch (error) {
    console.error('Failed to check atomic support:', error)
    return false
  }
}

/**
 * Check if wallet supports paymaster services (EIP-5792)
 */
export async function supportsPaymasterServices(
  wallet: DynamicWallet
): Promise<boolean> {
  if (!isEthereumWallet(wallet)) {
    return false
  }

  try {
    return await wallet.isPaymasterServiceSupported()
  } catch (error) {
    console.error('Failed to check paymaster support:', error)
    return false
  }
}

/**
 * Decode and verify a message signature
 */
export async function decodeSignature(
  message: string,
  signature: string,
  expectedAddress?: string
): Promise<{
  originalMessage: string
  signature: string
  recoveredAddress: string
  isValidSignature: boolean
  addressMatch: boolean
  expectedAddress?: string
}> {
  try {
    // Recover the signer's address from the signature
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })

    // Verify the signature is valid
    const isValidSignature = await verifyMessage({
      address: recoveredAddress,
      message,
      signature: signature as `0x${string}`,
    })

    // Check if the recovered address matches the expected address
    const addressMatch = expectedAddress
      ? recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
      : true

    return {
      originalMessage: message,
      signature,
      recoveredAddress,
      isValidSignature,
      addressMatch,
      expectedAddress,
    }
  } catch (error) {
    console.error('Failed to decode signature:', error)
    throw error
  }
}

/**
 * Verify a signature against a specific address
 */
export async function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const decoded = await decodeSignature(message, signature, expectedAddress)
    return decoded.isValidSignature && decoded.addressMatch
  } catch (error) {
    console.error('Failed to verify signature:', error)
    return false
  }
}

/**
 * Sign and verify a message (for testing purposes)
 */
export async function signAndVerifyMessage(
  wallet: DynamicWallet,
  message: string
): Promise<{
  signature: string
  verification: {
    originalMessage: string
    signature: string
    recoveredAddress: string
    isValidSignature: boolean
    addressMatch: boolean
    expectedAddress: string
  }
}> {
  if (!isEthereumWallet(wallet)) {
    throw new Error('Wallet is not an Ethereum wallet')
  }

  try {
    // Sign the message
    const signature = await signMessage(wallet, message)

    // Verify the signature
    const verification = await decodeSignature(
      message,
      signature,
      wallet.address
    )

    return {
      signature,
      verification,
    }
  } catch (error) {
    console.error('Failed to sign and verify message:', error)
    throw error
  }
}

/**
 * RPC Provider utilities for direct blockchain access
 */
export class RpcProviderUtils {
  private evmProviders: any

  constructor(evmProviders: any) {
    this.evmProviders = evmProviders
  }

  /**
   * Get the default EVM provider (usually mainnet)
   */
  getDefaultProvider() {
    return this.evmProviders?.defaultProvider
  }

  /**
   * Get all available EVM providers
   */
  getAllProviders() {
    return this.evmProviders?.providers || []
  }

  /**
   * Get provider for specific chain ID
   */
  getProviderByChainId(chainId: number | string) {
    return this.evmProviders?.getProviderByChainId?.(chainId)
  }

  /**
   * Get provider for Ethereum mainnet
   */
  getMainnetProvider() {
    return this.getProviderByChainId(1)
  }

  /**
   * Get provider for Polygon
   */
  getPolygonProvider() {
    return this.getProviderByChainId(137)
  }

  /**
   * Get provider for Polygon Mumbai testnet
   */
  getMumbaiProvider() {
    return this.getProviderByChainId(80001)
  }

  /**
   * Check if a provider is available for a specific chain
   */
  hasProviderForChain(chainId: number | string): boolean {
    return !!this.getProviderByChainId(chainId)
  }

  /**
   * Get available chain IDs
   */
  getAvailableChainIds(): (number | string)[] {
    const providers = this.getAllProviders()
    return providers.map((provider: any) => provider.chainId).filter(Boolean)
  }
}

/**
 * Create RPC provider utilities instance
 */
export function createRpcProviderUtils(evmProviders: any): RpcProviderUtils {
  return new RpcProviderUtils(evmProviders)
}

/**
 * Get blockchain data using RPC provider
 */
export async function getBlockchainData(
  rpcUtils: RpcProviderUtils,
  chainId: number | string,
  data: {
    address?: string
    blockNumber?: number
    transactionHash?: string
  }
): Promise<{
  balance?: string
  block?: any
  transaction?: any
  chainId: number | string
}> {
  try {
    const provider = rpcUtils.getProviderByChainId(chainId)
    if (!provider) {
      throw new Error(`No provider available for chain ID: ${chainId}`)
    }

    const result: any = { chainId }

    // Get balance if address provided
    if (data.address) {
      const balance = await provider.getBalance(data.address)
      result.balance = formatEther(balance)
    }

    // Get block if block number provided
    if (data.blockNumber) {
      result.block = await provider.getBlock(data.blockNumber)
    }

    // Get transaction if hash provided
    if (data.transactionHash) {
      result.transaction = await provider.getTransaction(data.transactionHash)
    }

    return result
  } catch (error) {
    console.error('Failed to get blockchain data:', error)
    throw error
  }
}

/**
 * Verify address on blockchain using RPC provider
 */
export async function verifyAddressOnChain(
  rpcUtils: RpcProviderUtils,
  chainId: number | string,
  address: string
): Promise<{
  isValid: boolean
  balance: string
  chainId: number | string
  address: string
}> {
  try {
    const provider = rpcUtils.getProviderByChainId(chainId)
    if (!provider) {
      throw new Error(`No provider available for chain ID: ${chainId}`)
    }

    // Check if address is valid
    const isValid = await provider.isAddress(address)

    // Get balance
    const balance = isValid ? await provider.getBalance(address) : BigInt(0)

    return {
      isValid,
      balance: formatEther(balance),
      chainId,
      address,
    }
  } catch (error) {
    console.error('Failed to verify address on chain:', error)
    throw error
  }
}

/**
 * Get enabled networks from wallet connector
 */
export function getEnabledNetworks(wallet: DynamicWallet): any[] {
  if (!isEthereumWallet(wallet)) {
    return []
  }

  try {
    const enabledNetworks = wallet.connector.getEnabledNetworks()
    return enabledNetworks || []
  } catch (error) {
    console.error('Failed to get enabled networks:', error)
    return []
  }
}

/**
 * Get network information for a specific chain ID
 */
export function getNetworkInfo(
  wallet: DynamicWallet,
  chainId: number | string
): any | null {
  if (!isEthereumWallet(wallet)) {
    return null
  }

  try {
    const enabledNetworks = getEnabledNetworks(wallet)
    return (
      enabledNetworks.find((network) => network.chainId === chainId) || null
    )
  } catch (error) {
    console.error('Failed to get network info:', error)
    return null
  }
}

/**
 * Check if a specific network is enabled
 */
export function isNetworkEnabled(
  wallet: DynamicWallet,
  chainId: number | string
): boolean {
  if (!isEthereumWallet(wallet)) {
    return false
  }

  try {
    const enabledNetworks = getEnabledNetworks(wallet)
    return enabledNetworks.some((network) => network.chainId === chainId)
  } catch (error) {
    console.error('Failed to check if network is enabled:', error)
    return false
  }
}

/**
 * Get all enabled network chain IDs
 */
export function getEnabledChainIds(wallet: DynamicWallet): (number | string)[] {
  if (!isEthereumWallet(wallet)) {
    return []
  }

  try {
    const enabledNetworks = getEnabledNetworks(wallet)
    return enabledNetworks.map((network) => network.chainId).filter(Boolean)
  } catch (error) {
    console.error('Failed to get enabled chain IDs:', error)
    return []
  }
}

/**
 * Get network display information
 */
export function getNetworkDisplayInfo(wallet: DynamicWallet): Array<{
  chainId: number | string
  chainName: string
  name: string
  symbol: string
  isEnabled: boolean
}> {
  if (!isEthereumWallet(wallet)) {
    return []
  }

  try {
    const enabledNetworks = getEnabledNetworks(wallet)
    return enabledNetworks.map((network) => ({
      chainId: network.chainId,
      chainName: network.chainName || network.name,
      name: network.name,
      symbol: network.nativeCurrency?.symbol || 'ETH',
      isEnabled: true,
    }))
  } catch (error) {
    console.error('Failed to get network display info:', error)
    return []
  }
}
