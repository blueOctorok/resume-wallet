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
} from '@/lib/dq-coach'

/**
 * POST /api/ai/dq-review
 *
 * One-shot file watch. Haiku 4.5 rewrites the heuristic floor into clerk copy.
 * Same snapshot hash as last time → return the cached brief (no Anthropic).
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
    if (cached && cached.snapshotHash === snapshotHash) {
      return NextResponse.json({ review: cached.review, source: 'cache' })
    }

    const fallback = heuristicDqReview(snapshot)

    if (!process.env.AVA_BRAIN) {
      console.warn('[DQ REVIEW] AVA_BRAIN missing — heuristic review')
      await saveDqCoachCache(supabase, userId, snapshotHash, fallback)
      return NextResponse.json({ review: fallback, source: 'heuristic' })
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL_HAIKU,
        max_tokens: 600,
        system: dqCoachSystemPrompt(snapshot),
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

      const review = parseDqCoachReview(text, fallback)
      await saveDqCoachCache(supabase, userId, snapshotHash, review)
      return NextResponse.json({ review, source: 'anthropic' })
    } catch (err) {
      console.error('[DQ REVIEW] Anthropic failed — heuristic floor:', err)
      await saveDqCoachCache(supabase, userId, snapshotHash, fallback)
      return NextResponse.json({ review: fallback, source: 'heuristic' })
    }
  } catch (err) {
    console.error('[DQ REVIEW]', err)
    return NextResponse.json({ error: 'Could not review your DQ file' }, { status: 500 })
  }
}
