import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockDefinition } from '@/lib/block-registry'
import { findCompletedDriverApplicationId } from '@/lib/driver-application-db'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'

export const DOT_BLOCK = 'driver-dot-application'
const OPEN_STATUSES = ['pending', 'viewed', 'in_progress']

/**
 * For a driver who may have finished their DOT application before the invite
 * existed: if a submitted application is on file, complete their open DOT
 * invites against it. Used when an invite is created and when it is claimed.
 */
export async function completeDotOutreachInvitesIfApplicationDone(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<{ completed: number }> {
  const applicationId = await findCompletedDriverApplicationId(supabase, driverUserId)
  if (!applicationId) return { completed: 0 }
  return completeDotOutreachInvites(supabase, driverUserId, applicationId)
}

interface OpenInvite {
  id: string
  company_id: string
  created_by_user_id: string | null
  candidate_name: string | null
  used_by_user_id: string | null
}

/**
 * A finished DOT application completes every open DOT-application invite that
 * was sent to this driver. Called from the submit route.
 *
 * An invite is "this driver's" when they claimed it (used_by_user_id) or when it
 * was addressed to their email and never claimed — a driver who signed in from
 * the homepage instead of the link still finished what the recruiter asked for.
 *
 * Idempotent: already-completed invites are not touched. One notification per
 * company, not per invite, since a recruiter may have sent the same driver two
 * links.
 */
export async function completeDotOutreachInvites(
  supabase: SupabaseClient,
  driverUserId: string,
  driverApplicationId: string,
): Promise<{ completed: number }> {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', driverUserId)
    .maybeSingle()
  const email = (user?.email as string | null)?.trim().toLowerCase() || null

  const match = email
    ? `used_by_user_id.eq.${driverUserId},and(used_by_user_id.is.null,candidate_email.ilike.${email})`
    : `used_by_user_id.eq.${driverUserId}`

  const { data, error } = await supabase
    .from('application_invites')
    .select('id, company_id, created_by_user_id, candidate_name, used_by_user_id')
    .eq('target_block_type', DOT_BLOCK)
    .in('status', OPEN_STATUSES)
    .or(match)

  if (error) {
    console.error('[DOT INVITES] lookup failed:', error.message)
    return { completed: 0 }
  }

  const invites = (data ?? []) as OpenInvite[]
  if (invites.length === 0) return { completed: 0 }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('application_invites')
    .update({
      status: 'completed',
      driver_application_id: driverApplicationId,
      used_by_user_id: driverUserId,
      used_at: now,
      updated_at: now,
    })
    .in('id', invites.map((invite) => invite.id))

  if (updateError) {
    console.error('[DOT INVITES] complete failed:', updateError.message)
    return { completed: 0 }
  }

  const blockLabel = getBlockDefinition(DOT_BLOCK)?.label ?? 'DOT application'
  const byCompany = new Map<string, OpenInvite>()
  for (const invite of invites) {
    if (!byCompany.has(invite.company_id)) byCompany.set(invite.company_id, invite)
  }

  for (const invite of byCompany.values()) {
    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', invite.company_id)
      .maybeSingle()

    void notifyEmployerCandidateActionComplete(supabase, {
      kind: 'invite_completed',
      employerUserId: invite.created_by_user_id,
      companyId: invite.company_id,
      companyName: (company?.company_name as string | undefined)?.trim() || 'Your company',
      candidateUserId: driverUserId,
      candidateDisplayName: invite.candidate_name ?? undefined,
      blockLabel,
      notificationData: { inviteId: invite.id, targetBlockType: DOT_BLOCK, driverApplicationId },
    })
  }

  console.log(`[DOT INVITES] Completed ${invites.length} invite(s) for ${driverUserId}`)
  return { completed: invites.length }
}
