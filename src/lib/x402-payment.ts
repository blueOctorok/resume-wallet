/**
 * x402 Payment Handler for Pace Drivers Integration
 * 
 * Handles automatic USDC payments on Base Mainnet when T Backend returns 402 Payment Required.
 * This allows the service to automatically pay for AI requests using a service wallet.
 */

import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// USDC on Base Mainnet (6 decimals)
const USDC_BASE_MAINNET_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`

// ERC-20 ABI (transfer + balanceOf)
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
])

interface PaymentRequirements {
  amount: string // Amount in USDC (e.g., "0.01")
  recipient: string // Payment recipient address
  chain?: string // Chain identifier (should be "base")
  invoiceId?: string // Invoice ID for tracking (required for retry)
  paymentId?: string // Optional payment ID for tracking
  metadata?: Record<string, any> // Additional payment metadata
}

/**
 * Send USDC payment on Base Mainnet
 */
export async function sendUSDCPayment(
  requirements: PaymentRequirements
): Promise<{ txHash: string; success: boolean }> {
  const privateKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY

  if (!privateKey) {
    throw new Error('X402_PAYMENT_PRIVATE_KEY or PRIVATE_KEY not configured in environment')
  }

  if (!privateKey.startsWith('0x')) {
    throw new Error('Private key must start with 0x')
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey as `0x${string}`)

  // Create clients for Base Mainnet
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.ALCHEMY_BASE_MAINNET_URL || process.env.BASE_RPC_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.ALCHEMY_BASE_MAINNET_URL || process.env.BASE_RPC_URL),
  })

  console.log('💳 [X402 PAYMENT] Initiating USDC payment')
  console.log(`   From: ${account.address}`)
  console.log(`   To: ${requirements.recipient}`)
  console.log(`   Amount: ${requirements.amount} USDC`)

  // Convert amount to raw USDC (6 decimals)
  const amountRaw = parseUnits(requirements.amount, 6)

  // Check USDC balance first
  const balance = await publicClient.readContract({
    address: USDC_BASE_MAINNET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  })

  // Check ETH balance for gas fees
  const ethBalance = await publicClient.getBalance({
    address: account.address,
  })
  const ethBalanceFormatted = (Number(ethBalance) / 1e18).toFixed(6)
  console.log(`   Current ETH balance: ${ethBalanceFormatted} ETH (for gas)`)

  // Encode transfer function call
  const callData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [requirements.recipient as `0x${string}`, amountRaw],
  })

  const balanceFormatted = (Number(balance) / 1e6).toFixed(6)
  console.log(`   Current USDC balance: ${balanceFormatted} USDC`)

  if (balance < amountRaw) {
    throw new Error(
      `Insufficient USDC balance. Need ${requirements.amount} USDC, have ${balanceFormatted} USDC`
    )
  }

  // Estimate gas cost (rough estimate: ~50k gas for ERC20 transfer on Base)
  const estimatedGas = 50000n
  const gasPrice = await publicClient.getGasPrice()
  const estimatedGasCost = estimatedGas * gasPrice
  const estimatedGasCostFormatted = (Number(estimatedGasCost) / 1e18).toFixed(6)
  console.log(`   Estimated gas cost: ~${estimatedGasCostFormatted} ETH`)

  if (ethBalance < estimatedGasCost) {
    throw new Error(
      `Insufficient ETH for gas. Need ~${estimatedGasCostFormatted} ETH, have ${ethBalanceFormatted} ETH`
    )
  }

  // Send transaction
  const txHash = await walletClient.sendTransaction({
    to: USDC_BASE_MAINNET_ADDRESS,
    data: callData,
  })

  console.log(`✅ [X402 PAYMENT] Transaction sent: ${txHash}`)

  // Wait for transaction receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  })

  if (receipt.status === 'success') {
    // Log actual gas used
    const gasUsed = receipt.gasUsed
    const gasPrice = receipt.effectiveGasPrice || await publicClient.getGasPrice()
    const actualGasCost = gasUsed * gasPrice
    const actualGasCostFormatted = (Number(actualGasCost) / 1e18).toFixed(6)
    console.log(`✅ [X402 PAYMENT] Payment confirmed in block ${receipt.blockNumber}`)
    console.log(`   Gas used: ${gasUsed.toString()} (${actualGasCostFormatted} ETH)`)
    return { txHash, success: true }
  } else {
    throw new Error('Transaction failed')
  }
}

/**
 * Parse 402 Payment Required response from T Backend (Pace Drivers format)
 */
export function parsePaymentRequirements(responseBody: any): PaymentRequirements | null {
  try {
    console.log('📋 [X402 PAYMENT] Parsing payment requirements:', JSON.stringify(responseBody, null, 2))
    
    // Check if backend returned an error instead of payment details
    if (responseBody.detail?.error === 'payment_flow_error') {
      console.error('❌ [X402 PAYMENT] Backend returned payment_flow_error')
      console.error('   This indicates the backend had an issue generating the payment invoice')
      console.error('   Please contact the team - this is a backend issue')
      return null
    }
    
    // Try multiple possible response structures
    // Format 1: Direct fields { invoiceId, amountUnits, payTo, ... }
    // Format 2: Nested in detail { detail: { invoiceId, amountUnits, payTo, ... } }
    // Format 3: Nested in payment { payment: { invoiceId, amountUnits, payTo, ... } }
    
    const payment = responseBody.detail || responseBody.payment || responseBody
    
    const invoiceId = payment.invoiceId || responseBody.invoiceId
    const amountUnits = payment.amountUnits || responseBody.amountUnits
    const payTo = payment.payTo || responseBody.payTo
    const chain = payment.chain || responseBody.chain
    const decimals = payment.decimals || responseBody.decimals || 6

    if (!amountUnits || !payTo) {
      console.warn('⚠️ [X402 PAYMENT] Missing amountUnits or payTo in payment requirements')
      console.warn('   Response structure:', JSON.stringify(responseBody, null, 2))
      console.warn('   Tried parsing from:', { payment, direct: responseBody })
      return null
    }

    // Convert amountUnits to USDC string (amountUnits is in smallest unit, e.g., 1000000 = 1 USDC)
    const amountUSDC = (Number(amountUnits) / Math.pow(10, decimals)).toString()

    console.log('✅ [X402 PAYMENT] Parsed payment requirements:')
    console.log(`   Invoice ID: ${invoiceId}`)
    console.log(`   Amount: ${amountUSDC} USDC (${amountUnits} units)`)
    console.log(`   Pay To: ${payTo}`)
    console.log(`   Chain: ${chain}`)

    return {
      amount: amountUSDC,
      recipient: payTo,
      chain: chain || 'base-mainnet',
      invoiceId: invoiceId,
      paymentId: invoiceId,
      metadata: responseBody,
    }
  } catch (error) {
    console.error('❌ [X402 PAYMENT] Failed to parse payment requirements:', error)
    return null
  }
}

