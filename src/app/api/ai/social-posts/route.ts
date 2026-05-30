import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { buildJobMatchCandidateBrief } from '@/lib/job-match-candidate-brief'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'

const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })

const SYSTEM_PROMPT = `You write short, punchy social media posts for job candidates sharing their verified Career Card on Storm.

Rules:
- Return EXACTLY 3 posts, separated by the delimiter ---POST---
- Each post is 2-4 short paragraphs — concise, no filler
- Include the card link (provided) naturally in each post — not as the first line
- End each post with a CTA driving viewers to create their own: "Create yours free → https://stormchain.ai" or a natural variation
- Tone: confident, authentic, slightly provocative (challenge the status quo of resumes). Never cringy or corporate
- DO NOT use emojis
- DO NOT wrap posts in quotes or labels like "Post 1:"
- Personalize based on the candidate brief — mention their role, industry, or standout credential if available
- If you have very little candidate info, write compelling generic posts about verified credentials vs traditional resumes`

/**
 * POST /api/ai/social-posts
 *
 * Generates 3 Stormi-written social posts personalized to the candidate.
 * Uses Haiku (cheap + fast) — no credit cost, no daily limit.
 * Body: { cardUrl: string }
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
    const cardUrl = typeof body.cardUrl === 'string' ? body.cardUrl.trim() : ''
    if (!cardUrl) {
      return NextResponse.json({ error: 'cardUrl is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const brief = await buildJobMatchCandidateBrief(supabase, userId)

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL_HAIKU,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Candidate brief:\n${brief || 'No profile data yet — write compelling generic posts.'}\n\nCard link: ${cardUrl}`,
        },
      ],
    })

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    const posts = text
      .split('---POST---')
      .map((p) => p.trim())
      .filter((p) => p.length > 20)

    if (posts.length === 0) {
      return NextResponse.json({ error: 'Failed to generate posts' }, { status: 500 })
    }

    return NextResponse.json({ posts })
  } catch (err) {
    console.error('[social-posts]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
