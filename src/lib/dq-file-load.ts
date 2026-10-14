/**
 * Supabase loaders for DQ file snapshots.
 * Keeps route handlers thin — gather rows, then call resolve* from dq-file-status.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveCompanyDqFile,
  resolveDriverDqFile,
  type DqFileSnapshot,
  type DqItemStatus,
  type ResolveCompanyDqInput,
  type ResolveDriverDqInput,
} from '@/lib/dq-file-status'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { ScreeningOutcome } from '@/lib/accio-result-status'
import { isLicenseScanFields } from '@/lib/aamva-license'
import { getCdlData, getLicenseScan, type LicenseScanRow } from '@/lib/block-data'
import { toCompanyAccountTier } from '@/lib/company-account-tier'
import { toDqLicenseScan } from '@/lib/license-scan-view'
import { fetchAllInChunks } from '@/lib/supabase-in-chunks'

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = 'Unknown driver',
): string {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || fallback
}

// ── Company lens: one query set, three consumers ───────────────────────────
//
// The talent route, the driver-file detail, and the board all need the same
// rows. Fetch them once with every column the detail view wants, then map
// down to the minimal resolver input. Fetching rich + mapping down is cheaper
// to maintain than three near-identical query sets drifting apart.

const LIVE_INVITE_STATUSES = ['pending', 'viewed', 'in_progress'] as const

interface OrderRowRich {
  id: string
  status: string
  completed_at: string | null
  processed_at: string | null
  ordered_at: string | null
  created_at: string | null
  expires_at: string | null
  ordered_by_company_id: string | null
  result_outcome: string | null
}

interface ConsentRowRich {
  id: string
  status: string
  cdlis_signed_at: string | null
  completed_at: string | null
  created_at: string
  bgcheck_consent_id: string | null
  psp_consent_id: string | null
}

interface DotRowRich {
  id: string
  is_complete: boolean | null
  current_step: number | null
  updated_at: string | null
  created_at: string | null
}

interface EvRowRich {
  id: string
  status: string
  finalized_at: string | null
  updated_at: string | null
  created_at: string | null
  previous_employer_name: string
  attempt_count: number | null
  last_attempt_at: string | null
}

interface InviteRowRich {
  id: string
  target_block_type: string | null
  status: string
  created_at: string
  email_sent_at: string | null
  sms_sent_at: string | null
  view_count: number | null
}

interface CompanyDqRows {
  mvrOrders: OrderRowRich[]
  pspOrders: OrderRowRich[]
  consentBundles: ConsentRowRich[]
  dotApplications: DotRowRich[]
  employmentVerifications: EvRowRich[]
  /** Every invite this company sent this person, newest first. */
  invites: InviteRowRich[]
  licenseScan: LicenseScanRow | null
}

const ORDER_COLS_RICH =
  'id, status, completed_at, processed_at, ordered_at, created_at, expires_at, ordered_by_company_id, result_outcome'

/**
 * Product rule (multi-employer DQ file):
 * - MVR / PSP are **driver-owned artifacts** — any pull for this driver counts
 *   on every employer's board, regardless of who paid.
 * - Consent, employment verifications, and invites stay company-scoped.
 *   DOT app and license photos are driver-global.
 */
