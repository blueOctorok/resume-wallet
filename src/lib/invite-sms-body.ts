import { getBlockDefinition } from '@/lib/block-registry'
import { buildMvrReleaseSms, SCREENING_CONSENT_INVITE } from '@/lib/outreach-release-copy'

/** Plain-text invite blurb for Pingram SMS (and copy-paste fallback). */
export type InviteSmsContext = {
  companyName: string
  inviteUrl: string
  targetBlockType: string | null
  candidateName?: string | null
  jobTitle?: string | null
  recruiterName?: string | null
}

/**
 * Short SMS copy for outreach. The screening-consent invite is the MVR
 * release letter. Anything else stays a one-line block invite.
 * Includes STOP language for A2P 10DLC sample / carrier compliance.
 */
export function buildCandidateInviteSmsBody(ctx: InviteSmsContext): string {
  if (ctx.targetBlockType === SCREENING_CONSENT_INVITE) {
    return buildMvrReleaseSms({
      candidateName: ctx.candidateName,
      recruiterName: ctx.recruiterName,
      companyName: ctx.companyName,
      releaseLink: ctx.inviteUrl,
    })
  }

  const block = ctx.targetBlockType ? getBlockDefinition(ctx.targetBlockType) : null
  const label = block?.label ?? 'your invite'
  const first = ctx.candidateName?.trim().split(/\s+/)[0]
  const hi = first ? `${first}, ` : ''
  const job = ctx.jobTitle ? ` (${ctx.jobTitle})` : ''
  return `${hi}${ctx.companyName} invited you to complete ${label}${job} on Provven:\n${ctx.inviteUrl}\nReply STOP to opt out`
}
