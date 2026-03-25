const MAX_MESSAGES = 20
const MAX_CONTENT_CHARS = 12_000

export type AvaConversationTurn = { role: 'user' | 'assistant'; content: string }

/** Anthropic Messages API shape */
export type AnthropicMessageParam = { role: 'user' | 'assistant'; content: string }

/**
 * Build Anthropic message list from prior turns + latest user text.
 * Merges consecutive same-role turns (invalid API shape) by concatenating.
 */
export function buildAnthropicMessagesFromHistory(
  prior: unknown,
  latestUserMessage: string,
): AnthropicMessageParam[] {
  const raw: AvaConversationTurn[] = []
  if (Array.isArray(prior)) {
    for (const item of prior) {
      if (!item || typeof item !== 'object') continue
      const r = (item as { role?: string }).role
      const c = (item as { content?: string }).content
      if (r !== 'user' && r !== 'assistant') continue
      if (typeof c !== 'string' || !c.trim()) continue
      raw.push({
        role: r,
        content: c.trim().slice(0, MAX_CONTENT_CHARS),
      })
    }
  }

  const latest = latestUserMessage.trim().slice(0, MAX_CONTENT_CHARS)
  if (!latest) return []

  const all: AvaConversationTurn[] = [...raw, { role: 'user', content: latest }]

  const merged: AnthropicMessageParam[] = []
  for (const m of all) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      last.content = `${String(last.content)}\n\n${m.content}`
    } else {
      merged.push({ role: m.role, content: m.content })
    }
  }

  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }

  return merged.slice(-MAX_MESSAGES)
}
