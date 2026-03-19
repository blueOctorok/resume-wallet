import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  checkUsage,
  addCredits,
  AVA_CREDIT_PACKS,
  type AvaCreditPackId,
} from '@/lib/ava-usage'

/**
 * GET /api/ai/credits
 *
 * Returns the caller's AvA usage: daily free remaining, purchased credits, total messages.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const usage = await getOrCreateUsage(supabase, user.id)
    const usageCheck = checkUsage(usage)

    return NextResponse.json({
      dailyRemaining: usageCheck.dailyRemaining,
      credits: usageCheck.credits,
      totalMessages: usageCheck.totalMessages,
      packs: AVA_CREDIT_PACKS,
    })
  } catch (error) {
    console.error('[AvA Credits] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}

/**
 * POST /api/ai/credits
 *
 * Purchase AvA chat credits.
 * Body: { pack: 'starter' | 'standard' | 'pro', txHash: string }
 *
 * The txHash is the on-chain USDC transfer tx. In production you'd verify
 * the transfer on-chain before crediting. For now we trust the client and
 * record the payment for audit.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 401 })
    }

    const body = await request.json()
    const { pack, txHash } = body as { pack: string; txHash: string }

    if (!pack || !txHash) {
      return NextResponse.json({ error: 'Missing pack or txHash' }, { status: 400 })
    }

    if (!(pack in AVA_CREDIT_PACKS)) {
      return NextResponse.json({ error: `Invalid pack: ${pack}` }, { status: 400 })
    }

    const packId = pack as AvaCreditPackId
    const packInfo = AVA_CREDIT_PACKS[packId]

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Record payment in the payments table for audit trail
    await supabase.from('payments').insert({
      user_id: user.id,
      type: 'AVA_CREDITS',
      amount_usdc: parseFloat(packInfo.priceUsdc),
      tx_hash: txHash,
      status: 'COMPLETED',
    })

    // Credit the user
    await addCredits(supabase, user.id, packInfo.messages)

    // Return updated usage
    const usage = await getOrCreateUsage(supabase, user.id)
    const usageCheck = checkUsage(usage)

    return NextResponse.json({
      success: true,
      creditsAdded: packInfo.messages,
      dailyRemaining: usageCheck.dailyRemaining,
      credits: usageCheck.credits,
      totalMessages: usageCheck.totalMessages,
    })
  } catch (error) {
    console.error('[AvA Credits] POST error:', error)
    return NextResponse.json({ error: 'Failed to purchase credits' }, { status: 500 })
  }
}
