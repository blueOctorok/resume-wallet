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
  AVA_UNLIMITED_WALLETS,
} from '@/lib/ava-usage'
import { normalizeWalletAddress } from '@/lib/user-by-wallet'

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
    if (!process.env.AVA_BRAIN) {
      console.error('[AvA Chat] AVA_BRAIN (Anthropic API key) is not set')
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 503 }
      )
    }

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
    let supabase
    try {
      supabase = await getAdminSupabaseClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AvA Chat] Supabase init failed:', msg)
      return NextResponse.json(
        { error: 'Service temporarily unavailable.' },
        { status: 503 }
      )
    }
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Connect your wallet first.' },
        { status: 401 }
      )
    }

    // Whitelisted wallets skip usage limits entirely (always Sonnet)
    const isUnlimited = AVA_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))

    let usageCheck: ReturnType<typeof checkUsage> | null = null

    if (!isUnlimited) {
      const usage = await getOrCreateUsage(supabase, user.id)
      usageCheck = checkUsage(usage)

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
    }

    // Unlimited wallets always get Sonnet
    const model = isUnlimited
      ? MODEL_SONNET
      : usageCheck!.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

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

    // Record usage AFTER successful response (skip for unlimited)
    if (!isUnlimited && usageCheck) {
      if (usageCheck.usingCredits) {
        await consumeCredit(supabase, user.id)
      } else {
        await incrementDailyUsage(supabase, user.id)
      }
    }

    // Return usage info (unlimited wallets show effectively infinite)
    if (isUnlimited) {
      return NextResponse.json({
        success: true,
        reply,
        usage: {
          dailyRemaining: 999,
          credits: 0,
          totalMessages: 0,
          model: 'sonnet',
        },
      })
    }

    const updatedUsage = await getOrCreateUsage(supabase, user.id)
    const updatedCheck = checkUsage(updatedUsage)

    return NextResponse.json({
      success: true,
      reply,
      usage: {
        dailyRemaining: updatedCheck.dailyRemaining,
        credits: updatedCheck.credits,
        totalMessages: updatedCheck.totalMessages,
        model: usageCheck!.model,
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

    const message = error instanceof Error ? error.message : String(error)
    console.error('[AvA Chat] Unexpected error:', message)
    if (error instanceof Error && error.stack) {
      console.error('[AvA Chat] Stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
