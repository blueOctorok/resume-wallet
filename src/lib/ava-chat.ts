import { useInstalledBlocks, useHubOnboarding } from '@/stores/hub-blocks-store'
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

export function useHubContext(): HubContext {
  const onboarding = useHubOnboarding()
  const installedBlocks = useInstalledBlocks()

  return {
    occupation: onboarding?.occupation,
    seekingReason: onboarding?.seekingReason,
    extraContext: onboarding?.extraContext ?? null,
    installedBlocks: installedBlocks.map((b) => ({
      blockType: b.blockType,
      label: b.definition?.label ?? b.blockType,
      status: 'empty' as const,
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
