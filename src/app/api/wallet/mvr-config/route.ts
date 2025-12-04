import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/wallet/mvr-config
 * Returns MVR payment configuration for frontend
 */
export async function GET(request: NextRequest) {
  try {
    const usdcAddress = process.env.USDC_BASE_SEPOLIA_ADDRESS
    const treasuryAddress = process.env.TREASURY_ADDRESS
    const priceUsdc = process.env.MVR_PRICE_USDC || '10'

    if (!usdcAddress || !treasuryAddress) {
      return NextResponse.json(
        { error: 'MVR payment configuration missing' },
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

