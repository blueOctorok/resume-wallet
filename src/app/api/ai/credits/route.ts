import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getOrCreateUsage,
  checkUsage,
  getCoverLetterDailyRemaining,
  STORMI_CREDIT_PACKS,
  STORMI_JOB_MATCH_FREE_DAILY,
} from '@/lib/ava-usage'

/**
 * GET /api/ai/credits
 *
 * Returns the caller's Stormi usage: daily free remaining, purchased credits, total messages.
 * Purchasing credits is not wired yet — it will be a Stripe Checkout flow, never a
 * client-supplied transaction hash.
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