async function loadCompanyDqRows(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
): Promise<CompanyDqRows> {
  const [mvr, psp, consents, dots, evs, invites, licenseScan] = await Promise.all([
    supabase.from('mvr_orders').select(ORDER_COLS_RICH).eq('driver_user_id', candidateUserId).order('created_at', { ascending: false }).limit(20),
    supabase.from('psp_orders').select(ORDER_COLS_RICH).eq('driver_user_id', candidateUserId).order('created_at', { ascending: false }).limit(20),
    supabase
      .from('screening_consent_bundles')
      .select('id, status, cdlis_signed_at, completed_at, created_at, bgcheck_consent_id, psp_consent_id')
      .eq('company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('driver_applications')
      .select('id, is_complete, current_step, updated_at, created_at')
      .eq('user_id', candidateUserId)
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('employment_verification_requests')
      .select('id, status, finalized_at, updated_at, created_at, previous_employer_name, attempt_count, last_attempt_at')
      .eq('requesting_company_id', companyId)
      .eq('driver_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('application_invites')
      .select('id, target_block_type, status, created_at, email_sent_at, sms_sent_at, view_count')
      .eq('company_id', companyId)
      .or(`used_by_user_id.eq.${candidateUserId},candidate_user_id.eq.${candidateUserId}`)
      .order('created_at', { ascending: false })
      .limit(50),
    getLicenseScan(supabase, candidateUserId),
  ])

  return {
    mvrOrders: (mvr.data ?? []) as OrderRowRich[],
    pspOrders: (psp.data ?? []) as OrderRowRich[],
    consentBundles: (consents.data ?? []) as ConsentRowRich[],
    dotApplications: (dots.data ?? []) as DotRowRich[],
    employmentVerifications: (evs.data ?? []) as EvRowRich[],
    invites: (invites.data ?? []) as InviteRowRich[],
    licenseScan,
  }
}

function newestLiveConsentInviteAt(invites: InviteRowRich[]): string | null {
  return (
    invites.find(
      (i) =>
        i.target_block_type === 'driver-screening-consent' &&
        (LIVE_INVITE_STATUSES as readonly string[]).includes(i.status),
    )?.created_at ?? null
  )
}

function toCompanyDqInput(rows: CompanyDqRows, hireDate?: string | null): ResolveCompanyDqInput {
  return {
    mvrOrders: rows.mvrOrders.map(toOrderInput),
    pspOrders: rows.pspOrders.map(toOrderInput),
    consentBundles: rows.consentBundles.map((b) => ({
      id: b.id,
      status: b.status,
      cdlisSignedAt: b.cdlis_signed_at,
      completedAt: b.completed_at,
      createdAt: b.created_at,
    })),
    dotApplications: rows.dotApplications.map((a) => ({
      id: a.id,
      isComplete: Boolean(a.is_complete),
      currentStep: a.current_step,
      updatedAt: a.updated_at,
      createdAt: a.created_at,
    })),
    employmentVerifications: rows.employmentVerifications.map((r) => ({
      id: r.id,
      status: r.status,
      finalizedAt: r.finalized_at,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    })),
    hireDate: hireDate ?? null,
    licenseScan: toDqLicenseScan(rows.licenseScan),
    pendingConsentInviteAt: newestLiveConsentInviteAt(rows.invites),
  }
}

function toOrderInput(o: OrderRowRich) {
  return {
    id: o.id,
    status: o.status,
    completedAt: o.completed_at,
    processedAt: o.processed_at,
    orderedAt: o.ordered_at,
    createdAt: o.created_at,
    expiresAt: o.expires_at,
  }
}

export async function resolveCompanyDqForCandidate(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
  hireDate?: string | null,
): Promise<DqFileSnapshot> {
  const rows = await loadCompanyDqRows(supabase, companyId, candidateUserId)
  return resolveCompanyDqFile(toCompanyDqInput(rows, hireDate))
}

// ── Driver file detail (board click-through) ───────────────────────────────

export interface DriverFileDetail {
  /** Self-reported CDL from the hub. Number is deliberately not included. */
  cdl: {
    cdlClass: string | null
    state: string | null
    expiration: string | null
    endorsements: string[]
    restrictions: string[]
  } | null
  /** License photos + what the barcode read. Class / state / expiry only — no number, DOB, or address. */
  license: {
    hasFront: boolean
    hasBack: boolean
    barcodeStatus: LicenseScanRow['barcode_status']
    confirmedAt: string | null
    licenseClass: string | null
    state: string | null
    expiration: string | null
  } | null
  dotApplication: { id: string; currentStep: number; isComplete: boolean; updatedAt: string | null } | null
  consent: {
    id: string
    status: string
    createdAt: string
    completedAt: string | null
    parts: { fcra: boolean; psp: boolean; cdlis: boolean }
  } | null
  screenings: Array<{
    id: string
    kind: 'mvr' | 'psp'
    status: string
    outcome: ScreeningOutcome | null
    orderedAt: string | null
    completedAt: string | null
    /** Report access follows payment (CRA rule) — only your own orders open. */
    orderedByYou: boolean
  }>
  employmentVerifications: Array<{
    id: string
    employerName: string
    status: string
    attemptCount: number
    lastAttemptAt: string | null
    updatedAt: string | null
  }>
  invites: Array<{
    id: string
    blockType: string | null
    status: string
    createdAt: string
    emailSentAt: string | null
    smsSentAt: string | null
    viewCount: number
  }>
}

export async function loadDriverFileDetail(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
  hireDate?: string | null,
): Promise<{ dqFile: DqFileSnapshot; detail: DriverFileDetail }> {
  const [rows, cdl] = await Promise.all([
    loadCompanyDqRows(supabase, companyId, candidateUserId),
    getCdlData(supabase, candidateUserId),
  ])
  const dqFile = resolveCompanyDqFile(toCompanyDqInput(rows, hireDate))

  const scan = rows.licenseScan
  const fields = isLicenseScanFields(scan?.parsed_fields) ? scan.parsed_fields : null
  const newestDot = rows.dotApplications[0]
  const newestConsent = rows.consentBundles[0]

  const toScreening = (kind: 'mvr' | 'psp') => (o: OrderRowRich) => ({
    id: o.id,
    kind,
    status: o.status,
    outcome: (o.result_outcome as ScreeningOutcome | null) ?? null,
    orderedAt: o.ordered_at ?? o.created_at,
    completedAt: o.completed_at,
    orderedByYou: o.ordered_by_company_id === companyId,
  })

  return {
    dqFile,
    detail: {
      cdl: cdl
        ? {
            cdlClass: cdl.cdl_class,
            state: cdl.cdl_state,
            expiration: cdl.cdl_expiration,
            endorsements: cdl.endorsements ?? [],
            restrictions: cdl.restrictions ?? [],
          }
        : null,
      license: scan
        ? {
            hasFront: Boolean(scan.front_storage_path),
            hasBack: Boolean(scan.back_storage_path),
            barcodeStatus: scan.barcode_status,
            confirmedAt: scan.confirmed_at,
            licenseClass: fields?.licenseClass || null,
            state: fields?.state || null,
            expiration: fields?.expirationDate || null,
          }
        : null,
      dotApplication: newestDot
        ? {
            id: newestDot.id,
            currentStep: newestDot.current_step ?? 1,
            isComplete: Boolean(newestDot.is_complete),
            updatedAt: newestDot.updated_at,
          }
        : null,
      consent: newestConsent
        ? {
            id: newestConsent.id,
            status: newestConsent.status,
            createdAt: newestConsent.created_at,
            completedAt: newestConsent.completed_at,
            parts: {
              fcra: Boolean(newestConsent.bgcheck_consent_id),
              psp: Boolean(newestConsent.psp_consent_id),
              cdlis: Boolean(newestConsent.cdlis_signed_at),
            },
          }
        : null,
      screenings: [...rows.mvrOrders.map(toScreening('mvr')), ...rows.pspOrders.map(toScreening('psp'))],
      employmentVerifications: rows.employmentVerifications.map((r) => ({
        id: r.id,
        employerName: r.previous_employer_name,
        status: r.status,
        attemptCount: r.attempt_count ?? 0,
        lastAttemptAt: r.last_attempt_at,
        updatedAt: r.updated_at ?? r.created_at,
      })),
      invites: rows.invites.map((i) => ({
        id: i.id,
        blockType: i.target_block_type,
        status: i.status,
        createdAt: i.created_at,
        emailSentAt: i.email_sent_at,
        smsSentAt: i.sms_sent_at,
        viewCount: i.view_count ?? 0,
      })),
    },
  }
}


/**
 * Agency roster rule. A driver who signed up on their own belongs on the
 * platform agency's monitor. A driver another company invited does not —
 * that company brought them in, so they stay on that roster.
 *
 * Direct work with *this* company (an application, this company's own invite,
 * a request, an order) still counts. The exclusion only gates the automatic add.
 */
export function belongsOnSelfServeDqRoster(input: {
  role: string | null | undefined
  invitedByAnotherCompany: boolean
  isCompanyStaff: boolean
}): boolean {
  if (input.role === 'employer' || input.role === 'admin') return false
  if (input.isCompanyStaff) return false
  if (input.invitedByAnotherCompany) return false
  return true
}

const ROSTER_PAGE = 1000

async function eachPage<T>(
  label: string,
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += ROSTER_PAGE) {
    const { data, error } = await fetchPage(from, from + ROSTER_PAGE - 1)
    if (error) {
      console.error(`[DQ ROSTER] ${label}:`, error.message)
      break
    }
    if (!data?.length) break
    out.push(...data)
    if (data.length < ROSTER_PAGE) break
  }
  return out
}

/**
 * Drivers who created their own account, for an agency monitor.
 * Anyone claimed by a different company's invite is left out.
 */
async function loadSelfServeCandidateIds(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const [invites, staff, users] = await Promise.all([
    eachPage<{ used_by_user_id: string | null; candidate_user_id: string | null }>(
      'other-company invites',
      (from, to) =>
        supabase
          .from('application_invites')
          .select('used_by_user_id, candidate_user_id')
          .neq('company_id', companyId)
          .in('status', ['pending', 'viewed', 'in_progress', 'completed'])
          .order('id', { ascending: true })
          .range(from, to),
    ),
    eachPage<{ user_id: string | null }>('company staff', (from, to) =>
      supabase
        .from('company_members')
        .select('user_id')
        .eq('is_active', true)
        .not('accepted_at', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    eachPage<{ id: string; role: string | null }>('users', (from, to) =>
      supabase.from('users').select('id, role').order('id', { ascending: true }).range(from, to),
    ),
  ])

  const invitedElsewhere = new Set<string>()
  for (const invite of invites) {
    if (invite.used_by_user_id) invitedElsewhere.add(invite.used_by_user_id)
    if (invite.candidate_user_id) invitedElsewhere.add(invite.candidate_user_id)
  }
  const staffIds = new Set(staff.map((row) => row.user_id).filter((id): id is string => Boolean(id)))

  return users
    .filter((user) =>
      belongsOnSelfServeDqRoster({
        role: user.role,
        invitedByAnotherCompany: invitedElsewhere.has(user.id),
        isCompanyStaff: staffIds.has(user.id),
      }),
    )
    .map((user) => user.id)
}

/**
 * Who appears on this company's DQ monitor.
 * Every company sees people it is already working.
 * An agency (the full-suite tier — Pace is one; the switch is account_tier,
 * not the company name) also sees drivers who signed up on their own.
 */
export async function loadDqMonitorCandidateIds(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ ids: string[]; includesSelfServe: boolean }> {
  const engaged = await loadEngagedCandidateIds(supabase, companyId)

  const { data: company } = await supabase
    .from('companies')
    .select('account_tier')
    .eq('id', companyId)
    .maybeSingle()
  const includesSelfServe = toCompanyAccountTier(company?.account_tier) === 'agency'
  if (!includesSelfServe) return { ids: engaged, includesSelfServe }

  const selfServe = await loadSelfServeCandidateIds(supabase, companyId)
  return { ids: Array.from(new Set([...engaged, ...selfServe])), includesSelfServe }
}

/** Union of candidate user IDs this company is engaged with. */
export async function loadEngagedCandidateIds(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  // Job IDs first — nested filter on applications.job_postings.company_id is flaky in PostgREST.
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('id')
    .eq('company_id', companyId)
    .limit(500)

  const jobIds = (jobs ?? []).map((j) => j.id as string)

  // Prefer claimed invites + open/recent requests — dumping every historical
  // talent request (500+) made the roster a wall of empty "Unknown" rows and
  // blew PostgREST `.in()` URL limits on the batch status join.
  const [{ data: apps }, { data: invites }, { data: requests }, { data: mvrs }, { data: psps }, { data: bundles }] =
    await Promise.all([
      jobIds.length > 0
        ? fetchAllInChunks<{ applicant_user_id: string | null }>(
            jobIds,
            'applications',
            (chunk) =>
              supabase
                .from('applications')
                .select('applicant_user_id')
                .in('job_posting_id', chunk)
                .limit(500),
          ).then((data) => ({ data }))
        : Promise.resolve({ data: [] as { applicant_user_id: string | null }[] }),
      supabase
        .from('application_invites')
        .select('used_by_user_id, candidate_user_id, status')
        .eq('company_id', companyId)
        .in('status', ['pending', 'viewed', 'in_progress', 'completed'])
        .limit(500),
      supabase
        .from('candidate_requests')
        .select('candidate_user_id')
        .eq('company_id', companyId)
        .in('status', ['pending', 'viewed', 'completed'])
        .limit(500),
      supabase
        .from('mvr_orders')
        .select('driver_user_id')
        .eq('ordered_by_company_id', companyId)
        .limit(500),
      supabase
        .from('psp_orders')
        .select('driver_user_id')
        .eq('ordered_by_company_id', companyId)
        .limit(500),
      supabase
        .from('screening_consent_bundles')
        .select('driver_user_id')
        .eq('company_id', companyId)
        .limit(500),
    ])

  const ids = new Set<string>()
  for (const a of apps ?? []) {
    if (a.applicant_user_id) ids.add(a.applicant_user_id)
  }
  for (const i of invites ?? []) {
    // Claimed invite wins; otherwise only count pre-linked candidate when the
    // invite is still in flight (not a stale email-only row).
    if (i.used_by_user_id) {
      ids.add(i.used_by_user_id)
    } else if (
      i.candidate_user_id &&
      (i.status === 'pending' || i.status === 'viewed' || i.status === 'in_progress')
    ) {
      ids.add(i.candidate_user_id)
    }
  }
  for (const r of requests ?? []) {
    if (r.candidate_user_id) ids.add(r.candidate_user_id)
  }
  for (const o of mvrs ?? []) {
    if (o.driver_user_id) ids.add(o.driver_user_id)
  }
  for (const o of psps ?? []) {
    if (o.driver_user_id) ids.add(o.driver_user_id)
  }
  for (const b of bundles ?? []) {
    if (b.driver_user_id) ids.add(b.driver_user_id)
  }
  return Array.from(ids)
}

export interface DqMonitorCandidateRow {
  userId: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** "Class A · OH" for the row subtitle. Null when the driver hasn't entered a CDL. */
  cdl: { cdlClass: string | null; state: string | null } | null
  overallStatus: DqFileSnapshot['overall']
  completedCount: number
  totalLiveCount: number
  lastActivityAt: string | null
  /** Live DQ items only — enough for badges and journey derivation without the full snapshot. */
  items: Array<{ id: DqItemId; status: DqItemStatus }>
}

/**
 * Batch-resolve DQ rollups for the company monitor list.
 * Loads shared tables once, then resolves per candidate in memory.
 */
export async function loadDqMonitorList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ rows: DqMonitorCandidateRow[]; includesSelfServe: boolean }> {
  const { ids: candidateIds, includesSelfServe } = await loadDqMonitorCandidateIds(supabase, companyId)
  if (candidateIds.length === 0) return { rows: [], includesSelfServe }

  type ProfileRow = {
    user_id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    headline: string | null
  }
  type CdlSummaryRow = { user_id: string; cdl_class: string | null; cdl_state: string | null }
  type LiveConsentInviteRow = {
    used_by_user_id: string | null
    candidate_user_id: string | null
    created_at: string
  }
  type OrderRow = {
    id: string
    driver_user_id: string
    status: string
    completed_at?: string | null
    processed_at?: string | null
    ordered_at?: string | null
    created_at?: string | null
    expires_at?: string | null
  }
  type ConsentRow = {
    id: string
    driver_user_id: string
    status: string
    cdlis_signed_at?: string | null
    completed_at?: string | null
    created_at?: string | null
  }
  type DotRow = {
    id: string
    user_id: string
    is_complete?: boolean
    current_step?: number | null
    updated_at?: string | null
    created_at?: string | null
  }
  type EvRow = {
    id: string
    driver_id: string
    status: string
    finalized_at?: string | null
    updated_at?: string | null
    created_at?: string | null
  }

  // MVR/PSP: all pulls for the driver (portable). Consent / EV: this company only.
  type LicenseRow = {
    id: string
    user_id: string
    front_storage_path: string | null
    back_storage_path: string | null
    confirmed_at: string | null
    updated_at: string | null
  }

  const [profiles, mvrOrders, pspOrders, consentBundles, dotApps, evRows, licenseRows, cdlRows, liveConsentInvites] =
    await Promise.all([
      fetchAllInChunks<ProfileRow>(candidateIds, 'profiles', (chunk) =>
        supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, avatar_url, headline')
          .in('user_id', chunk),
      ),
      fetchAllInChunks<OrderRow>(candidateIds, 'mvr_orders', (chunk) =>
        supabase
          .from('mvr_orders')
          .select('id, driver_user_id, status, completed_at, processed_at, ordered_at, created_at, expires_at')
          .in('driver_user_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<OrderRow>(candidateIds, 'psp_orders', (chunk) =>
        supabase
          .from('psp_orders')
          .select('id, driver_user_id, status, completed_at, processed_at, ordered_at, created_at, expires_at')
          .in('driver_user_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<ConsentRow>(candidateIds, 'consent_bundles', (chunk) =>
        supabase
          .from('screening_consent_bundles')
          .select('id, driver_user_id, status, cdlis_signed_at, completed_at, created_at')
          .eq('company_id', companyId)
          .in('driver_user_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<DotRow>(candidateIds, 'dot_apps', (chunk) =>
        supabase
          .from('driver_applications')
          .select('id, user_id, is_complete, current_step, updated_at, created_at')
          .in('user_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<EvRow>(candidateIds, 'employment_verifications', (chunk) =>
        supabase
          .from('employment_verification_requests')
          .select('id, driver_id, status, finalized_at, updated_at, created_at')
          .eq('requesting_company_id', companyId)
          .in('driver_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<LicenseRow>(candidateIds, 'license_scans', (chunk) =>
        supabase
          .from('block_driver_license')
          .select('id, user_id, front_storage_path, back_storage_path, confirmed_at, updated_at')
          .in('user_id', chunk)
          .limit(1000),
      ),
      fetchAllInChunks<CdlSummaryRow>(candidateIds, 'cdl', (chunk) =>
        supabase.from('block_driver_cdl').select('user_id, cdl_class, cdl_state').in('user_id', chunk),
      ),
      // Consent invites still in flight — so "sent, unsigned" doesn't read as "missing".
      // Not chunked by candidate: an unclaimed invite only has candidate_user_id, and
      // the company-scoped set is small enough to fetch once.
      supabase
        .from('application_invites')
        .select('used_by_user_id, candidate_user_id, created_at')
        .eq('company_id', companyId)
        .eq('target_block_type', 'driver-screening-consent')
        .in('status', [...LIVE_INVITE_STATUSES])
        .order('created_at', { ascending: false })
        .limit(1000)
        .then(({ data }) => (data ?? []) as LiveConsentInviteRow[]),
    ])

  const profileById = new Map(
    profiles.map((p) => [
      p.user_id,
      {
        name: displayName(p.first_name, p.last_name),
        avatarUrl: p.avatar_url ?? null,
        headline: p.headline ?? null,
      },
    ]),
  )
  const cdlByUser = new Map(cdlRows.map((c) => [c.user_id, { cdlClass: c.cdl_class, state: c.cdl_state }]))
  // Newest first from the query, so the first write per user wins.
  const consentInviteAtByUser = new Map<string, string>()
  for (const inv of liveConsentInvites) {
    for (const id of [inv.used_by_user_id, inv.candidate_user_id]) {
      if (id && !consentInviteAtByUser.has(id)) consentInviteAtByUser.set(id, inv.created_at)
    }
  }

  const groupBy = <T>(rows: T[], key: keyof T): Map<string, T[]> => {
    const map = new Map<string, T[]>()
    for (const row of rows) {
      const id = row[key]
      if (typeof id !== 'string') continue
      const list = map.get(id) ?? []
      list.push(row)
      map.set(id, list)
    }
    return map
  }

  const mvrByUser = groupBy(mvrOrders, 'driver_user_id')
  const pspByUser = groupBy(pspOrders, 'driver_user_id')
  const consentByUser = groupBy(consentBundles, 'driver_user_id')
  const dotByUser = groupBy(dotApps, 'user_id')
  const evByUser = groupBy(evRows, 'driver_id')
  const licenseByUser = new Map(licenseRows.map((row) => [row.user_id, row]))

  const rows: DqMonitorCandidateRow[] = []

  for (const userId of candidateIds) {
    const mvr = mvrByUser.get(userId) ?? []
    const psp = pspByUser.get(userId) ?? []
    const consents = consentByUser.get(userId) ?? []
    const dots = dotByUser.get(userId) ?? []
    const evs = evByUser.get(userId) ?? []
    const license = licenseByUser.get(userId)

    const snapshot = resolveCompanyDqFile({
      mvrOrders: mvr.map((o) => ({
        id: o.id,
        status: o.status,
        completedAt: o.completed_at,
        processedAt: o.processed_at,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
        expiresAt: o.expires_at,
      })),
      pspOrders: psp.map((o) => ({
        id: o.id,
        status: o.status,
        completedAt: o.completed_at,
        processedAt: o.processed_at,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
        expiresAt: o.expires_at,
      })),
      consentBundles: consents.map((b) => ({
        id: b.id,
        status: b.status,
        cdlisSignedAt: b.cdlis_signed_at,
        completedAt: b.completed_at,
        createdAt: b.created_at,
      })),
      dotApplications: dots.map((a) => ({
        id: a.id,
        isComplete: Boolean(a.is_complete),
        currentStep: a.current_step,
        updatedAt: a.updated_at,
        createdAt: a.created_at,
      })),
      employmentVerifications: evs.map((r) => ({
        id: r.id,
        status: r.status,
        finalizedAt: r.finalized_at,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
      })),
      licenseScan: license
        ? {
            id: license.id,
            hasFront: Boolean(license.front_storage_path),
            hasBack: Boolean(license.back_storage_path),
            confirmedAt: license.confirmed_at,
            updatedAt: license.updated_at,
          }
        : null,
      pendingConsentInviteAt: consentInviteAtByUser.get(userId) ?? null,
    })

    const profile = profileById.get(userId)
    rows.push({
      userId,
      name: profile?.name ?? 'Unknown driver',
      avatarUrl: profile?.avatarUrl ?? null,
      headline: profile?.headline ?? null,
      cdl: cdlByUser.get(userId) ?? null,
      overallStatus: snapshot.overall,
      completedCount: snapshot.completedCount,
      totalLiveCount: snapshot.totalLiveCount,
      lastActivityAt: snapshot.lastActivityAt,
      items: snapshot.items.filter((i) => i.blocksOverallCompletion).map(({ id, status }) => ({ id, status })),
    })
  }

  // Most recently active first; then name.
  rows.sort((a, b) => {
    const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0
    const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0
    if (bt !== at) return bt - at
    return a.name.localeCompare(b.name)
  })

  return { rows, includesSelfServe }
}

/** Driver-lens snapshot for hub mirror. */
export async function loadDriverDqSnapshot(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<DqFileSnapshot> {
  const [
    { data: mvrOrders },
    { data: pspOrders },
    { data: consentBundles },
    { data: dotApps },
    { data: evRows },
    { data: pendingRequests },
  ] = await Promise.all([
    // All Accio pulls for this driver — payment column ignored (portable DQ).
    supabase
      .from('mvr_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at, expires_at, ordered_by_company_id')
      .eq('driver_user_id', driverUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('psp_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at, expires_at, ordered_by_company_id')
      .eq('driver_user_id', driverUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('screening_consent_bundles')
      .select('id, status, cdlis_signed_at, completed_at, created_at')
      .eq('driver_user_id', driverUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('driver_applications')
      .select('id, is_complete, current_step, updated_at, created_at')
      .eq('user_id', driverUserId)
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('employment_verification_requests')
      .select('id, status, finalized_at, updated_at, created_at')
      .eq('driver_id', driverUserId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('candidate_requests')
      .select('id, target_block_type, request_type, status, created_at')
      .eq('candidate_user_id', driverUserId)
      .in('status', ['pending', 'viewed'])
      .limit(50),
  ])

  const input: ResolveDriverDqInput = {
    mvrOrders: (mvrOrders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      completedAt: o.completed_at,
      processedAt: o.processed_at,
      orderedAt: o.ordered_at,
      createdAt: o.created_at,
      expiresAt: o.expires_at,
    })),
    pspOrders: (pspOrders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      completedAt: o.completed_at,
      processedAt: o.processed_at,
      orderedAt: o.ordered_at,
      createdAt: o.created_at,
      expiresAt: o.expires_at,
    })),
    consentBundles: (consentBundles ?? []).map((b) => ({
      id: b.id,
      status: b.status,
      cdlisSignedAt: b.cdlis_signed_at,
      completedAt: b.completed_at,
      createdAt: b.created_at,
    })),
    dotApplications: (dotApps ?? []).map((a) => ({
      id: a.id,
      isComplete: Boolean(a.is_complete),
      currentStep: a.current_step,
      updatedAt: a.updated_at,
      createdAt: a.created_at,
    })),
    employmentVerifications: (evRows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      finalizedAt: r.finalized_at,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    })),
    pendingRequests: (pendingRequests ?? []).map((r) => ({
      id: r.id,
      targetBlockType: r.target_block_type,
      requestType: r.request_type,
      status: r.status,
      createdAt: r.created_at,
    })),
    licenseScan: toDqLicenseScan(await getLicenseScan(supabase, driverUserId)),
  }

  return resolveDriverDqFile(input)
}
