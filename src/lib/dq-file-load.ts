/**
 * Supabase loaders for DQ file snapshots.
 * Keeps route handlers thin — gather rows, then call resolve* from dq-file-status.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveCompanyDqFile,
  resolveDriverDqFile,
  type DqFileSnapshot,
  type ResolveCompanyDqInput,
  type ResolveDriverDqInput,
} from '@/lib/dq-file-status'
import { fetchAllInChunks } from '@/lib/supabase-in-chunks'

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = 'Unknown driver',
): string {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || fallback
}

/** Load company-lens inputs for one candidate. */
export async function loadCompanyDqInput(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
  hireDate?: string | null,
): Promise<ResolveCompanyDqInput> {
  const [
    { data: mvrOrders },
    { data: pspOrders },
    { data: consentBundles },
    { data: dotApps },
    { data: evRows },
  ] = await Promise.all([
    supabase
      .from('mvr_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('psp_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('screening_consent_bundles')
      .select('id, status, cdlis_signed_at, completed_at, created_at')
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
      .select('id, status, finalized_at, updated_at, created_at')
      .eq('requesting_company_id', companyId)
      .eq('driver_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    mvrOrders: (mvrOrders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      completedAt: o.completed_at,
      processedAt: o.processed_at,
      orderedAt: o.ordered_at,
      createdAt: o.created_at,
    })),
    pspOrders: (pspOrders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      completedAt: o.completed_at,
      processedAt: o.processed_at,
      orderedAt: o.ordered_at,
      createdAt: o.created_at,
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
    hireDate: hireDate ?? null,
  }
}

export async function resolveCompanyDqForCandidate(
  supabase: SupabaseClient,
  companyId: string,
  candidateUserId: string,
  hireDate?: string | null,
): Promise<DqFileSnapshot> {
  const input = await loadCompanyDqInput(supabase, companyId, candidateUserId, hireDate)
  return resolveCompanyDqFile(input)
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
  overallStatus: DqFileSnapshot['overall']
  completedCount: number
  totalLiveCount: number
  lastActivityAt: string | null
}

/**
 * Batch-resolve DQ rollups for the company monitor list.
 * Loads shared tables once, then resolves per candidate in memory.
 */
export async function loadDqMonitorList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<DqMonitorCandidateRow[]> {
  const candidateIds = await loadEngagedCandidateIds(supabase, companyId)
  if (candidateIds.length === 0) return []

  type ProfileRow = {
    user_id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
  type OrderRow = {
    id: string
    driver_user_id: string
    status: string
    completed_at?: string | null
    processed_at?: string | null
    ordered_at?: string | null
    created_at?: string | null
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

  const [profiles, mvrOrders, pspOrders, consentBundles, dotApps, evRows] = await Promise.all([
    fetchAllInChunks<ProfileRow>(candidateIds, 'profiles', (chunk) =>
      supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', chunk),
    ),
    fetchAllInChunks<OrderRow>(candidateIds, 'mvr_orders', (chunk) =>
      supabase
        .from('mvr_orders')
        .select('id, driver_user_id, status, completed_at, processed_at, ordered_at, created_at')
        .eq('ordered_by_company_id', companyId)
        .in('driver_user_id', chunk)
        .limit(1000),
    ),
    fetchAllInChunks<OrderRow>(candidateIds, 'psp_orders', (chunk) =>
      supabase
        .from('psp_orders')
        .select('id, driver_user_id, status, completed_at, processed_at, ordered_at, created_at')
        .eq('ordered_by_company_id', companyId)
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
  ])

  const profileById = new Map(
    profiles.map((p) => [
      p.user_id,
      {
        name: displayName(p.first_name, p.last_name),
        avatarUrl: p.avatar_url ?? null,
      },
    ]),
  )

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

  const rows: DqMonitorCandidateRow[] = []

  for (const userId of candidateIds) {
    const mvr = mvrByUser.get(userId) ?? []
    const psp = pspByUser.get(userId) ?? []
    const consents = consentByUser.get(userId) ?? []
    const dots = dotByUser.get(userId) ?? []
    const evs = evByUser.get(userId) ?? []

    const snapshot = resolveCompanyDqFile({
      mvrOrders: mvr.map((o) => ({
        id: o.id,
        status: o.status,
        completedAt: o.completed_at,
        processedAt: o.processed_at,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
      })),
      pspOrders: psp.map((o) => ({
        id: o.id,
        status: o.status,
        completedAt: o.completed_at,
        processedAt: o.processed_at,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
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
    })

    const profile = profileById.get(userId)
    rows.push({
      userId,
      name: profile?.name ?? 'Unknown driver',
      avatarUrl: profile?.avatarUrl ?? null,
      overallStatus: snapshot.overall,
      completedCount: snapshot.completedCount,
      totalLiveCount: snapshot.totalLiveCount,
      lastActivityAt: snapshot.lastActivityAt,
    })
  }

  // Most recently active first; then name.
  rows.sort((a, b) => {
    const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0
    const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0
    if (bt !== at) return bt - at
    return a.name.localeCompare(b.name)
  })

  return rows
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
    supabase
      .from('mvr_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at, ordered_by_company_id')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('psp_orders')
      .select('id, status, completed_at, processed_at, ordered_at, created_at, ordered_by_company_id')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
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
    })),
    pspOrders: (pspOrders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      completedAt: o.completed_at,
      processedAt: o.processed_at,
      orderedAt: o.ordered_at,
      createdAt: o.created_at,
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
  }

  return resolveDriverDqFile(input)
}
