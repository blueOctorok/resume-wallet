import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildAvaSystemPrompt } from '@/lib/ava-context'
import type { HubContext, BlockContext } from '@/lib/ava-context'

// claude-sonnet-4-6: best speed/intelligence ratio — ideal for conversational AvA
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

const anthropic = new Anthropic({
  apiKey: process.env.AVA_BRAIN,
})

/**
 * POST /api/ai/chat
 *
 * AvA's conversational endpoint, powered by Claude Sonnet.
 *
 * Body:
 *   message      — the user's message (required)
 *   hubContext   — candidate's hub state for context-aware responses (optional)
 *   blockContext — the specific block the user is asking about (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, hubContext, blockContext } = body as {
      message: string
      hubContext?: HubContext
      blockContext?: BlockContext
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid message' },
        { status: 400 }
      )
    }

    const systemPrompt = buildAvaSystemPrompt(hubContext, blockContext)

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: message.trim() }],
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return NextResponse.json({ success: true, reply })
  } catch (error) {
    // Anthropic SDK throws typed errors — surface useful detail without leaking internals
    if (error instanceof Anthropic.APIError) {
      console.error('[AvA Chat] Anthropic API error:', error.status, error.message)

      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service authentication failed. Check ANTHROPIC_API_KEY.' },
          { status: 500 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'AI service rate limit reached. Please try again in a moment.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 500 }
      )
    }

    console.error('[AvA Chat] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
