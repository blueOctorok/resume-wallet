import { getBlockDefinition } from '@/lib/block-registry'

/** Plain-text invite blurb for “copy and paste into your texting app” (no carrier API). */
export type InviteSmsContext = {
  companyName: string
  inviteUrl: string
  targetBlockType: string | null
  candidateName?: string | null
  jobTitle?: string | null
}

/**
 * Short SMS copy for outreach — mirrors email intent (registry block label) without HTML.
 */
export function buildCandidateInviteSmsBody(ctx: InviteSmsContext): string {
  const block = ctx.targetBlockType ? getBlockDefinition(ctx.targetBlockType) : null
  const label = block?.label ?? 'your invite'
  const first = ctx.candidateName?.trim().split(/\s+/)[0]
  const hi = first ? `${first}, ` : ''
  const job = ctx.jobTitle ? ` (${ctx.jobTitle})` : ''
  return `${hi}${ctx.companyName} invited you to complete ${label}${job} on Storm:\n${ctx.inviteUrl}`
}
