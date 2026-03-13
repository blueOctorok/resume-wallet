import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * GET /api/wallet/mvr-config
 * Returns MVR payment configuration for frontend.
 * Derives the treasury wallet address from the payment private key.
 */
export async function GET(request: NextRequest) {
  try {
    const usdcAddress = process.env.USDC_BASE_SEPOLIA_ADDRESS
    
    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      return NextResponse.json(
        { error: 'Payment wallet not configured' },
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

