import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  incrementJobMatchAiDaily,
  consumeCredit,
  saveJobMatchCache,
  AVA_UNLIMITED_WALLETS,
  AVA_JOB_MATCH_FREE_DAILY,
} from '@/lib/ava-usage'
import { searchAdzunaJobsServer } from '@/lib/adzuna-server'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { scoreJobsForCandidate } from '@/lib/job-match-ai'

const CACHE_VERSION = 1

type CachedPayload = {
  version: number
  keywords: string
  jobs: Array<
    Record<string, unknown> & {
      matchScore: number
      matchReason: string
    }
  >
  generatedAt: string
}

function parseCache(raw: unknown): CachedPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as CachedPayload
  if (o.version !== CACHE_VERSION || !Array.isArray(o.jobs)) return null
  return o
}

/**
 * GET /api/jobs/recommended
 * Personalized external jobs (Adzuna) scored by AvA. One free AI run per UTC day; same-day revisits use cache.
 * ?force=1 — new scoring run, costs 1 credit (unless unlimited wallet).
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.AVA_BRAIN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 503 })
    }

    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 401 })
    }

    const force = request.nextUrl.searchParams.get('force') === '1'
    const location = request.nextUrl.searchParams.get('location')?.trim() ?? ''

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const isUnlimited = AVA_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))
    let usage = await getOrCreateUsage(supabase, user.id)

    if (!force) {
      const cached = parseCache(usage.jobMatchCache)
      if (cached) {
        return NextResponse.json({
          success: true,
          source: 'cache',
          keywords: cached.keywords,
          jobs: cached.jobs,
          generatedAt: cached.generatedAt,
          credits: usage.credits,
          jobMatchFreeRemainingToday: Math.max(0, AVA_JOB_MATCH_FREE_DAILY - usage.jobMatchAiDailyUsed),
        })
      }
    }

    // Need a fresh Adzuna + AI pass
    if (!isUnlimited) {
      if (force) {
        if (usage.credits < 1) {
          return NextResponse.json(
            {
              error: 'out_of_credits',
              message: 'Refresh costs 1 AvA credit. Purchase credits or try again tomorrow for a free match.',
              credits: 0,
            },
            { status: 402 },
          )
        }
      } else {
        const freeOk = usage.jobMatchAiDailyUsed < AVA_JOB_MATCH_FREE_DAILY
        if (!freeOk && usage.credits < 1) {
          return NextResponse.json(
            {
              error: 'out_of_credits',
              message:
                'Your free job match for today is used. Purchase credits for another run, or come back tomorrow.',
              credits: usage.credits,
            },
            { status: 402 },
          )
        }
      }
    }

    const [{ data: profile }, { data: onboarding }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('headline')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('hub_onboarding').select('occupation').eq('user_id', user.id).maybeSingle(),
    ])

    const kwRaw =
      profile?.headline?.trim() || onboarding?.occupation?.trim() || 'professional jobs'
    const keywords = kwRaw.slice(0, 80)

    let adzuna
    try {
      adzuna = await searchAdzunaJobsServer({
        keywords,
        location: location || undefined,
        page: 1,
        resultsPerPage: 24,
        sortBy: 'date',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'ADZUNA_NOT_CONFIGURED') {
        return NextResponse.json({ error: 'Job search service not configured' }, { status: 500 })
      }
      console.error('[JOB RECOMMENDED] Adzuna', e)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 502 })
    }

    if (adzuna.results.length === 0) {
      return NextResponse.json({
        success: true,
        source: 'empty',
        keywords,
        jobs: [],
        generatedAt: new Date().toISOString(),
        credits: usage.credits,
        jobMatchFreeRemainingToday: Math.max(0, AVA_JOB_MATCH_FREE_DAILY - usage.jobMatchAiDailyUsed),
      })
    }

    const brief = await buildJobMatchCandidateBrief(supabase, user.id)
    let model: 'sonnet' | 'haiku' = 'haiku'
    if (isUnlimited) model = 'sonnet'
    else if (!force && usage.jobMatchAiDailyUsed < AVA_JOB_MATCH_FREE_DAILY) model = 'sonnet'

    let scored: Awaited<ReturnType<typeof scoreJobsForCandidate>>
    try {
      scored = await scoreJobsForCandidate({
        candidateBrief: brief,
        jobs: adzuna.results,
        model,
      })
    } catch (e) {
      console.error('[JOB RECOMMENDED] AI', e)
      return NextResponse.json({ error: 'Failed to score jobs' }, { status: 500 })
    }

    const scoreById = new Map(scored.map((s) => [s.id, s]))
    const enriched = adzuna.results.map((j) => {
      const id = String(j.id)
      const s = scoreById.get(id) ?? { score: 50, reason: 'Not ranked' }
      return {
        id,
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description,
        salary: j.salary,
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        created: j.created,
        redirect_url: j.redirect_url,
        category: j.category,
        contract_type: j.contract_type,
        is_external: true,
        matchScore: s.score,
        matchReason: s.reason,
      }
    })

    enriched.sort((a, b) => b.matchScore - a.matchScore)
    const top = enriched.slice(0, 12)

    const generatedAt = new Date().toISOString()
    const payload: CachedPayload = {
      version: CACHE_VERSION,
      keywords,
      jobs: top,
      generatedAt,
    }

    await saveJobMatchCache(supabase, user.id, payload)

    if (!isUnlimited) {
      if (force) {
        await consumeCredit(supabase, user.id)
      } else if (usage.jobMatchAiDailyUsed < AVA_JOB_MATCH_FREE_DAILY) {
        await incrementJobMatchAiDaily(supabase, user.id)
      } else {
        await consumeCredit(supabase, user.id)
      }
    }

    usage = await getOrCreateUsage(supabase, user.id)

    return NextResponse.json({
      success: true,
      source: force ? 'refresh' : 'fresh',
      keywords,
      jobs: top,
      generatedAt,
      credits: usage.credits,
      jobMatchFreeRemainingToday: Math.max(0, AVA_JOB_MATCH_FREE_DAILY - usage.jobMatchAiDailyUsed),
    })
  } catch (e) {
    console.error('[JOB RECOMMENDED]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
