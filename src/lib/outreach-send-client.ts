/**
 * Client-side invite calls shared by the outreach board and the driver file.
 * Pure fetch wrappers — callers own their own optimistic state.
 */

import type { Invite } from '@/components/employer/outreach/types'
import type { SendSelection } from '@/components/employer/outreach/SendBlocksPanel'

export interface InviteTarget {
  candidateName?: string | null
  candidateEmail?: string | null
  candidatePhone?: string | null
  candidateUserId?: string | null
  jobPostingId?: string | null
  welcomeMessage?: string | null
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

function errorOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === 'string' ? data.error : fallback
}

export interface CreatedInvite {
  invite: Invite
  /** True when an open invite for this email + block was already on the board. */
  alreadyOnFile: boolean
  /** Open duplicates that were cancelled so only one card remains. */
  supersededIds: string[]
}

export async function createInvite(target: InviteTarget, targetBlockType: string, note?: string): Promise<CreatedInvite> {
  const res = await fetch('/api/employer/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetBlockType,
      candidateName: target.candidateName || undefined,
      candidateEmail: target.candidateEmail || undefined,
      candidatePhone: target.candidatePhone || undefined,
      candidateUserId: target.candidateUserId || undefined,
      jobPostingId: target.jobPostingId || undefined,
      welcomeMessage: note || target.welcomeMessage || undefined,
    }),
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(errorOf(data, 'Failed to create invite'))
  const invite = data.invite as Invite
  const supersededIds = Array.isArray(data.supersededIds) ? data.supersededIds.filter((id): id is string => typeof id === 'string') : []
  return {
    alreadyOnFile: data.alreadyOnFile === true,
    supersededIds,
    invite: {
      ...invite,
      emailSentAt: invite.emailSentAt ?? null,
      smsSentAt: invite.smsSentAt ?? null,
      candidatePhone: invite.candidatePhone ?? null,
    },
  }
}

export async function sendInviteEmail(inviteId: string, email: string): Promise<void> {
  const res = await fetch('/api/employer/invites/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteId, email }),
  })
  if (!res.ok) throw new Error(errorOf(await readJson(res), 'Failed to send email'))
}

/** Resolves to the normalized number the SMS actually went to (E.164 when the API normalizes). */
export async function sendInviteSms(inviteId: string, phone: string): Promise<string> {
  const res = await fetch('/api/employer/invites/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteId, phone }),
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(errorOf(data, 'Failed to send text'))
  return typeof data.sentTo === 'string' && data.sentTo ? data.sentTo : phone
}

/**
 * Create one invite per selected block and deliver each in the same action.
 * Used by the driver file, where there is no local invite list to update —
 * the caller refreshes the hub afterwards.
 */
export async function createAndDeliverInvites(target: InviteTarget, selection: SendSelection): Promise<Invite[]> {
  const created: Invite[] = []
  for (const blockType of selection.blockTypes) {
    const createdInvite = await createInvite(target, blockType, selection.note)
    created.push(createdInvite.invite)
  }
  for (const invite of created) {
    if (selection.viaEmail && invite.candidateEmail) await sendInviteEmail(invite.id, invite.candidateEmail)
    if (selection.viaSms && invite.candidatePhone) await sendInviteSms(invite.id, invite.candidatePhone)
  }
  return created
}
