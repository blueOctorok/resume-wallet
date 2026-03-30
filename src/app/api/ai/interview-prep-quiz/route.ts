import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  checkUsage,
  incrementDailyUsage,
  consumeCredit,
  STORMI_UNLIMITED_WALLETS,
} from '@/lib/ava-usage'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { generateInterviewPrepMcq } from '@/lib/interview-prep-ai'

/**
 * POST /api/ai/interview-prep-quiz
 * One interactive MCQ for Stormi chat (ethical prep). Uses same pool as Stormi chat (10 free/day, then credits).
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.AVA_BRAIN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 503 })
    }

    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 401 })
    }

    const body = await request.json()
    const focus = typeof body.focus === 'string' ? body.focus.trim() : ''

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const isUnlimited = STORMI_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))
    const usage = await getOrCreateUsage(supabase, user.id)
    const check = checkUsage(usage)

    if (!isUnlimited && !check.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message:
            'You have used your free Stormi messages for today. Purchase credits to keep going, or try again tomorrow.',
          dailyRemaining: 0,
          credits: usage.credits,
        },
        { status: 402 },
      )
    }

    const brief = await buildJobMatchCandidateBrief(supabase, user.id)
    const model = isUnlimited ? 'sonnet' : check.model
    const payload = await generateInterviewPrepMcq({
      candidateBrief: brief,
      focus: focus || undefined,
      model,
    })

    if (!isUnlimited) {
      if (check.usingCredits) {
        await consumeCredit(supabase, user.id)
      } else {
        await incrementDailyUsage(supabase, user.id)
      }
    }

    const updated = await getOrCreateUsage(supabase, user.id)
    const dailyRemaining = isUnlimited
      ? 999
      : Math.max(0, 10 - updated.dailyUsed)

    return NextResponse.json({
      success: true,
      interviewPrep: payload,
      usage: {
        dailyRemaining,
        credits: updated.credits,
        usedCredits: !isUnlimited && check.usingCredits,
      },
    })
  } catch (e) {
    console.error('[INTERVIEW PREP QUIZ]', e)
    return NextResponse.json({ error: 'Failed to generate practice question' }, { status: 500 })
  }
}
