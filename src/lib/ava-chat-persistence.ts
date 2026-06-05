/**
 * Persist Stormi hub thread in localStorage so refresh does not wipe the conversation.
 * Scoped per wallet + candidate/employer. Job suggestion payloads are included.
 * Storage key still uses `ava-chat` segment for backward compatibility with existing threads.
 */

import type { ChatMessage } from '@/lib/ava-chat'

const STORAGE_VERSION = 1
const MAX_MESSAGES = 120

export type StormiChatPersistenceMode = 'candidate' | 'employer'

/**
 * @param guidedJobId When set, thread is stored per Guided-mode job so switching
 *   jobs does not collide with the hub drawer thread or other postings.
 */
export function stormiChatStorageKey(
  mode: StormiChatPersistenceMode,
  sessionUserId: string,
  guidedJobId?: string | null,
): string {
  const w = sessionUserId.trim().toLowerCase()
  const g =
    guidedJobId && guidedJobId.trim()
      ? `.gj.${encodeURIComponent(guidedJobId.trim()).slice(0, 120)}`
      : ''
  return `stormchain.ava-chat.v${STORAGE_VERSION}.${mode}.${w}${g}`
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

export function loadStormiChatMessages(
  mode: StormiChatPersistenceMode,
  sessionUserId: string,
  guidedJobId?: string | null,
): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(stormiChatStorageKey(mode, sessionUserId, guidedJobId))
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
  sessionUserId: string,
  messages: ChatMessage[],
  guidedJobId?: string | null,
): void {
  if (typeof window === 'undefined') return
  try {
    const key = stormiChatStorageKey(mode, sessionUserId, guidedJobId)
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
