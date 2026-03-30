/**
 * Candidate Stormi chat with optional job tools (search + save alert).
 * Tiered models: Haiku on the first turn (cheap routing + optional tool calls);
 * after any tool execution, Sonnet for follow-up tool rounds and final copy.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { buildAnthropicMessagesFromHistory } from '@/lib/ava-conversation'
import { STORMI_JOB_CHAT_TOOLS, executeStormiJobChatTool } from '@/lib/ava-job-chat-tools'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StormiJobSuggestion } from '@/lib/ava-job-suggestions'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MAX_TOOL_ROUNDS = 6
const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

function extractTextFromContent(content: Anthropic.Messages.ContentBlock[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && block.text) parts.push(block.text)
  }
  return parts.join('\n').trim()
}

export async function runCandidateStormiChatWithJobTools(params: {
  anthropic: Anthropic
  systemPrompt: string
  conversationHistory: unknown
  latestUserMessage: string
  supabase: SupabaseClient
  userId: string
}): Promise<{ reply: string; jobSuggestions: StormiJobSuggestion[] }> {
  const { anthropic, systemPrompt, conversationHistory, latestUserMessage, supabase, userId } = params

  const initial = buildAnthropicMessagesFromHistory(conversationHistory, latestUserMessage)
  const messages: MessageParam[] = initial.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const flags = { searchUsed: false, saveAlertUsed: false }
  let lastJobSuggestions: StormiJobSuggestion[] = []
  let rounds = 0
  /** After tools run, switch to Sonnet for synthesis and any further tool decisions */
  let useSonnet = false

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1
    const model = useSonnet ? MODEL_SONNET : MODEL_HAIKU
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      tools: STORMI_JOB_CHAT_TOOLS as Anthropic.Messages.ToolUnion[],
    })

    if (response.stop_reason === 'end_turn') {
      const text = extractTextFromContent(response.content)
      return { reply: text, jobSuggestions: lastJobSuggestions }
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const { id, name, input } = block
        const executed = await executeStormiJobChatTool({
          name,
          input,
          ctx: { supabase, userId },
          flags,
        })
        if (executed.jobSuggestions?.length) {
          lastJobSuggestions = executed.jobSuggestions
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: executed.toolResult,
        })
      }

      if (toolResults.length === 0) {
        const text = extractTextFromContent(response.content)
        return { reply: text || 'Something went wrong with tools.', jobSuggestions: lastJobSuggestions }
      }

      messages.push({ role: 'user', content: toolResults })
      useSonnet = true
      continue
    }

    // max_tokens, refusal, etc.
    const text = extractTextFromContent(response.content)
    return {
      reply: text || 'I could not finish that request. Try again in a moment.',
      jobSuggestions: lastJobSuggestions,
    }
  }

  return {
    reply: 'That took too many steps. Try a shorter question or open Find Jobs on your hub.',
    jobSuggestions: lastJobSuggestions,
  }
}
