import { suggestCategories } from '@/lib/block-registry'

/** One slide in a multi-step Stormi / hub walkthrough */
export interface WalkthroughStep {
  /** Stable id for analytics or future branching */
  id: string
  title: string
  /** Main copy — keep short; use double newlines for paragraph breaks */
  body: string
}

export const CANDIDATE_HUB_WELCOME_STEP_ID = 'candidate.hubWelcome' as const

/**
 * Static steps 2–3 after the AI-written welcome (step 1).
 * Drivers wedge: feature catalog is flat — no General / Developers lanes.
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
  // Keep call so onboarding still records suggested categories (always drivers).
  void suggestCategories(occupation, seekingReason)

  const featuresBody = hasBlocks
    ? `Your career card grows from features you add — DOT application, MVR, PSP, CDL credentials, and more.\n\n` +
      `Keep finishing them to strengthen the snapshot employers see when they discover you.`
    : `Your career card grows from features you add — DOT application, MVR, PSP, CDL credentials, and more.\n\n` +
      `Right now the card is light. Add a feature to start building what employers see. More real data = a stronger card.`

  const nextBody =
    `Based on what you shared (${occ}), start with the features that carriers care about most — **DOT Application**, **MVR**, and **PSP**.\n\n` +
    `Use the buttons under your career card, or open **Add features to career card** to browse the full list.`

  return [
    {
      id: 'blocks',
      title: `${name}, what strengthens your card?`,
      body: featuresBody,
    },
    {
      id: 'next',
      title: 'Your first step',
      body: nextBody,
    },
  ]
}
