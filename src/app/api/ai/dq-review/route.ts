import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'
import { getDqCoachCache, saveDqCoachCache } from '@/lib/dq-coach-cache'
import { hashDqCoachSnapshot } from '@/lib/dq-coach-hash'
import {
  buildDqCoachSnapshot,
  dqCoachSystemPrompt,
  heuristicDqReview,
  parseDqCoachReview,
  type DqCoachReview,
} from '@/lib/dq-coach'
import {
  buildDqBrief,
  DQ_BRIEF_VERSION,
  dqBriefPrompt,
  dqBriefStage,
  parseDqBriefDraft,
  type DqBriefDraft,
} from '@/lib/dq-coach-brief'

/**
 * POST /api/ai/dq-review
 *
 * One-shot file watch. Haiku 4.5 rewrites the heuristic floor into clerk copy
 * and, in the same reply, writes the bullets for the popup brief.
 * Same snapshot hash as last time → return the cached pair (no Anthropic).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Factory is async — forgetting await gives a Promise, and Promise.from throws 500.
    const supabase = await getAdminSupabaseClient()
    const snapshot = await buildDqCoachSnapshot(supabase, userId)
    const snapshotHash = hashDqCoachSnapshot(snapshot)

    const cached = await getDqCoachCache(supabase, userId)
    // A review cached before the brief existed (or before its last change) is redone once.
    if (
      cached &&
      cached.snapshotHash === snapshotHash &&
      cached.brief?.version === DQ_BRIEF_VERSION
    ) {
      return NextResponse.json({ review: cached.review, brief: cached.brief, source: 'cache' })
    }

    const fallback = heuristicDqReview(snapshot)

    const respond = async (
      review: DqCoachReview,
      draft: DqBriefDraft | null,
      source: 'anthropic' | 'heuristic',
    ) => {
      const brief = buildDqBrief(snapshot, draft)
      await saveDqCoachCache(supabase, userId, snapshotHash, review, brief)
      return NextResponse.json({ review, brief, source })
    }

    if (!process.env.AVA_BRAIN) {
      console.warn('[DQ REVIEW] AVA_BRAIN missing — heuristic review')
      return await respond(fallback, null, 'heuristic')
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL_HAIKU,
        max_tokens: 900,
        system: dqCoachSystemPrompt(snapshot, dqBriefPrompt(snapshot)),
        messages: [
          {
            role: 'user',
            content: 'Review this DQ file for unfinished work and discrepancies. JSON only.',
          },
        ],
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      return await respond(
        parseDqCoachReview(text, fallback),
        parseDqBriefDraft(text, dqBriefStage(snapshot)),
        'anthropic',
      )
    } catch (err) {
      console.error('[DQ REVIEW] Anthropic failed — heuristic floor:', err)
      return await respond(fallback, null, 'heuristic')
    }
  } catch (err) {
    console.error('[DQ REVIEW]', err)
    return NextResponse.json({ error: 'Could not review your DQ file' }, { status: 500 })
  }
}
