import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'
import {
  buildDqCoachSnapshot,
  dqCoachSystemPrompt,
  heuristicDqReview,
  parseDqCoachReview,
} from '@/lib/dq-coach'

/**
 * POST /api/ai/dq-review
 *
 * One-shot file watch over the driver's DQ + blocks. Not a chat turn.
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
    const fallback = heuristicDqReview(snapshot)

    if (!process.env.AVA_BRAIN) {
      console.warn('[DQ REVIEW] AVA_BRAIN missing — heuristic review')
      return NextResponse.json({ review: fallback, source: 'heuristic' })
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL_HAIKU,
        max_tokens: 1400,
        system: dqCoachSystemPrompt(snapshot),
        messages: [{ role: 'user', content: 'Review this DQ file. JSON only.' }],
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      return NextResponse.json({
        review: parseDqCoachReview(text, fallback),
        source: 'anthropic',
      })
    } catch (err) {
      console.error('[DQ REVIEW] Anthropic failed — heuristic floor:', err)
      return NextResponse.json({ review: fallback, source: 'heuristic' })
    }
  } catch (err) {
    console.error('[DQ REVIEW]', err)
    return NextResponse.json({ error: 'Could not review your DQ file' }, { status: 500 })
  }
}
