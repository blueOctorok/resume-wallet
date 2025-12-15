import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * GET /api/wallet/mvr-config
 * Returns MVR payment configuration for frontend
 * 
 * MVR payments are routed to the x402 payment wallet to fund AI services.
 * This creates a circular funding mechanism where user payments for MVRs
 * automatically fund the AI services.
 * 
 * Note: Currently MVR payments are on Base Sepolia (for testing with Alchemy Account Kit),
 * while x402 payments are on Base Mainnet. The wallet address is the same across networks,
 * but you'll need to ensure the x402 wallet is funded on the same network as MVR payments.
 * For production, consider aligning both on the same network (likely Base Mainnet).
 */
export async function GET(request: NextRequest) {
  try {
    const usdcAddress = process.env.USDC_BASE_SEPOLIA_ADDRESS
    
    // Route MVR payments to the x402 payment wallet (same wallet that funds AI)
    // This creates a circular funding mechanism
    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      return NextResponse.json(
        { error: 'X402 payment wallet not configured' },
        { status: 500 }
      )
    }
    
    // Derive wallet address from private key
    const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
    const paymentAccount = privateKeyToAccount(normalizedKey as `0x${string}`)
    const treasuryAddress = paymentAccount.address
    
    // Very low test price for testing
    const priceUsdc = process.env.MVR_PRICE_USDC || '0.01'

    if (!usdcAddress) {
      return NextResponse.json(
        { error: 'MVR payment configuration missing (USDC address)' },
        { status: 500 }
      )
    }

    // USDC on Base Sepolia uses 6 decimals
    const decimals = 6

    return NextResponse.json({
      usdcAddress,
      decimals,
      treasuryAddress,
      priceUsdc,
    })
  } catch (error) {
    console.error('❌ Error fetching MVR config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MVR configuration' },
      { status: 500 }
    )
  }
}

