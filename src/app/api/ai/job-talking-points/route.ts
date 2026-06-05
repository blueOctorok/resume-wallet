import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { normalizeWalletAddress } from '@/lib/user-by-wallet'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getOrCreateUsage,
  checkCoverLetterUsage,
  incrementCoverLetterDaily,
  consumeCredit,
  STORMI_UNLIMITED_WALLETS,
  getCoverLetterDailyRemaining,
} from '@/lib/ava-usage'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { generateJobTalkingPoints } from '@/lib/job-talking-points-ai'
import { stripHtmlToText } from '@/lib/cover-letter-ai'

/**
 * POST /api/ai/job-talking-points
 * Honest bullets for a target role — same usage pool as cover letters (3× Sonnet/day + credits).
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.AVA_BRAIN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 503 })
    }

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const jobTitle = typeof body.jobTitle === 'string' ? body.jobTitle.trim() : ''
    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // STORMI_UNLIMITED_WALLETS is a legacy wallet allowlist with no session
    // equivalent — read the header directly. Removed at the wallet cutover.
    const sessionUserId = request.headers.get('x-wallet-address')
    const isUnlimited = sessionUserId
      ? STORMI_UNLIMITED_WALLETS.has(normalizeWalletAddress(sessionUserId))
      : false
    const usage = await getOrCreateUsage(supabase, userId)
    const check = checkCoverLetterUsage(usage, isUnlimited)

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message:
            'You have used your free AI career assists for today. Purchase Stormi credits or try again tomorrow.',
          coverLettersDailyRemaining: 0,
          credits: usage.credits,
        },
        { status: 402 },
      )
    }

    const brief = await buildJobMatchCandidateBrief(supabase, userId)
    const text = await generateJobTalkingPoints({
      candidateBrief: brief,
      jobTitle,
      company,
      jobDescriptionExcerpt: description ? stripHtmlToText(description, 2000) : undefined,
      model: check.model,
    })

    if (!isUnlimited) {
      if (check.usingCredits) {
        await consumeCredit(supabase, userId)
      } else {
        await incrementCoverLetterDaily(supabase, userId)
      }
    }

    const updated = await getOrCreateUsage(supabase, userId)

    return NextResponse.json({
      success: true,
      talkingPoints: text,
      usage: {
        coverLettersDailyRemaining: getCoverLetterDailyRemaining(updated),
        credits: updated.credits,
        usedCredits: check.usingCredits,
      },
    })
  } catch (e) {
    console.error('[JOB TALKING POINTS]', e)
    return NextResponse.json({ error: 'Failed to generate talking points' }, { status: 500 })
  }
}
