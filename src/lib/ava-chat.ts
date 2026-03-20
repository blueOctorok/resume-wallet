import { useInstalledBlocks, useHubOnboarding } from '@/stores/hub-blocks-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useAuthStore } from '@/stores'
import type { HubContext } from '@/lib/ava-context'

export interface ChatMessage {
  role: 'user' | 'ava'
  text: string
}

export interface AvaUsageInfo {
  dailyRemaining: number
  credits: number
  totalMessages: number
  model: 'sonnet' | 'haiku' | null
}

/** Thrown when the user is out of free messages and credits */
export class OutOfCreditsError extends Error {
  usage: AvaUsageInfo
  constructor(message: string, usage: AvaUsageInfo) {
    super(message)
    this.name = 'OutOfCreditsError'
    this.usage = usage
  }
}

export interface AvaResponse {
  reply: string
  usage: AvaUsageInfo
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

export async function sendToAva(
  message: string,
  hubContext: HubContext,
  walletAddress?: string | null,
): Promise<AvaResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (walletAddress) {
    headers['x-wallet-address'] = walletAddress
  }

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, hubContext }),
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
    throw new Error(err.error || 'Failed to reach AvA')
  }

  const data = await res.json()
  return {
    reply: data.reply,
    usage: data.usage ?? { dailyRemaining: 10, credits: 0, totalMessages: 0, model: 'sonnet' },
  }
}

/** Hook to get the wallet address for AvA requests */
export function useAvaWallet(): string | null {
  return useAuthStore((s) => s.walletAddress)
}
