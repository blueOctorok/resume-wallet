import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from '@/lib/employer-permissions'
import { toCompanyAccountTier, type CompanyAccountTier } from '@/lib/company-account-tier'
import { dotApplicationViewAllowed } from '@/lib/dot-app-access'

export interface EmployerCompanyAccess {
  employerUserId: string
  companyId: string
  /** Always concrete — never undefined, so a caller can't be bypassed by a missing role. */
  companyRole: string
  canManageEmployerBlocks: boolean
  accountTier: CompanyAccountTier
}

/**
 * Resolves the caller's company and membership role.
 *
 * Two fixes over the previous version:
 *   - It looked the caller up by `wallet_address` despite the parameter being a
 *     session user id, so any member created after the Supabase auth cutover
 *     (no wallet) resolved to null and was locked out.
 *   - `canManageEmployerBlocks` was hardcoded `true`, so the "owner/admin only"
 *     comments on the hub-block routes enforced nothing.
 */
export async function getEmployerCompanyAccess(
  supabase: SupabaseClient,
  sessionUserId: string,
): Promise<EmployerCompanyAccess | null> {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('id', sessionUserId)
    .maybeSingle()

  if (userErr || !user) return null

  // Prefer an accepted membership; an unaccepted invite row is not access.
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, role, accepted_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .not('accepted_at', 'is', null)
    .order('accepted_at', { ascending: true })
    .limit(1)

  const membership = memberships?.[0]

  if (membership?.company_id) {
    const companyRole = membership.role || 'recruiter'
    return {
      employerUserId: user.id,
      companyId: membership.company_id,
      companyRole,
      canManageEmployerBlocks: can(companyRole, 'manageCompany'),
      accountTier: await readAccountTier(supabase, membership.company_id),
    }
  }

  // Legacy rows predate company_members and use companies.employer_user_id as
  // an implicit owner link.
  const { data: legacy } = await supabase
    .from('companies')
    .select('id, account_tier')
    .eq('employer_user_id', user.id)
    .maybeSingle()

  if (legacy?.id) {
    return {
      employerUserId: user.id,
      companyId: legacy.id,
      companyRole: 'owner',
      canManageEmployerBlocks: can('owner', 'manageCompany'),
      accountTier: toCompanyAccountTier(legacy.account_tier),
    }
  }

  return null
}

async function readAccountTier(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyAccountTier> {
  const { data } = await supabase
    .from('companies')
    .select('account_tier')
    .eq('id', companyId)
    .maybeSingle()
  return toCompanyAccountTier(data?.account_tier)
}

export async function companyHasEmployerBlock(
  supabase: SupabaseClient,
  companyId: string,
  blockType: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('employer_hub_blocks')
    .select('id')
    .eq('company_id', companyId)
    .eq('block_type', blockType)
    .maybeSingle()
  return Boolean(data)
}

/**
 * MVR capability: company has the employer MVR ordering block installed.
 */
export async function companyCanOrderMvr(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-mvr-orders')
}

/**
 * PSP capability: company has the employer PSP ordering block (PSP Accio product still includes MVR suborder).
 */
export async function companyCanOrderPsp(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-psp-orders')
}

/** Collect bundled screening consent (FCRA + FMCSA + CDLIS) before MVR/PSP employer orders. */
export async function companyHasScreeningConsentBlock(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-screening-consent')
}

/**
 * Full DOT application. Agency tier opens it directly. A carrier opens it
 * only after this driver marks that company's DQ-file request completed.
 */
export async function companyCanViewDotApplication(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
): Promise<boolean> {
  const accountTier = await readAccountTier(supabase, companyId)
  const { data: share } = await supabase
    .from('candidate_requests')
    .select('id')
    .eq('company_id', companyId)
    .eq('candidate_user_id', candidateUserId)
    .eq('target_block_type', 'driver-dot-application')
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle()

  return dotApplicationViewAllowed({
    accountTier,
    driverAcceptedShare: Boolean(share),
  })
}

/**
 * EV share capability: company may ask a named applicant to share their
 * driver-ordered employment verification (docs/EV_CONSENT_STACK.md).
 */
export async function companyCanRequestEvShare(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  return companyHasEmployerBlock(supabase, companyId, 'employer-employment-verification')
}

/** How many employer product blocks this company has installed. */
export async function countEmployerBlocks(
  supabase: SupabaseClient,
  companyId: string,
): Promise<number> {
  const { count } = await supabase
    .from('employer_hub_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  return count ?? 0
}

/**
 * A relationship takes both sides: the driver applied, used this company's
 * invite, or accepted a request from it. A request the company sent and the
 * driver has not answered (pending, viewed, declined, expired) is one-sided
 * and grants nothing — not contact, not the PDF, not visibility after the
 * driver hides from search.
 */
export async function hasEmployerCandidateRelationship(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
): Promise<boolean> {
  const { count: acceptedRequestCount } = await supabase
    .from('candidate_requests')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('candidate_user_id', candidateUserId)
    .eq('status', 'completed')
  if ((acceptedRequestCount ?? 0) > 0) return true

  const { count: inviteCount } = await supabase
    .from('application_invites')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('used_by_user_id', candidateUserId)
  if ((inviteCount ?? 0) > 0) return true

  const { data: application } = await supabase
    .from('applications')
    .select('id, job_postings!inner(company_id)')
    .eq('applicant_user_id', candidateUserId)
    .eq('job_postings.company_id', companyId)
    .limit(1)
    .maybeSingle()
  return Boolean(application)
}

/**
 * Who may open the driver's live resume. Same people as the status board:
 * a real relationship, a screening this company already touched, or (for an
 * agency) a driver who signed up on their own. A talent-search stranger is not
 * on that list — their career card stays the public projection.
 */
export async function companyCanReadDriverResume(
  supabase: SupabaseClient,
  access: EmployerCompanyAccess,
  candidateUserId: string,
): Promise<boolean> {
  const companyId = access.companyId
  if (await hasEmployerCandidateRelationship(supabase, companyId, candidateUserId)) return true

  const [consent, mvr, psp, request] = await Promise.all([
    supabase
      .from('screening_consent_bundles')
      .select('id')
      .eq('company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('mvr_orders')
      .select('id')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('psp_orders')
      .select('id')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('candidate_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateUserId)
      .limit(1)
      .maybeSingle(),
  ])
  if (consent.data || mvr.data || psp.data || request.data) return true

  if (access.accountTier !== 'agency') return false

  const [{ data: user }, { data: staff }, { data: otherInvite }] = await Promise.all([
    supabase.from('users').select('role').eq('id', candidateUserId).maybeSingle(),
    supabase
      .from('company_members')
      .select('id')
      .eq('user_id', candidateUserId)
      .eq('is_active', true)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('application_invites')
      .select('id')
      .neq('company_id', companyId)
      .eq('used_by_user_id', candidateUserId)
      .in('status', ['pending', 'viewed', 'in_progress', 'completed'])
      .limit(1)
      .maybeSingle(),
  ])
  if (!user) return false
  // Same rule as belongsOnSelfServeDqRoster, checked for this one driver
  // instead of scanning the whole roster.
  const role = user.role as string | null
  if (role === 'employer' || role === 'admin') return false
  if (staff || otherInvite) return false
  return true
}
