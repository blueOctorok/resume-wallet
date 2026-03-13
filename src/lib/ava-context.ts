/**
 * AvA Context Builder
 *
 * Constructs the system prompt for AvA based on the candidate's current
 * hub state. The richer the context, the smarter AvA's responses.
 *
 * Two context modes:
 *  - Hub-level: user is on the empty hub asking for block suggestions
 *  - Block-level: user clicked "Ask AvA" on a specific installed block
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal hub state sent from the client with each AvA request */
export interface HubContext {
  /** From hub_onboarding.occupation */
  occupation?: string
  /** From hub_onboarding.seeking_reason */
  seekingReason?: string
  /** Installed blocks and their completion status */
  installedBlocks?: Array<{
    blockType: string
    label: string
    status: 'complete' | 'in-progress' | 'empty'
  }>
}

/** When a user clicks "Ask AvA" on a specific block, include this */
export interface BlockContext {
  blockType: string
  label: string
  description: string
  status: 'complete' | 'in-progress' | 'empty'
}

// ── System prompt builder ──────────────────────────────────────────────────────

const AVA_PERSONA = `You are AvA, the AI career assistant for StormChain — a platform where candidates build verifiable professional profiles by adding blocks to their hub.

Be warm, direct, and practical. Focus on actionable next steps. Keep responses concise (2–3 short paragraphs max) unless the user asks for detail. Never use filler phrases like "Great question!" or "Certainly!".`

export function buildAvaSystemPrompt(
  hubContext?: HubContext,
  blockContext?: BlockContext
): string {
  const parts: string[] = [AVA_PERSONA]

  // Candidate identity section
  if (hubContext?.occupation || hubContext?.seekingReason) {
    parts.push('\n## About this candidate')
    if (hubContext.occupation) {
      parts.push(`- **What they do:** ${hubContext.occupation}`)
    }
    if (hubContext.seekingReason) {
      parts.push(`- **Why they're here:** ${hubContext.seekingReason}`)
    }
  }

  // Hub state section
  if (hubContext?.installedBlocks) {
    if (hubContext.installedBlocks.length === 0) {
      parts.push('\n## Hub state\nTheir hub is empty — no blocks added yet. Help them understand which blocks to start with based on who they are.')
    } else {
      parts.push('\n## Current hub blocks')
      for (const block of hubContext.installedBlocks) {
        const statusLabel =
          block.status === 'complete' ? '✅ Complete'
          : block.status === 'in-progress' ? '🔄 In Progress'
          : '⬜ Not started'
        parts.push(`- **${block.label}** — ${statusLabel}`)
      }
    }
  }

  // Active block focus — only when user is inside a specific block
  if (blockContext) {
    parts.push(`\n## Active block\nThe user is asking about the **${blockContext.label}** block.`)
    parts.push(`- Description: ${blockContext.description}`)
    parts.push(`- Current status: ${blockContext.status}`)
    parts.push('\nFocus your response on this block unless the user explicitly asks about something else.')
  }

  return parts.join('\n')
}
