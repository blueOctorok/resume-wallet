import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * GET /api/wallet/psp-config
 * Same shape as MVR config — separate price env for PSP orders.
 */
export async function GET(_request: NextRequest) {
  try {
    const usdcAddress = process.env.USDC_BASE_SEPOLIA_ADDRESS

    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      return NextResponse.json({ error: 'Payment wallet not configured' }, { status: 500 })
    }

    const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
    const paymentAccount = privateKeyToAccount(normalizedKey as `0x${string}`)
    const treasuryAddress = paymentAccount.address

    const priceUsdc = process.env.PSP_PRICE_USDC || process.env.MVR_PRICE_USDC || '0.01'

    if (!usdcAddress) {
      return NextResponse.json(
        { error: 'PSP payment configuration missing (USDC address)' },
        { status: 500 },
      )
    }

    const decimals = 6

    return NextResponse.json({
      usdcAddress,
      decimals,
      treasuryAddress,
      priceUsdc,
    })
  } catch (error) {
    console.error('[PSP CONFIG] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch PSP configuration' }, { status: 500 })
  }
}
