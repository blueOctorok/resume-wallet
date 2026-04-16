import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildStormiSystemPrompt, buildEmployerStormiSystemPrompt } from '@/lib/ava-context'
import type { HubContext, BlockContext, EmployerHubContext } from '@/lib/ava-context'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import {
  getOrCreateUsage,
  checkUsage,
  incrementDailyUsage,
  consumeCredit,
  STORMI_DAILY_FREE,
  STORMI_UNLIMITED_WALLETS,
} from '@/lib/ava-usage'
import { normalizeWalletAddress } from '@/lib/user-by-wallet'
import {
  STORMI_DUPLICATE_AUTO_WELCOME_REPLY,
  type StormiAutoWelcomeMode,
  hasCompletedStormiAutoWelcome,
  markStormiAutoWelcomeComplete,
} from '@/lib/ava-auto-welcome'
import { buildAnthropicMessagesFromHistory } from '@/lib/ava-conversation'
import { runCandidateStormiChatWithJobTools } from '@/lib/ava-candidate-chat-with-tools'
import type { StormiJobSuggestion } from '@/lib/ava-job-suggestions'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU
const MAX_TOKENS = 1024

const anthropic = new Anthropic({
  apiKey: process.env.AVA_BRAIN,
})

/**
 * POST /api/ai/chat
 *
 * Stormi's conversational endpoint.
 * Free tier (10/day) uses Sonnet 4.6, paid credits use Haiku 4.5.
 * Requires x-wallet-address header for auth + usage tracking.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.AVA_BRAIN) {
      console.error('[Stormi Chat] AVA_BRAIN (Anthropic API key) is not set')
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
    const { message, hubContext, blockContext, audience, employerContext, conversationHistory } =
      body as {
        message: string
        hubContext?: HubContext
        blockContext?: BlockContext
        audience?: 'candidate' | 'employer'
        employerContext?: EmployerHubContext
        /** Prior turns only; latest user text is `message`. Ignored when autoWelcome is set. */
        conversationHistory?: unknown
      }
    const rawAutoWelcome = (body as { autoWelcome?: unknown }).autoWelcome
    const autoWelcome: StormiAutoWelcomeMode | undefined =
      rawAutoWelcome === 'candidate' || rawAutoWelcome === 'employer' ? rawAutoWelcome : undefined
    /** Hub walkthrough step 1 — plain completion, no job-search tools (keeps JSON output reliable). */
    const walkthroughWelcome = (body as { walkthroughWelcome?: unknown }).walkthroughWelcome === true

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
      console.error('[Stormi Chat] Supabase init failed:', msg)
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

    const isEmployerChat = audience === 'employer'
    if (isEmployerChat) {
      if (user.role !== 'employer') {
        return NextResponse.json(
          { error: 'Employer Stormi chat is only available for employer accounts.' },
          { status: 403 }
        )
      }
      if (!employerContext || typeof employerContext !== 'object') {
        return NextResponse.json(
          { error: 'Missing or invalid employerContext for employer chat.' },
          { status: 400 }
        )
      }
    }

    if (autoWelcome !== undefined) {
      const expected: StormiAutoWelcomeMode = isEmployerChat ? 'employer' : 'candidate'
      if (autoWelcome !== expected) {
        return NextResponse.json(
          { error: 'autoWelcome does not match chat audience' },
          { status: 400 }
        )
      }
    }

    if (walkthroughWelcome && isEmployerChat) {
      return NextResponse.json(
        { error: 'walkthroughWelcome is only valid for candidate chat.' },
        { status: 400 },
      )
    }

    // Whitelisted wallets skip usage limits entirely (always Sonnet)
    const isUnlimited = STORMI_UNLIMITED_WALLETS.has(normalizeWalletAddress(walletAddress))

    // Auto-welcome idempotency (DB) — no Anthropic call, no usage charge
    if (autoWelcome) {
      const alreadyDone = await hasCompletedStormiAutoWelcome(supabase, user.id, autoWelcome)
      if (alreadyDone) {
        if (isUnlimited) {
          return NextResponse.json({
            success: true,
            reply: STORMI_DUPLICATE_AUTO_WELCOME_REPLY,
            duplicateAutoWelcome: true,
            usage: {
              dailyRemaining: 999,
              credits: 0,
              totalMessages: 0,
              model: 'sonnet',
            },
          })
        }
        const usageRow = await getOrCreateUsage(supabase, user.id)
        const dupCheck = checkUsage(usageRow)
        return NextResponse.json({
          success: true,
          reply: STORMI_DUPLICATE_AUTO_WELCOME_REPLY,
          duplicateAutoWelcome: true,
          usage: {
            dailyRemaining: dupCheck.dailyRemaining,
            credits: dupCheck.credits,
            totalMessages: dupCheck.totalMessages,
            model: dupCheck.allowed ? dupCheck.model : null,
          },
        })
      }
    }

    let usageCheck: ReturnType<typeof checkUsage> | null = null

    if (!isUnlimited) {
      const usage = await getOrCreateUsage(supabase, user.id)
      usageCheck = checkUsage(usage)

      if (!usageCheck.allowed) {
        // Stop auto-welcome from retrying on every refresh while at 0 quota (same as prior localStorage behavior)
        if (autoWelcome) {
          await markStormiAutoWelcomeComplete(supabase, user.id, autoWelcome)
        }
        return NextResponse.json(
          {
            error: 'out_of_credits',
            message: `You've used your ${STORMI_DAILY_FREE} free messages today. Purchase credits to keep chatting, or come back tomorrow.`,
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

    const systemPrompt = isEmployerChat
      ? buildEmployerStormiSystemPrompt(employerContext!)
      : buildStormiSystemPrompt(hubContext, blockContext)

    const messagesPayload = autoWelcome
      ? [{ role: 'user' as const, content: message.trim() }]
      : buildAnthropicMessagesFromHistory(conversationHistory, message.trim())

    if (messagesPayload.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid message' }, { status: 400 })
    }

    const useJobTools = !isEmployerChat && !autoWelcome && !walkthroughWelcome

    let reply: string
    let jobSuggestions: StormiJobSuggestion[] | undefined

    if (useJobTools) {
      const out = await runCandidateStormiChatWithJobTools({
        anthropic,
        systemPrompt,
        conversationHistory,
        latestUserMessage: message.trim(),
        supabase,
        userId: user.id,
      })
      reply = out.reply
      jobSuggestions = out.jobSuggestions.length ? out.jobSuggestions : undefined
    } else {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messagesPayload,
      })

      reply =
        response.content[0].type === 'text'
          ? response.content[0].text
          : ''
    }

    // Record usage AFTER successful response (skip for unlimited)
    if (!isUnlimited && usageCheck) {
      if (usageCheck.usingCredits) {
        await consumeCredit(supabase, user.id)
      } else {
        await incrementDailyUsage(supabase, user.id)
      }
    }

    if (autoWelcome) {
      await markStormiAutoWelcomeComplete(supabase, user.id, autoWelcome)
    }

    // Return usage info (unlimited wallets show effectively infinite)
    if (isUnlimited) {
      return NextResponse.json({
        success: true,
        reply,
        ...(jobSuggestions ? { jobSuggestions } : {}),
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
      ...(jobSuggestions ? { jobSuggestions } : {}),
      usage: {
        dailyRemaining: updatedCheck.dailyRemaining,
        credits: updatedCheck.credits,
        totalMessages: updatedCheck.totalMessages,
        model: usageCheck!.model,
      },
    })
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('[Stormi Chat] Anthropic API error:', error.status, error.message)

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
    console.error('[Stormi Chat] Unexpected error:', message)
    if (error instanceof Error && error.stack) {
      console.error('[Stormi Chat] Stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
