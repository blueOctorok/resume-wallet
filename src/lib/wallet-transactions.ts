import { formatEther, parseEther } from 'viem'
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { DynamicWallet } from '@dynamic-labs/sdk-react-core'

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
