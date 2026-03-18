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
      parts.push(`\n## Hub state
Their hub is empty — no blocks added yet.

When the hub is empty, your priority is:
1. Welcome them warmly and explain what StormChain does in 1-2 sentences
2. Explain that "blocks" are the building blocks of their professional profile — each one represents a credential, document, or skill set
3. If their occupation is known (see "About this candidate" above), recommend 2-3 specific blocks based on it
4. If NO occupation is provided, do NOT assume or guess what they do. Instead, ask them what kind of work they do or are looking for, and explain that once you know, you can point them to the right blocks. Suggest they start with general blocks (Skills, Work History) in the meantime.
5. Tell them to click the "Add" button on their hub to browse the Block Store

CRITICAL: Never assume an occupation. StormChain is job-agnostic — drivers, nurses, developers, and everyone in between can use it. Only reference a specific profession if the user told you theirs.

Keep it under 150 words. Be conversational, not corporate.`)
    } else {
      parts.push('\n## Current hub blocks')
      for (const block of hubContext.installedBlocks) {
        const statusLabel =
          block.status === 'complete' ? '✅ Complete'
          : block.status === 'in-progress' ? '🔄 In Progress'
          : '⬜ Not started'
        parts.push(`- **${block.label}** — ${statusLabel}`)
      }

      // Career-specific blocks signal intent — AvA should lean in
      const blockTypes = hubContext.installedBlocks.map((b) => b.blockType)
      const hasDriverBlocks = blockTypes.some((t) => t.startsWith('driver-'))
      const hasDeveloperBlocks = blockTypes.some((t) => t.startsWith('developer-'))
      const onlyGeneral = blockTypes.every((t) => t.startsWith('general-'))

      if (hasDriverBlocks) {
        parts.push('\nThis user has installed driver-specific blocks. They are pursuing a career in trucking/transportation. Speak confidently about CDL, DOT compliance, MVR records, and the trucking industry. Recommend related blocks they haven\'t installed yet (DOT Application, Driver Resume, MVR, CDL Credentials).')
      } else if (hasDeveloperBlocks) {
        parts.push('\nThis user has installed developer-specific blocks. They are pursuing a career in software/tech. Speak confidently about portfolios, GitHub, technical skills, and the tech industry. Recommend related blocks they haven\'t installed yet (Portfolio, GitHub, Developer Resume).')
      } else if (onlyGeneral) {
        parts.push('\nThis user has only general blocks — no career-specific ones yet. Don\'t assume their profession. Help them complete the blocks they have and suggest they explore the Block Store for career-specific blocks that match their field.')
      }
    }
  }

  // Find Jobs — permanent hub feature (not a block)
  parts.push(`\n## Find Jobs
The candidate's hub has a permanent "Find Jobs" section with two tabs:
- **StormChain Jobs** — real jobs posted by verified employers on the platform. Candidates apply directly with their Career Card.
- **External Jobs** — aggregated listings from Adzuna (external job boards). Candidates can apply externally or use "Apply with StormChain."

When the user asks about finding work, applying to jobs, or job searching:
1. Tell them to use "Find Jobs" on their hub — it's always available, no block needed.
2. Recommend StormChain Jobs first (verified employers, direct Career Card applications).
3. If they haven't built their Career Card yet, suggest completing their blocks first so employers can see a strong profile.`)

  // Active block focus — only when user is inside a specific block
  if (blockContext) {
    parts.push(`\n## Active block\nThe user is asking about the **${blockContext.label}** block.`)
    parts.push(`- Description: ${blockContext.description}`)
    parts.push(`- Current status: ${blockContext.status}`)
    parts.push('\nFocus your response on this block unless the user explicitly asks about something else.')
  }

  return parts.join('\n')
}
