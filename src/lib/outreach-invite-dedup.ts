/**
 * One open outreach invite per company + block + email.
 *
 * The board shows one card per person (`outreach-person.ts`), so a second open
 * consent link would still be a second row the recruiter can resend by mistake.
 * Email is the identity we actually have at send time (most invites are created
 * before anyone has an account). The block is part of the key because a DOT
 * invite and a consent invite are two different asks — they share a card, but
 * sending consent must not overwrite the DOT link.
 *
 * Only open invites count (pending / viewed / in_progress). A completed invite
 * stays on the board and does not block a fresh one, so a recruiter can
 * re-consent after a finished screening.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const OPEN_INVITE_STATUSES = ['pending', 'viewed', 'in_progress'] as const

export function normalizeOutreachEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * PostgREST `ilike` still uses SQL LIKE, where `_` and `%` match any character.
 * An address like `a_b@x.com` has to be escaped or it collides with `axb@x.com`.
 */
export function ilikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export interface LiveInviteRank {
  id: string
  status: string
  created_at: string
  email_sent_at?: string | null
  sms_sent_at?: string | null
  candidate_email?: string | null
}

/** Lower sorts first. Engaged beats unsent; a delivered link beats a bare one; newest breaks the tie. */
function rank(row: LiveInviteRank): [number, number, number] {
  const status = row.status === 'in_progress' ? 0 : row.status === 'viewed' ? 1 : 2
  const delivered = row.email_sent_at || row.sms_sent_at ? 0 : 1
  const age = -new Date(row.created_at).getTime()
  return [status, delivered, age]
}

export function pickWinningInvite<T extends LiveInviteRank>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return rows.reduce((best, row) => {
    const a = rank(row)
    const b = rank(best)
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? row : best
    }
    return best
  })
}

interface ResolveArgs {
  supabase: SupabaseClient
  companyId: string
  /** Null = a general invite (no block). */
  targetBlockType: string | null
  email: string | null
  /** E.164. Used only when there is no email — a phone-only link. */
  phone: string | null
  select: string
  /** Rescue re-consent: cancel the open ones so a fresh token can be inserted. */
  supersede: boolean
}

export interface ResolveLiveInviteResult<T> {
  /** The open invite to reuse. Null when the caller should insert. */
  invite: T | null
  supersededIds: string[]
}

/**
 * Find the open invite for this key. With more than one (rows that predate the
 * unique index), keep the winner and cancel the rest so the board heals on the
 * next send. No email and no phone means a blank link — those are not deduped.
 */
export async function resolveLiveOutreachInvite<T extends LiveInviteRank>(
  args: ResolveArgs,
): Promise<ResolveLiveInviteResult<T>> {
  const { supabase, companyId, targetBlockType, email, phone, select, supersede } = args
  if (!email && !phone) return { invite: null, supersededIds: [] }

  let query = supabase
    .from('application_invites')
    .select(select)
    .eq('company_id', companyId)
    .in('status', [...OPEN_INVITE_STATUSES])

  query = targetBlockType ? query.eq('target_block_type', targetBlockType) : query.is('target_block_type', null)

  if (email) query = query.ilike('candidate_email', ilikeExact(email))
  else query = query.eq('candidate_phone', phone)

  const { data, error } = await query
  if (error) throw error

  let rows = (data ?? []) as unknown as T[]
  if (!email && phone) {
    rows = rows.filter((row) => !String(row.candidate_email ?? '').trim())
  }
  if (rows.length === 0) return { invite: null, supersededIds: [] }

  const winner = supersede ? null : pickWinningInvite(rows)
  const cancelIds = rows.filter((row) => row.id !== winner?.id).map((row) => row.id)

  if (cancelIds.length > 0) {
    const { error: cancelError } = await supabase
      .from('application_invites')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .in('id', cancelIds)
    if (cancelError) throw cancelError
  }

  return { invite: winner, supersededIds: cancelIds }
}
