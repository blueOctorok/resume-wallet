/**
 * Persist AvA hub thread in localStorage so refresh does not wipe the conversation.
 * Scoped per wallet + candidate/employer. Job suggestion payloads are included.
 */

import type { ChatMessage } from '@/lib/ava-chat'

const STORAGE_VERSION = 1
const MAX_MESSAGES = 120

export type AvaChatPersistenceMode = 'candidate' | 'employer'

export function avaChatStorageKey(mode: AvaChatPersistenceMode, walletAddress: string): string {
  const w = walletAddress.trim().toLowerCase()
  return `stormchain.ava-chat.v${STORAGE_VERSION}.${mode}.${w}`
}

function isChatMessage(x: unknown): x is ChatMessage {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.role !== 'user' && o.role !== 'ava') return false
  if (typeof o.text !== 'string') return false
  if (o.jobSuggestions !== undefined && !Array.isArray(o.jobSuggestions)) return false
  return true
}

export function loadAvaChatMessages(mode: AvaChatPersistenceMode, walletAddress: string): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(avaChatStorageKey(mode, walletAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { messages?: unknown }
    const arr = parsed?.messages
    if (!Array.isArray(arr)) return []
    const out: ChatMessage[] = []
    for (const item of arr) {
      if (isChatMessage(item)) out.push(item as ChatMessage)
    }
    return out.slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function saveAvaChatMessages(
  mode: AvaChatPersistenceMode,
  walletAddress: string,
  messages: ChatMessage[],
): void {
  if (typeof window === 'undefined') return
  try {
    const key = avaChatStorageKey(mode, walletAddress)
    if (messages.length === 0) {
      localStorage.removeItem(key)
      return
    }
    const payload = { v: STORAGE_VERSION, messages: messages.slice(-MAX_MESSAGES) }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    console.warn('[AvA persist] save failed:', e)
  }
}
