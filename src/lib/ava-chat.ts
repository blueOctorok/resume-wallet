import { useInstalledBlocks, useHubOnboarding } from '@/stores/hub-blocks-store'
import type { HubContext } from '@/lib/ava-context'

export interface ChatMessage {
  role: 'user' | 'ava'
  text: string
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
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, hubContext }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to reach AvA')
  }

  const data = await res.json()
  return data.reply
}
