/**
 * Stormi candidate chat: tools to search/score external jobs and save job alerts.
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { searchAdzunaJobsServer } from '@/lib/adzuna-server'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { scoreJobsForCandidate } from '@/lib/job-match-ai'
import {
  countJobAlertPreferences,
  createJobAlertPreference,
  getMaxJobAlertsForUser,
} from '@/lib/job-alert-data'
import type { StormiJobSuggestion } from '@/lib/ava-job-suggestions'

export const STORMI_JOB_CHAT_TOOLS = [
  {
    name: 'suggest_alternate_jobs',
    description:
      'Use when requirements coverage for the user\'s *current* guided-mode job is low (<40%) or they are clearly a poor fit. Searches external boards and returns a small set of **better-fit** listings ranked against their profile. At most one call per user message. Prefer broader or adjacent keywords than the weak-fit posting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'string',
          description: 'Search query tuned for *better* matches — e.g. broader role family, adjacent title, or same skills in a less strict niche.',
        },
        location: {
          type: 'string',
          description: 'Optional: same as user region or "remote".',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'search_ranked_jobs',
    description:
      'Search external job boards (Adzuna) and rank results against this user\'s ZKnight profile (skills, blocks, headline, etc.). Use when they want to find jobs, see openings, explore roles, or ask what might fit them. If keywords are vague, infer reasonable search terms from their occupation and blocks. At most one call per user message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'string',
          description: 'Adzuna search query, e.g. "Class A truck driver", "React developer remote".',
        },
        location: {
          type: 'string',
          description: 'Optional: city/state, region, or "remote".',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'save_job_alert',
    description:
      'Create a daily email-style in-app job alert: ZKnight will scan for new listings on a schedule and notify when the assistant scores a strong match. Use when the user wants ongoing monitoring, alerts, or to "watch" a search. Respect limits (2 alerts free, 5 with AI credits). At most one save per user message unless they explicitly ask for two different alerts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: { type: 'string', description: 'Search terms for the alert.' },
        location: { type: 'string', description: 'Optional geographic filter.' },
        label: { type: 'string', description: 'Optional short label shown in the hub.' },
        min_match_score: {
          type: 'number',
          description: 'Minimum fit score 50–95. Default 72 if omitted.',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'update_application_status',
    description:
      'Record the candidate\'s self-reported outcome for a past application. Use when the user tells you they heard back (interview, rejection, offer) or when they say nothing happened yet. If they mention a specific company or job title, match it to an application and update it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        application_id: {
          type: 'string',
          description: 'The application UUID. Required.',
        },
        candidate_status: {
          type: 'string',
          enum: ['waiting', 'interview', 'rejected', 'offer', 'no_response'],
          description: 'The outcome: waiting, interview, rejected, offer, or no_response.',
        },
      },
      required: ['application_id', 'candidate_status'],
    },
  },
]

export interface StormiJobToolContext {
  supabase: SupabaseClient
  userId: string
  /**
   * When the model omits keywords on `suggest_alternate_jobs`, fall back to
   * these (e.g. job title + location from Guided mode).
   */
  simpleModeAlternateDefaults?: { keywords: string; location?: string } | null
}

function clampStr(s: string, max: number): string {
  return s.trim().slice(0, max)
}

/**
 * Returns Anthropic tool_result content (string) and optional structured jobs for the API response.
 */
