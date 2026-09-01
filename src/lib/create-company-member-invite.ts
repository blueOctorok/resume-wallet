import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkEmailAgainstCompanyDomains } from '@/lib/employer-domain-match'
import {
  CANDIDATE_CANNOT_BECOME_EMPLOYER,
  isCandidateSurfaceRole,
} from '@/lib/employer-account-guard'
import { sendTeamInviteEmail } from '@/lib/send-team-invite-email'

export const INVITEABLE_DB_ROLES = [
  'admin',
  'hr_manager',
  'hiring_manager',
  'recruiter',
  'interviewer',
  'viewer',
] as const

export type InviteableDbRole = (typeof INVITEABLE_DB_ROLES)[number]

export type CreateInviteResult =
  | {
      ok: true
      memberId: string
      email: string
      role: string
      inviteUrl: string
    }
  | { ok: false; status: number; error: string; details?: string }

/**
 * Shared invite insert for employer hub Team and Central Admin.
 * Domain policy, duplicate checks, and the email send live in one place.
 */
export async function createCompanyMemberInvite(
  supabase: SupabaseClient,
  input: {
    companyId: string
    email: string
    role: string
    invitedByUserId: string
    inviterFallbackName?: string | null
    jobScope?: string | null
    candidateScope?: string | null
  },
): Promise<CreateInviteResult> {
  const email = input.email.trim().toLowerCase()
  const role = input.role

  if (!email || !role) {
    return { ok: false, status: 400, error: 'Email and role are required' }
  }

  if (role === 'owner') {
    return {
      ok: false,
      status: 400,
      error: 'Cannot invite another owner. Transfer ownership instead.',
    }
  }

  if (!INVITEABLE_DB_ROLES.includes(role as InviteableDbRole)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid role. Must be one of: ${INVITEABLE_DB_ROLES.join(', ')}`,
    }
  }

  let company: {
    company_name: string | null
    email: string | null
    designated_owner_email: string | null
    allowed_email_domains?: string[] | null
  } | null = null

  const fullCompany = await supabase
    .from('companies')
    .select('company_name, email, designated_owner_email, allowed_email_domains')
    .eq('id', input.companyId)
    .maybeSingle()

  if (fullCompany.error) {
    // Legacy DBs that have not run 104 still work — domain check falls back
    // to companies.email.
    const legacyCompany = await supabase
      .from('companies')
      .select('company_name, email, designated_owner_email')
      .eq('id', input.companyId)
      .maybeSingle()
    if (legacyCompany.error) {
      console.error('[TEAM INVITE] Company lookup failed:', legacyCompany.error)
      return {
        ok: false,
        status: 500,
        error: 'Could not load company for this invite',
        details: legacyCompany.error.message,
      }
    }
    company = legacyCompany.data
  } else {
    company = fullCompany.data
  }

  if (!company) {
    return { ok: false, status: 404, error: 'Company not found' }
  }

  const domainCheck = checkEmailAgainstCompanyDomains({
    allowedDomains: company.allowed_email_domains,
    email,
    companyName: company.company_name,
    legacyCompanyEmail: company.email || company.designated_owner_email,
  })

  if (!domainCheck.allowed) {
    return {
      ok: false,
      status: 400,
      error: domainCheck.error || 'Email domain is not allowed for this company',
      details: domainCheck.details,
    }
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, role')
    .ilike('email', email)
    .maybeSingle()

  if (existingUser && isCandidateSurfaceRole(existingUser.role)) {
    return { ok: false, status: 409, error: CANDIDATE_CANNOT_BECOME_EMPLOYER }
  }

  if (existingUser) {
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id, is_active, accepted_at')
      .eq('company_id', input.companyId)
      .eq('user_id', existingUser.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existingMember) {
      if (!existingMember.accepted_at) {
        await supabase.from('company_members').delete().eq('id', existingMember.id)
      } else {
        return { ok: false, status: 409, error: 'This user is already a team member' }
      }
    }
  }

  const { data: pendingInvite } = await supabase
    .from('company_members')
    .select('id, invite_expires_at')
    .eq('company_id', input.companyId)
    .ilike('invite_email', email)
    .eq('is_active', true)
    .is('accepted_at', null)
    .maybeSingle()

  if (pendingInvite) {
    const expiresAt = pendingInvite.invite_expires_at
      ? new Date(pendingInvite.invite_expires_at)
      : null
    if (expiresAt && expiresAt < new Date()) {
      await supabase.from('company_members').delete().eq('id', pendingInvite.id)
    } else {
      return { ok: false, status: 409, error: 'There is already a pending invite for this email' }
    }
  }

  const inviteToken = randomUUID()
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // invited_by FKs to public.users. An admin Auth user is not always bootstrapped
  // into that table — write null rather than 500 on the FK.
  const { data: inviterRow } = await supabase
    .from('users')
    .select('id')
    .eq('id', input.invitedByUserId)
    .maybeSingle()

  const { data: newMember, error: insertError } = await supabase
    .from('company_members')
    .insert({
      company_id: input.companyId,
      user_id: existingUser?.id ?? null,
      role,
      job_scope: input.jobScope || null,
      candidate_scope: input.candidateScope || null,
      invited_by: inviterRow?.id ?? null,
      invite_email: email,
      invite_token: inviteToken,
      invite_expires_at: inviteExpiresAt.toISOString(),
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !newMember) {
    console.error('[TEAM INVITE] Insert failed:', insertError)
    return {
      ok: false,
      status: 500,
      error: insertError?.message || 'Failed to create invite',
      details: insertError?.details || insertError?.hint || undefined,
    }
  }

  const { data: inviterProfile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', input.invitedByUserId)
    .maybeSingle()

  const inviterName =
    [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(' ').trim() ||
    input.inviterFallbackName ||
    'Provven admin'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  void sendTeamInviteEmail({
    to: email,
    inviterName,
    companyName: company.company_name || 'Your company',
    role,
    inviteToken,
    expiresAt: inviteExpiresAt,
  }).then((result) => {
    if (result.ok) {
      console.log(`[TEAM INVITE] Email sent to ${email}`)
    } else {
      console.warn(`[TEAM INVITE] Email failed for ${email}:`, result.error)
    }
  })

  return {
    ok: true,
    memberId: newMember.id,
    email,
    role,
    inviteUrl,
  }
}
