import { NextResponse } from 'next/server'

/**
 * GET /api/credits
 * 
 * Public endpoint to fetch credit balance for UI display.
 * This is a read-only operation that doesn't expose sensitive data.
 */
export async function GET() {
  try {
    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      return NextResponse.json(
        { error: 'No payment wallet configured' },
        { status: 500 }
      )
    }

    // Get wallet address from private key
    const { privateKeyToAccount } = await import('viem/accounts')
    const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
    const account = privateKeyToAccount(normalizedKey as `0x${string}`)

    // Fetch credits from T Backend
    const url = `https://api-v2.fluxpointstudios.com/payments/credits?partner=pace_drivers&wallet=${account.address}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`❌ [CREDITS] Failed to fetch credits: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error(text)
      return NextResponse.json(
        { error: 'Failed to fetch credits', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ [CREDITS] Balance retrieved:', data)

    return NextResponse.json({
      wallet: account.address,
      ...data,
    })
  } catch (error) {
    console.error('❌ [CREDITS] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