export async function executeStormiJobChatTool(params: {
  name: string
  input: unknown
  ctx: StormiJobToolContext
  flags: { searchUsed: boolean; saveAlertUsed: boolean; alternateUsed: boolean }
}): Promise<{ toolResult: string; jobSuggestions?: StormiJobSuggestion[] }> {
  const { name, input, ctx, flags } = params

  if (name === 'suggest_alternate_jobs') {
    if (flags.alternateUsed) {
      return {
        toolResult: JSON.stringify({
          ok: false,
          error: 'Only one suggest_alternate_jobs call per message.',
        }),
      }
    }
    flags.alternateUsed = true

    const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    let keywords = clampStr(String(obj.keywords ?? ''), 280)
    const locationRaw =
      obj.location != null
        ? clampStr(String(obj.location), 120)
        : ctx.simpleModeAlternateDefaults?.location ?? ''

    if (!keywords && ctx.simpleModeAlternateDefaults?.keywords) {
      keywords = clampStr(ctx.simpleModeAlternateDefaults.keywords, 280)
    }
    if (!keywords) {
      return { toolResult: JSON.stringify({ ok: false, error: 'keywords required' }) }
    }

    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      return {
        toolResult: JSON.stringify({ ok: false, error: 'External job search is not configured.' }),
      }
    }
    if (!process.env.AVA_BRAIN) {
      return { toolResult: JSON.stringify({ ok: false, error: 'AI ranking is not configured.' }) }
    }

    try {
      const { results } = await searchAdzunaJobsServer({
        keywords: keywords || 'jobs',
        location: locationRaw || undefined,
        page: 1,
        resultsPerPage: 12,
        sortBy: 'date',
      })
      if (results.length === 0) {
        return {
          toolResult: JSON.stringify({
            ok: true,
            jobs: [],
            message: 'No alternate listings found — try widening keywords or location.',
          }),
        }
      }

      const toScore = results.slice(0, 10)
      const brief = await buildJobMatchCandidateBrief(ctx.supabase, ctx.userId)
      const scored = await scoreJobsForCandidate({
        candidateBrief: brief,
        jobs: toScore,
        model: 'sonnet',
      })

      const byId = new Map(scored.map((s) => [s.id, s]))
      const merged: StormiJobSuggestion[] = []
      for (const j of toScore) {
        const sid = String(j.id)
        const s = byId.get(sid)
        if (!s) continue
        merged.push({
          id: sid,
          title: j.title,
          company: j.company,
          location: j.location,
          score: s.score,
          reason: s.reason,
          redirectUrl: j.redirect_url,
          salary: j.salary,
        })
      }
      merged.sort((a, b) => b.score - a.score)
      const top = merged.slice(0, 3)

      return {
        toolResult: JSON.stringify({
          ok: true,
          jobs: top.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            score: j.score,
            reason: j.reason,
            has_apply_url: Boolean(j.redirectUrl),
          })),
          message: 'Top 3 better-fit external listings for this candidate.',
        }),
        jobSuggestions: top,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi job tool] suggest_alternate_jobs:', msg)
      return { toolResult: JSON.stringify({ ok: false, error: 'Alternate search failed.' }) }
    }
  }

  if (name === 'search_ranked_jobs') {
    if (flags.searchUsed) {
      return {
        toolResult: JSON.stringify({
          ok: false,
          error: 'Only one search_ranked_jobs call per message. Use the jobs already returned.',
        }),
      }
    }
    flags.searchUsed = true

    const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    const keywords = clampStr(String(obj.keywords ?? ''), 280)
    const locationRaw = obj.location != null ? clampStr(String(obj.location), 120) : ''
    if (!keywords) {
      return { toolResult: JSON.stringify({ ok: false, error: 'keywords required' }) }
    }

    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      return {
        toolResult: JSON.stringify({
          ok: false,
          error: 'External job search is not configured.',
        }),
      }
    }
    if (!process.env.AVA_BRAIN) {
      return { toolResult: JSON.stringify({ ok: false, error: 'AI ranking is not configured.' }) }
    }

    try {
      const { results } = await searchAdzunaJobsServer({
        keywords: keywords || 'jobs',
        location: locationRaw || undefined,
        page: 1,
        resultsPerPage: 18,
        sortBy: 'date',
      })

      if (results.length === 0) {
        return {
          toolResult: JSON.stringify({
            ok: true,
            jobs: [],
            message: 'No listings returned for this query. Try broader keywords or another location.',
          }),
        }
      }

      const toScore = results.slice(0, 14)
      const brief = await buildJobMatchCandidateBrief(ctx.supabase, ctx.userId)
      // Sonnet for interactive chat matching — stronger fit vs profile than Haiku (cron/bulk stays Haiku).
      const scored = await scoreJobsForCandidate({
        candidateBrief: brief,
        jobs: toScore,
        model: 'sonnet',
      })

      const byId = new Map(scored.map((s) => [s.id, s]))
      const merged: StormiJobSuggestion[] = []
      for (const j of toScore) {
        const sid = String(j.id)
        const s = byId.get(sid)
        if (!s) continue
        merged.push({
          id: sid,
          title: j.title,
          company: j.company,
          location: j.location,
          score: s.score,
          reason: s.reason,
          redirectUrl: j.redirect_url,
          salary: j.salary,
        })
      }
      merged.sort((a, b) => b.score - a.score)
      const top = merged.slice(0, 8)

      return {
        toolResult: JSON.stringify({
          ok: true,
          jobs: top.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            score: j.score,
            reason: j.reason,
            has_apply_url: Boolean(j.redirectUrl),
          })),
        }),
        jobSuggestions: top,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi job tool] search_ranked_jobs:', msg)
      return { toolResult: JSON.stringify({ ok: false, error: 'Search failed. Try again in a moment.' }) }
    }
  }

  if (name === 'save_job_alert') {
    if (flags.saveAlertUsed) {
      return {
        toolResult: JSON.stringify({
          ok: false,
          error: 'Only one new alert per message. The user can add another from the hub.',
        }),
      }
    }
    flags.saveAlertUsed = true

    const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    const keywords = clampStr(String(obj.keywords ?? ''), 280)
    const location = obj.location != null ? clampStr(String(obj.location), 120) : null
    const label = obj.label != null ? clampStr(String(obj.label), 120) : null
    let min_match_score = 72
    if (typeof obj.min_match_score === 'number' && Number.isFinite(obj.min_match_score)) {
      min_match_score = Math.min(95, Math.max(50, Math.round(obj.min_match_score)))
    }

    if (!keywords) {
      return { toolResult: JSON.stringify({ ok: false, error: 'keywords required' }) }
    }

    try {
      const [maxAlerts, currentCount] = await Promise.all([
        getMaxJobAlertsForUser(ctx.supabase, ctx.userId),
        countJobAlertPreferences(ctx.supabase, ctx.userId),
      ])
      if (currentCount >= maxAlerts) {
        return {
          toolResult: JSON.stringify({
            ok: false,
            error: `At the ${maxAlerts} alert limit. They can remove one on the hub or add AI credits for more.`,
          }),
        }
      }

      const pref = await createJobAlertPreference(ctx.supabase, ctx.userId, {
        label,
        keywords,
        location,
        min_match_score,
        is_active: true,
      })

      return {
        toolResult: JSON.stringify({
          ok: true,
          alertId: pref.id,
          message: 'Alert saved. They will get in-app notifications when strong new matches appear (daily scan).',
        }),
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi job tool] save_job_alert:', msg)
      return { toolResult: JSON.stringify({ ok: false, error: 'Could not save alert.' }) }
    }
  }

  if (name === 'update_application_status') {
    const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    const applicationId = typeof obj.application_id === 'string' ? obj.application_id.trim() : ''
    const candidateStatus = typeof obj.candidate_status === 'string' ? obj.candidate_status.trim() : ''

    const validStatuses = ['waiting', 'interview', 'rejected', 'offer', 'no_response']
    if (!applicationId || !validStatuses.includes(candidateStatus)) {
      return { toolResult: JSON.stringify({ ok: false, error: 'application_id and valid candidate_status required.' }) }
    }

    try {
      const { error: updateError } = await ctx.supabase
        .from('applications')
        .update({ candidate_status: candidateStatus })
        .eq('id', applicationId)
        .eq('applicant_user_id', ctx.userId)

      if (updateError) {
        return { toolResult: JSON.stringify({ ok: false, error: 'Could not update — check the application ID.' }) }
      }

      const statusLabels: Record<string, string> = {
        waiting: 'waiting to hear back',
        interview: 'got an interview',
        rejected: 'got a rejection',
        offer: 'received an offer',
        no_response: 'no response yet',
      }

      return {
        toolResult: JSON.stringify({
          ok: true,
          message: `Updated to "${statusLabels[candidateStatus]}". This info helps me coach you better on what's working.`,
        }),
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Stormi job tool] update_application_status:', msg)
      return { toolResult: JSON.stringify({ ok: false, error: 'Status update failed.' }) }
    }
  }

  return { toolResult: JSON.stringify({ ok: false, error: `Unknown tool: ${name}` }) }
}
