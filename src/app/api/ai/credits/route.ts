import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getOrCreateUsage,
  checkUsage,
  addCredits,
  getCoverLetterDailyRemaining,
  STORMI_CREDIT_PACKS,
  STORMI_JOB_MATCH_FREE_DAILY,
  type StormiCreditPackId,
} from '@/lib/ava-usage'

/**
 * GET /api/ai/credits
 *
 * Returns the caller's Stormi usage: daily free remaining, purchased credits, total messages.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let supabase
    try {
      supabase = await getAdminSupabaseClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi Credits] GET Supabase init failed:', msg)
      return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 })
    }

    const usage = await getOrCreateUsage(supabase, userId)
    const usageCheck = checkUsage(usage)

    return NextResponse.json({
      dailyRemaining: usageCheck.dailyRemaining,
      credits: usageCheck.credits,
      totalMessages: usageCheck.totalMessages,
      coverLettersDailyRemaining: getCoverLetterDailyRemaining(usage),
      jobMatchFreeRemainingToday: Math.max(0, STORMI_JOB_MATCH_FREE_DAILY - usage.jobMatchAiDailyUsed),
      packs: STORMI_CREDIT_PACKS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Stormi Credits] GET error:', message)
    if (error instanceof Error && error.stack) {
      console.error('[Stormi Credits] GET stack:', error.stack)
    }
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}

/**
 * POST /api/ai/credits
 *
 * Purchase Stormi chat credits.
 * Body: { pack: 'starter' | 'standard' | 'pro', txHash: string }
 *
 * The txHash is the on-chain USDC transfer tx. In production you'd verify
 * the transfer on-chain before crediting. For now we trust the client and
 * record the payment for audit.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { pack, txHash } = body as { pack: string; txHash: string }

    if (!pack || !txHash) {
      return NextResponse.json({ error: 'Missing pack or txHash' }, { status: 400 })
    }

    if (!(pack in STORMI_CREDIT_PACKS)) {
      return NextResponse.json({ error: `Invalid pack: ${pack}` }, { status: 400 })
    }

    const packId = pack as StormiCreditPackId
    const packInfo = STORMI_CREDIT_PACKS[packId]

    let supabase
    try {
      supabase = await getAdminSupabaseClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi Credits] POST Supabase init failed:', msg)
      return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 })
    }
    // Record payment in the payments table for audit trail
    await supabase.from('payments').insert({
      user_id: userId,
      type: 'AVA_CREDITS',
      amount_usdc: parseFloat(packInfo.priceUsdc),
      tx_hash: txHash,
      status: 'COMPLETED',
    })

    // Credit the user
    await addCredits(supabase, userId, packInfo.messages)

    // Return updated usage
    const usage = await getOrCreateUsage(supabase, userId)
    const usageCheck = checkUsage(usage)

    return NextResponse.json({
      success: true,
      creditsAdded: packInfo.messages,
      dailyRemaining: usageCheck.dailyRemaining,
      credits: usageCheck.credits,
      totalMessages: usageCheck.totalMessages,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Stormi Credits] POST error:', message)
    if (error instanceof Error && error.stack) {
      console.error('[Stormi Credits] POST stack:', error.stack)
    }
    return NextResponse.json({ error: 'Failed to purchase credits' }, { status: 500 })
  }
}
