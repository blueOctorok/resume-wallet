/**
 * Persist Stormi hub thread in localStorage so refresh does not wipe the conversation.
 * Scoped per wallet + candidate/employer. Job suggestion payloads are included.
 * Storage key still uses `ava-chat` segment for backward compatibility with existing threads.
 */

import type { ChatMessage } from '@/lib/ava-chat'

const STORAGE_VERSION = 1
const MAX_MESSAGES = 120

export type StormiChatPersistenceMode = 'candidate' | 'employer'

export function stormiChatStorageKey(mode: StormiChatPersistenceMode, walletAddress: string): string {
  const w = walletAddress.trim().toLowerCase()
  return `stormchain.ava-chat.v${STORAGE_VERSION}.${mode}.${w}`
}

function isInterviewPrepPayload(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.kind !== 'interview_prep_mcq') return false
  if (typeof o.question !== 'string') return false
  if (!Array.isArray(o.choices) || o.choices.length !== 4) return false
  for (const c of o.choices) {
    if (!c || typeof c !== 'object') return false
    const ch = c as Record<string, unknown>
    if (typeof ch.id !== 'string' || typeof ch.text !== 'string' || typeof ch.feedback !== 'string') return false
  }
  if (typeof o.recommendedChoiceId !== 'string') return false
  return true
}

function isChatMessage(x: unknown): x is ChatMessage {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.role !== 'user' && o.role !== 'ava') return false
  if (typeof o.text !== 'string') return false
  if (o.jobSuggestions !== undefined && !Array.isArray(o.jobSuggestions)) return false
  if (o.interviewPrep !== undefined && !isInterviewPrepPayload(o.interviewPrep)) return false
  if (o.interviewPrepSelectedId !== undefined && typeof o.interviewPrepSelectedId !== 'string') return false
  return true
}

export function loadStormiChatMessages(mode: StormiChatPersistenceMode, walletAddress: string): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(stormiChatStorageKey(mode, walletAddress))
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

export function saveStormiChatMessages(
  mode: StormiChatPersistenceMode,
  walletAddress: string,
  messages: ChatMessage[],
): void {
  if (typeof window === 'undefined') return
  try {
    const key = stormiChatStorageKey(mode, walletAddress)
    if (messages.length === 0) {
      localStorage.removeItem(key)
      return
    }
    const payload = { v: STORAGE_VERSION, messages: messages.slice(-MAX_MESSAGES) }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    console.warn('[Stormi persist] save failed:', e)
  }
}
