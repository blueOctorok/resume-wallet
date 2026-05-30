import { NextRequest, NextResponse } from 'next/server'
// pdf-parse ships as CJS; require keeps Next.js node route happy
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { normalizeWalletAddress } from '@/lib/user-by-wallet'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getOrCreateUsage,
  checkResumeParseUsage,
  incrementResumeParseDaily,
  consumeCredit,
  STORMI_UNLIMITED_WALLETS,
  getResumeParseDailyRemaining,
} from '@/lib/ava-usage'
import { extractResumeWithAi } from '@/lib/resume-parse-ai'

export const runtime = 'nodejs'

/**
 * POST /api/ai/parse-resume
 * Body: { resumeId: string }
 * Fetches uploaded PDF from IPFS, extracts text, runs Claude → structured JSON.
 * Quota: 1 free/day (Sonnet), then 1 credit → Haiku (same as cover letters).
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
    const resumeId = typeof body.resumeId === 'string' ? body.resumeId.trim() : ''
    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: resume, error: resErr } = await supabase
      .from('resumes')
      .select('id, user_id, ipfs_url, mime_type, title')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .maybeSingle()

    if (resErr || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (!resume.ipfs_url || !String(resume.mime_type || '').includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF resumes uploaded to IPFS can be parsed' },
        { status: 400 },
      )
    }

    // STORMI_UNLIMITED_WALLETS is a legacy wallet allowlist with no session
    // equivalent — read the header directly. Removed at the wallet cutover.
    const walletAddress = request.headers.get('x-wallet-address')
    const isUnlimited = walletAddress
      ? STORMI_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))
      : false
    const usage = await getOrCreateUsage(supabase, userId)
    const check = checkResumeParseUsage(usage, isUnlimited)

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message:
            'You have used your free resume parse for today. Purchase Stormi credits to parse more, or try again tomorrow.',
          resumeParseDailyRemaining: 0,
          credits: usage.credits,
        },
        { status: 402 },
      )
    }

    let pdfBuffer: ArrayBuffer
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 60_000)
      const res = await fetch(resume.ipfs_url, { signal: ac.signal })
      clearTimeout(t)
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch resume from IPFS' }, { status: 502 })
      }
      pdfBuffer = await res.arrayBuffer()
    } catch (e) {
      console.error('[PARSE RESUME] IPFS fetch', e)
      return NextResponse.json({ error: 'Failed to download resume file' }, { status: 502 })
    }

    const parsedPdf = await pdfParse(Buffer.from(pdfBuffer))
    const text = (parsedPdf.text || '').trim()
    if (text.length < 40) {
      return NextResponse.json(
        { error: 'Could not extract enough text from this PDF. Try a text-based PDF.' },
        { status: 422 },
      )
    }

    const extraction = await extractResumeWithAi({ resumeText: text, model: check.model })

    if (!isUnlimited) {
      if (check.usingCredits) {
        await consumeCredit(supabase, userId)
      } else {
        await incrementResumeParseDaily(supabase, userId)
      }
    }

    const updatedUsage = await getOrCreateUsage(supabase, user.id)

    return NextResponse.json({
      success: true,
      extraction,
      resumeId: resume.id,
      title: resume.title,
      usage: {
        resumeParseDailyRemaining: getResumeParseDailyRemaining(updatedUsage),
        credits: updatedUsage.credits,
        usedCredits: check.usingCredits,
      },
    })
  } catch (e) {
    console.error('[PARSE RESUME]', e)
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 })
  }
}
