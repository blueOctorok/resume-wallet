import { suggestCategories, BLOCK_CATEGORIES } from '@/lib/block-registry'

/** One slide in a multi-step Stormi / hub walkthrough */
export interface WalkthroughStep {
  /** Stable id for analytics or future branching */
  id: string
  title: string
  /** Main copy — keep short; use double newlines for paragraph breaks */
  body: string
}

export const CANDIDATE_HUB_WELCOME_STEP_ID = 'candidate.hubWelcome' as const

function categoryLabel(id: string): string {
  return BLOCK_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

/**
 * Static steps 2–3 after the AI-written welcome (step 1).
 * Step 3 uses `suggestCategories` so we never push driver/dev examples when the text match is general-only.
 */
export function candidateHubStaticSteps(input: {
  firstName: string
  occupation: string
  seekingReason: string
  hasBlocks: boolean
}): WalkthroughStep[] {
  const { firstName, occupation, seekingReason, hasBlocks } = input
  const name = firstName.trim() || 'there'
  const occ = occupation.trim() || 'your field'
  const categories = suggestCategories(occupation, seekingReason)
  const hasDrivers = categories.includes('drivers')
  const hasDevelopers = categories.includes('developers')
  const generalOnly = !hasDrivers && !hasDevelopers

  const blocksBody = hasBlocks
    ? `Your hub is built from blocks. Each block is one piece of your profile — resume, verifications, portfolio pieces, and more.\n\n` +
      `Keep filling them in to strengthen your Career Card — the snapshot employers see when they discover you.`
    : `Your hub is made of blocks. Each block is one piece of your profile — resume, verifications, portfolio pieces, and more.\n\n` +
      `Right now your hub is empty. Add blocks to build your Career Card: the snapshot employers see when they discover you. More real data = a stronger card.`

  let nextBody: string
  if (generalOnly) {
    nextBody =
      `Based on what you shared (${occ}), our catalog leans on **${categoryLabel('general')}** blocks for now — resume, file upload, and employment verification — so you can still build an apply-ready Career Card.\n\n` +
      `Open **Add Blocks** and start with one general block. If you want specialty blocks for your lane later, tell Stormi — we're always expanding.`
  } else {
    const lanes = categories
      .filter((id) => id !== 'general')
      .map((id) => categoryLabel(id))
      .join(' and ')
    const lanePhrase = lanes ? `**${lanes}** and **${categoryLabel('general')}**` : `**${categoryLabel('general')}**`
    nextBody =
      `Stormi matched what you shared to ${lanePhrase} categories — those show up first when you browse **Add Blocks**.\n\n` +
      `Pick one block to install now; you can add more anytime.`
  }

  return [
    {
      id: 'blocks',
      title: `${name}, what are blocks?`,
      body: blocksBody,
    },
    {
      id: 'next',
      title: 'Your first step',
      body: nextBody,
    },
  ]
}
