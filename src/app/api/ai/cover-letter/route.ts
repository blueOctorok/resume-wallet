import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  checkCoverLetterUsage,
  incrementCoverLetterDaily,
  consumeCredit,
  AVA_UNLIMITED_WALLETS,
  getCoverLetterDailyRemaining,
} from '@/lib/ava-usage'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { generateCoverLetter, stripHtmlToText } from '@/lib/cover-letter-ai'

/**
 * POST /api/ai/cover-letter
 * Body: { jobTitle, company, location?, description? }
 * Uses 3 free generations/day (Sonnet), then 1 purchased credit (Haiku) — same pool as AvA chat.
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
    const jobTitle = typeof body.jobTitle === 'string' ? body.jobTitle.trim() : ''
    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const location = typeof body.location === 'string' ? body.location.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const isUnlimited = AVA_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))
    const usage = await getOrCreateUsage(supabase, user.id)
    const check = checkCoverLetterUsage(usage, isUnlimited)

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message:
            'You have used your free cover letters for today. Purchase AvA credits to generate more, or try again tomorrow.',
          coverLettersDailyRemaining: 0,
          credits: usage.credits,
        },
        { status: 402 },
      )
    }

    const brief = await buildJobMatchCandidateBrief(supabase, user.id)
    const letter = await generateCoverLetter({
      candidateBrief: brief,
      jobTitle,
      company,
      location: location || undefined,
      jobDescription: description ? stripHtmlToText(description, 2000) : undefined,
      model: check.model,
    })

    if (!isUnlimited) {
      if (check.usingCredits) {
        await consumeCredit(supabase, user.id)
      } else {
        await incrementCoverLetterDaily(supabase, user.id)
      }
    }

    const updated = await getOrCreateUsage(supabase, user.id)

    return NextResponse.json({
      success: true,
      coverLetter: letter,
      usage: {
        coverLettersDailyRemaining: getCoverLetterDailyRemaining(updated),
        credits: updated.credits,
        usedCredits: check.usingCredits,
      },
    })
  } catch (e) {
    console.error('[COVER LETTER]', e)
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
  }
}
