import { useInstalledBlocks, useHubOnboarding } from '@/stores/hub-blocks-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useAuthStore } from '@/stores'
import type { HubContext, EmployerHubContext, BlockContext } from '@/lib/ava-context'
import type { StormiJobSuggestion } from '@/lib/ava-job-suggestions'
import type { StormiAutoWelcomeMode } from '@/lib/ava-auto-welcome'
import type { StormiConversationTurn } from '@/lib/ava-conversation'
import type { StormiInterviewPrepPayload } from '@/lib/stormi-interactive-types'

export type { StormiConversationTurn } from '@/lib/ava-conversation'

export type { EmployerHubContext } from '@/lib/ava-context'

export type { StormiInterviewPrepPayload } from '@/lib/stormi-interactive-types'

export interface ChatMessage {
  role: 'user' | 'ava'
  text: string
  /** External jobs Stormi surfaced this turn (View listing + Apply with Career Card). */
  jobSuggestions?: StormiJobSuggestion[]
  /** Interactive practice (e.g. interview MCQ) — rendered as clickable UI in the thread. */
  interviewPrep?: StormiInterviewPrepPayload
  /** User picked this choice id for `interviewPrep` (shows feedback; optional follow-up line). */
  interviewPrepSelectedId?: string
}

export interface StormiUsageInfo {
  dailyRemaining: number
  credits: number
  totalMessages: number
  model: 'sonnet' | 'haiku' | null
}

/** Thrown when the user is out of free messages and credits */
export class OutOfCreditsError extends Error {
  usage: StormiUsageInfo
  constructor(message: string, usage: StormiUsageInfo) {
    super(message)
    this.name = 'OutOfCreditsError'
    this.usage = usage
  }
}

export interface StormiResponse {
  reply: string
  usage: StormiUsageInfo
  jobSuggestions?: StormiJobSuggestion[]
}

/**
 * Derives block completion status from the hub store data.
 * Each block type has its own "complete" condition based on
 * what data actually exists in the store.
 */
function deriveBlockStatus(
  blockType: string,
  hubStore: {
    resumes: Array<{ sourceRole?: string }>
    dotApplications: Array<{ isComplete?: boolean }>
    mvrRecords: Array<{ orderStatus?: string }>
    portfolio: { portfolioUrl: string | null } | null
    github: { username: string | null } | null
  },
): 'complete' | 'in-progress' | 'empty' {
  switch (blockType) {
    case 'storm-resume':
      return hubStore.resumes.length > 0 ? 'complete' : 'empty'
    case 'driver-resume':
      return hubStore.resumes.some((r) => r.sourceRole === 'driver') ? 'complete' : 'empty'
    case 'developer-resume':
      return hubStore.resumes.some((r) => r.sourceRole === 'developer') ? 'complete' : 'empty'
    case 'driver-dot-application': {
      const complete = hubStore.dotApplications.some((a) => a.isComplete)
      const started = hubStore.dotApplications.length > 0
      return complete ? 'complete' : started ? 'in-progress' : 'empty'
    }
    case 'driver-mvr': {
      const completed = hubStore.mvrRecords.some(
        (m) => m.orderStatus === 'completed' || m.orderStatus === 'needs_review'
      )
      const processing = hubStore.mvrRecords.length > 0
      return completed ? 'complete' : processing ? 'in-progress' : 'empty'
    }
    case 'developer-portfolio':
      return hubStore.portfolio?.portfolioUrl ? 'complete' : 'empty'
    case 'developer-github':
      return hubStore.github?.username ? 'complete' : 'empty'
    case 'general-resume':
      return hubStore.resumes.some((r) => r.sourceRole === 'general') ? 'complete' : 'empty'
    default:
      return 'empty'
  }
}

export function useHubContext(): HubContext {
  const onboarding = useHubOnboarding()
  const installedBlocks = useInstalledBlocks()
  const resumes = useDriverHubStore((s) => s.resumes)
  const dotApplications = useDriverHubStore((s) => s.dotApplications)
  const mvrRecords = useDriverHubStore((s) => s.mvrRecords)
  const portfolio = useDriverHubStore((s) => s.portfolio)
  const github = useDriverHubStore((s) => s.github)

  const hubStore = { resumes, dotApplications, mvrRecords, portfolio, github }

  return {
    occupation: onboarding?.occupation,
    seekingReason: onboarding?.seekingReason,
    extraContext: onboarding?.extraContext ?? null,
    installedBlocks: installedBlocks.map((b) => ({
      blockType: b.blockType,
      label: b.definition?.label ?? b.blockType,
      status: deriveBlockStatus(b.blockType, hubStore),
    })),
  }
}

export type SendToStormiPayload =
  | {
      message: string
      walletAddress?: string | null
      audience?: 'candidate'
      hubContext: HubContext
      blockContext?: BlockContext
      /** Prior turns only (excludes current `message`). Enables multi-turn memory. */
      conversationHistory?: StormiConversationTurn[]
      /** Server records completion on `users` — cross-device idempotency */
      autoWelcome?: StormiAutoWelcomeMode
    }
  | {
      message: string
      walletAddress?: string | null
      audience: 'employer'
      employerContext: EmployerHubContext
      conversationHistory?: StormiConversationTurn[]
      autoWelcome?: StormiAutoWelcomeMode
    }

export async function sendToStormi(payload: SendToStormiPayload): Promise<StormiResponse> {
  const { message, walletAddress } = payload
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (walletAddress) {
    headers['x-wallet-address'] = walletAddress
  }

  const autoWelcome =
    payload.autoWelcome !== undefined ? { autoWelcome: payload.autoWelcome } : {}

  const history =
    'conversationHistory' in payload && payload.conversationHistory?.length
      ? { conversationHistory: payload.conversationHistory }
      : {}

  const body =
    payload.audience === 'employer'
      ? {
          message,
          audience: 'employer',
          employerContext: payload.employerContext,
          ...history,
          ...autoWelcome,
        }
      : {
          message,
          hubContext: payload.hubContext,
          audience: 'candidate' as const,
          ...(payload.blockContext ? { blockContext: payload.blockContext } : {}),
          ...history,
          ...autoWelcome,
        }

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (res.status === 402) {
    const data = await res.json().catch(() => ({}))
    throw new OutOfCreditsError(
      data.message || 'You\'ve used your free messages today. Purchase credits to continue.',
      data.usage ?? { dailyRemaining: 0, credits: 0, totalMessages: 0, model: null },
    )
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to reach Stormi')
  }

  const data = await res.json()
  return {
    reply: data.reply,
    usage: data.usage ?? { dailyRemaining: 10, credits: 0, totalMessages: 0, model: 'sonnet' },
    ...(Array.isArray(data.jobSuggestions) && data.jobSuggestions.length > 0
      ? { jobSuggestions: data.jobSuggestions as StormiJobSuggestion[] }
      : {}),
  }
}

/** Hook to get the wallet address for Stormi requests */
export function useStormiWallet(): string | null {
  return useAuthStore((s) => s.walletAddress)
}
