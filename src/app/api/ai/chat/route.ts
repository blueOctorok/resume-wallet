import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildAvaSystemPrompt } from '@/lib/ava-context'
import type { HubContext, BlockContext } from '@/lib/ava-context'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  checkUsage,
  incrementDailyUsage,
  consumeCredit,
  AVA_DAILY_FREE,
} from '@/lib/ava-usage'

const MODEL_SONNET = 'claude-sonnet-4-6'
const MODEL_HAIKU = 'claude-haiku-4-5-20250414'
const MAX_TOKENS = 1024

const anthropic = new Anthropic({
  apiKey: process.env.AVA_BRAIN,
})

/**
 * POST /api/ai/chat
 *
 * AvA's conversational endpoint.
 * Free tier (10/day) uses Sonnet 4.6, paid credits use Haiku 4.5.
 * Requires x-wallet-address header for auth + usage tracking.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth gate
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 401 }
      )
    }

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

    // Resolve user
    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Connect your wallet first.' },
        { status: 401 }
      )
    }

    // Check usage quota
    const usage = await getOrCreateUsage(supabase, user.id)
    const usageCheck = checkUsage(usage)

    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message: `You've used your ${AVA_DAILY_FREE} free messages today. Purchase credits to keep chatting, or come back tomorrow.`,
          usage: {
            dailyRemaining: 0,
            credits: 0,
            totalMessages: usageCheck.totalMessages,
            model: null,
          },
        },
        { status: 402 }
      )
    }

    // Select model based on tier
    const model = usageCheck.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

    const systemPrompt = buildAvaSystemPrompt(hubContext, blockContext)

    const response = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: message.trim() }],
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // Record usage AFTER successful response
    if (usageCheck.usingCredits) {
      await consumeCredit(supabase, user.id)
    } else {
      await incrementDailyUsage(supabase, user.id)
    }

    // Re-read for accurate post-send numbers
    const updatedUsage = await getOrCreateUsage(supabase, user.id)
    const updatedCheck = checkUsage(updatedUsage)

    return NextResponse.json({
      success: true,
      reply,
      usage: {
        dailyRemaining: updatedCheck.dailyRemaining,
        credits: updatedCheck.credits,
        totalMessages: updatedCheck.totalMessages,
        model: usageCheck.model,
      },
    })
  } catch (error) {
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
