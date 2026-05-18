import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/create-notification'
import { sendEmployerCandidateActionCompleteEmail } from '@/lib/send-admin-notification'

const appBase = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://stormchain.ai').replace(/\/$/, '')

export type EmployerCandidateActionKind =
  | 'screening_consent'
  | 'bgcheck_consent'
  | 'psp_consent'
  | 'block_completed'
  | 'invite_completed'

export interface NotifyEmployerCandidateActionParams {
  kind: EmployerCandidateActionKind
  employerUserId?: string | null
  companyId?: string | null
  companyName: string
  candidateUserId: string
  candidateDisplayName?: string
  blockLabel?: string | null
  ctaUrl?: string
  notificationTitle?: string
  notificationBody?: string
  notificationData?: Record<string, unknown>
}

async function resolveEmployerUserId(
  supabase: SupabaseClient,
  employerUserId: string | null | undefined,
  companyId: string | null | undefined,
): Promise<string | null> {
  if (employerUserId) return employerUserId
  if (!companyId) return null
  const { data: comp } = await supabase
    .from('companies')
    .select('employer_user_id')
    .eq('id', companyId)
    .maybeSingle()
  return (comp?.employer_user_id as string | null) ?? null
}

async function resolveCandidateDisplayName(
  supabase: SupabaseClient,
  candidateUserId: string,
  fallback?: string,
): Promise<string> {
  if (fallback?.trim()) return fallback.trim()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', candidateUserId)
    .maybeSingle()
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  const { data: user } = await supabase.from('users').select('email').eq('id', candidateUserId).maybeSingle()
  if (user?.email) return user.email.split('@')[0] || 'Candidate'
  return 'Candidate'
}

/**
 * Email + in-app notification when a candidate completes a major employer-requested action.
 * Non-fatal — logs and returns on missing employer email.
 */
export async function notifyEmployerCandidateActionComplete(
  supabase: SupabaseClient,
  params: NotifyEmployerCandidateActionParams,
): Promise<void> {
  try {
    const notifyUserId = await resolveEmployerUserId(
      supabase,
      params.employerUserId,
      params.companyId,
    )
    if (!notifyUserId) {
      console.warn('[EMPLOYER ACTION NOTIFY] No employer user to notify', {
        kind: params.kind,
        companyId: params.companyId,
      })
      return
    }

    const candidateName = await resolveCandidateDisplayName(
      supabase,
      params.candidateUserId,
      params.candidateDisplayName,
    )

    const { data: empUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', notifyUserId)
      .maybeSingle()

    const { data: empProfile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', notifyUserId)
      .maybeSingle()

    const employerFirst = (empProfile?.first_name ?? '').trim() || 'there'
    const companyName = params.companyName.trim() || 'Your company'
    const ctaUrl = params.ctaUrl ?? `${appBase()}/`

    const defaults = defaultNotificationCopy(params.kind, candidateName, companyName, params.blockLabel)
    const title = params.notificationTitle ?? defaults.title
    const body = params.notificationBody ?? defaults.body

    if (empUser?.email?.trim()) {
      await sendEmployerCandidateActionCompleteEmail({
        kind: params.kind,
        employerEmail: empUser.email.trim(),
        employerFirstName: employerFirst,
        companyName,
        candidateDisplayName: candidateName,
        blockLabel: params.blockLabel ?? null,
        ctaUrl,
      })
    } else {
      console.warn('[EMPLOYER ACTION NOTIFY] Employer user has no email; in-app only', {
        notifyUserId,
        kind: params.kind,
      })
    }

    await createNotification({
      userId: notifyUserId,
      type: 'consent_signed',
      title,
      body,
      data: {
        kind: params.kind,
        candidateUserId: params.candidateUserId,
        companyId: params.companyId ?? undefined,
        ...params.notificationData,
      },
      actionUrl: ctaUrl,
    })
  } catch (err) {
    console.warn('[EMPLOYER ACTION NOTIFY] Non-fatal error:', err)
  }
}

function defaultNotificationCopy(
  kind: EmployerCandidateActionKind,
  candidateName: string,
  companyName: string,
  blockLabel?: string | null,
): { title: string; body: string } {
  switch (kind) {
    case 'screening_consent':
      return {
        title: 'Screening consent complete',
        body: `${candidateName} completed the full screening consent package for ${companyName}. You can order MVR and PSP reports in Outreach.`,
      }
    case 'bgcheck_consent':
      return {
        title: 'Background check consent signed',
        body: `${candidateName} signed the background check authorization for ${companyName}.`,
      }
    case 'psp_consent':
      return {
        title: 'PSP disclosure signed',
        body: `${candidateName} signed the FMCSA PSP disclosure for ${companyName}.`,
      }
    case 'invite_completed':
      return {
        title: 'Invite completed',
        body: `${candidateName} finished the requested step from your outreach invite.`,
      }
    case 'block_completed':
    default:
      return {
        title: blockLabel ? `${blockLabel} complete` : 'Candidate request fulfilled',
        body: blockLabel
          ? `${candidateName} completed your ${blockLabel} request for ${companyName}.`
          : `${candidateName} fulfilled a request for ${companyName}.`,
      }
  }
}
