import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { searchAdzunaJobsServer } from '@/lib/adzuna-server'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { scoreJobsForCandidate } from '@/lib/job-match-ai'
import { createNotification } from '@/lib/create-notification'
import {
  fetchActiveJobAlertPrefsForCron,
  getSentExternalJobIds,
  insertJobAlertSent,
  touchJobAlertLastScan,
} from '@/lib/job-alert-data'
import type { AdzunaJobNormalized } from '@/lib/adzuna-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_PREFS = 28
/** Cap AI batch size and notifications per preference per run (cost + inbox noise). */
const MAX_JOBS_TO_SCORE = 12
const MAX_NOTIFS_PER_PREF = 3

function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) {
    console.error('[CRON JOB-ALERTS] Set CRON_SECRET or INTERNAL_API_SECRET')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  const headerSecret = request.headers.get('x-internal-secret')
  if (bearer === secret || headerSecret === secret) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function passesSalaryFilter(job: AdzunaJobNormalized, salaryMinPref: number | null): boolean {
  if (salaryMinPref == null || salaryMinPref <= 0) return true
  const jmax = job.salary_max ?? job.salary_min
  const jmin = job.salary_min ?? job.salary_max
  if (jmax == null && jmin == null) return true
  const best = jmax ?? jmin ?? 0
  return best >= salaryMinPref
}

/**
 * GET or POST — Vercel Cron uses GET. Allow POST for manual triggers with the same auth.
 */
export async function GET(request: NextRequest) {
  return runJobAlertsCron(request)
}

export async function POST(request: NextRequest) {
  return runJobAlertsCron(request)
}

async function runJobAlertsCron(request: NextRequest) {
  const denied = authorizeCron(request)
  if (denied) return denied

  if (!process.env.AVA_BRAIN) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    return NextResponse.json({ error: 'Adzuna not configured' }, { status: 503 })
  }

  let adzunaOk = true
  try {
    const supabase = await getAdminSupabaseClient()
    const prefs = await fetchActiveJobAlertPrefsForCron(supabase, BATCH_PREFS)

    const sentCache = new Map<string, Set<string>>()
    const briefCache = new Map<string, string>()

    async function sentSetFor(userId: string): Promise<Set<string>> {
      let s = sentCache.get(userId)
      if (!s) {
        s = await getSentExternalJobIds(supabase, userId)
        sentCache.set(userId, s)
      }
      return s
    }

    async function briefFor(userId: string): Promise<string> {
      let b = briefCache.get(userId)
      if (b === undefined) {
        b = await buildJobMatchCandidateBrief(supabase, userId)
        briefCache.set(userId, b)
      }
      return b
    }

    let notificationsCreated = 0
    let prefsProcessed = 0
    let errors = 0

    for (const pref of prefs) {
      prefsProcessed += 1
      const userId = pref.user_id
      try {
        const { results } = await searchAdzunaJobsServer({
          keywords: pref.keywords || 'jobs',
          location: pref.location?.trim() || undefined,
          page: 1,
          resultsPerPage: 20,
          sortBy: 'date',
        })

        const sent = await sentSetFor(userId)
        const fresh = results
          .filter((j) => passesSalaryFilter(j, pref.salary_min))
          .filter((j) => !sent.has(String(j.id)))
          .slice(0, MAX_JOBS_TO_SCORE)

        await touchJobAlertLastScan(supabase, pref.id)

        if (fresh.length === 0) continue

        const candidateBrief = await briefFor(userId)
        const scored = await scoreJobsForCandidate({
          candidateBrief,
          jobs: fresh,
          model: 'haiku',
        })

        const minScore = pref.min_match_score ?? 72
        const winners = scored
          .filter((s) => s.score >= minScore)
          .slice(0, MAX_NOTIFS_PER_PREF)

        for (const s of winners) {
          const job = fresh.find((j) => String(j.id) === s.id)
          if (!job) continue

          const externalJobId = String(job.id)
          if (sent.has(externalJobId)) continue

          const title =
            s.score >= 88 ? `Strong match: ${job.title}` : `Job alert: ${job.title}`
          const body = `${job.company} — ${s.reason}`

          await createNotification({
            userId,
            type: 'job_match',
            title: title.slice(0, 120),
            body: body.slice(0, 280),
            data: {
              externalJobId,
              redirectUrl: job.redirect_url,
              matchScore: s.score,
              preferenceId: pref.id,
              title: job.title,
              company: job.company,
            },
            actionUrl: '/?onboard=jobs',
          })

          try {
            const recorded = await insertJobAlertSent(supabase, userId, externalJobId)
            if (recorded) sent.add(externalJobId)
          } catch (insErr) {
            console.error('[CRON JOB-ALERTS] job_alert_sent insert:', insErr)
          }
          notificationsCreated += 1
        }
      } catch (e) {
        errors += 1
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('ADZUNA_NOT_CONFIGURED') || msg.includes('Adzuna')) {
          adzunaOk = false
        }
        console.error(`[CRON JOB-ALERTS] pref ${pref.id}:`, msg)
        await touchJobAlertLastScan(supabase, pref.id)
      }
    }

    return NextResponse.json({
      ok: true,
      prefsProcessed,
      notificationsCreated,
      errors,
      adzunaConfigured: adzunaOk,
    })
  } catch (e) {
    console.error('[CRON JOB-ALERTS]', e)
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
