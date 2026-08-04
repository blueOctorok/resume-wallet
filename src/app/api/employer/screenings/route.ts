import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { fetchAllInChunks } from '@/lib/supabase-in-chunks'

type OrderRow = {
  id: string
  driver_user_id: string | null
  status: string
  result_outcome: string | null
  dl_state: string | null
  dl_number: string | null
  error_code: string | null
  error_message: string | null
  ordered_at: string | null
  created_at: string
  completed_at: string | null
  processed_at: string | null
  fee_amount: number | string | null
  ordered_by_company_id: string | null
}

const ORDER_SELECT =
  'id, driver_user_id, status, result_outcome, dl_state, dl_number, error_code, error_message, ordered_at, created_at, completed_at, processed_at, fee_amount, ordered_by_company_id'

/**
 * Page through all consent bundles for the company (Pace has 500+).
 * A single `.limit(500)` dropped older drivers from the driver-owned join.
 */
async function fetchAllConsentBundles(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  companyId: string,
) {
  const pageSize = 1000
  const all: Array<Record<string, unknown>> = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('screening_consent_bundles')
      .select(
        'id, driver_user_id, status, completed_at, created_at, bgcheck_consent_id, psp_consent_id, cdlis_signed_at, cdlis_signed_name',
      )
      .eq('company_id', companyId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1)
    if (error) {
      console.error('[EMPLOYER SCREENINGS] consent page error:', error.message)
      break
    }
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

/**
 * GET /api/employer/screenings
 *
 * Lists MVR + PSP orders visible to this company:
 *   - Company-paid (`ordered_by_company_id = companyId`)
 *   - Driver-owned (`ordered_by_company_id IS NULL`) when a complete
 *     screening_consent_bundles row exists for that candidate (P3.4-C)
 *
 * Joins candidate identity via user_profiles.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    // resolveEmployerCompanyForWallet resolves by session user id since the D3.4 auth
    // cutover — NOT a wallet address. Passing wallet_address here matched no users.id
    // (uuid) and silently 403'd the entire outreach screenings/consent surface.
    const ctx = await resolveEmployerCompanyForWallet(supabase, userId)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const [{ data: mvrOrders }, { data: pspOrders }, consentBundles] = await Promise.all([
      supabase
        .from('mvr_orders')
        .select(ORDER_SELECT)
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('psp_orders')
        .select(ORDER_SELECT)
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(2000),
      fetchAllConsentBundles(supabase, ctx.companyId),
    ])

    const consentDriverIds = Array.from(
      new Set(
        consentBundles
          .filter((b) => b.status === 'complete' && b.driver_user_id)
          .map((b) => b.driver_user_id as string),
      ),
    )

    // Driver-owned pulls after consent — MUST chunk `.in()`. A single
    // `.in(driver_user_id, 500 UUIDs)` was silently empty, so outreach showed
    // "Awaiting candidate orders" for people who already had MVR+PSP (e.g. Hardin).
    const [driverOwnedMvr, driverOwnedPsp] = await Promise.all([
      fetchAllInChunks<OrderRow>(consentDriverIds, 'driver-owned mvr', (chunk) =>
        supabase
          .from('mvr_orders')
          .select(ORDER_SELECT)
          .is('ordered_by_company_id', null)
          .in('driver_user_id', chunk)
          .order('created_at', { ascending: false })
          .limit(1000),
      ),
      fetchAllInChunks<OrderRow>(consentDriverIds, 'driver-owned psp', (chunk) =>
        supabase
          .from('psp_orders')
          .select(ORDER_SELECT)
          .is('ordered_by_company_id', null)
          .in('driver_user_id', chunk)
          .order('created_at', { ascending: false })
          .limit(1000),
      ),
    ])

    const mergedMvr: OrderRow[] = [
      ...((mvrOrders ?? []) as OrderRow[]),
      ...driverOwnedMvr,
    ]
    const mergedPsp: OrderRow[] = [
      ...((pspOrders ?? []) as OrderRow[]),
      ...driverOwnedPsp,
    ]

    const candidateIds = Array.from(
      new Set([
        ...(mergedMvr.map((o) => o.driver_user_id).filter(Boolean) as string[]),
        ...(mergedPsp.map((o) => o.driver_user_id).filter(Boolean) as string[]),
        ...(consentBundles.map((b) => b.driver_user_id).filter(Boolean) as string[]),
      ]),
    )

    // Identity (name/avatar/headline) lives in user_profiles for ALL roles. Block tables
    // do not store names — see .cursor/rules/block-development.mdc.
    const candidateById = new Map<
      string,
      { firstName: string | null; lastName: string | null; avatarUrl: string | null }
    >()
    const profiles = await fetchAllInChunks<{
      user_id: string
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    }>(candidateIds, 'screening profiles', (chunk) =>
      supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', chunk),
    )
    for (const p of profiles) {
      candidateById.set(p.user_id, {
        firstName: p.first_name ?? null,
        lastName: p.last_name ?? null,
        avatarUrl: p.avatar_url ?? null,
      })
    }

    const shape = (kind: 'mvr' | 'psp') =>
      (kind === 'mvr' ? mergedMvr : mergedPsp).map((o) => {
        const id = o.driver_user_id
        const c = id ? candidateById.get(id) : null
        const candidateName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || null
        const driverOwned = o.ordered_by_company_id == null
        return {
          id: o.id,
          kind,
          candidateUserId: id,
          candidateName,
          avatarUrl: c?.avatarUrl ?? null,
          status: o.status,
          resultOutcome: o.result_outcome ?? null,
          dlState: o.dl_state,
          dlNumber: o.dl_number ?? null,
          errorCode: o.error_code ?? null,
          errorMessage: o.error_message ?? null,
          orderedAt: o.ordered_at ?? o.created_at,
          processedAt: o.processed_at ?? null,
          completedAt: o.completed_at,
          feeAmount: o.fee_amount,
          driverOwned,
        }
      })

    const bgIds = consentBundles
      .map((b) => b.bgcheck_consent_id)
      .filter(Boolean) as string[]
    const pspConsentIds = consentBundles
      .map((b) => b.psp_consent_id)
      .filter(Boolean) as string[]

    const [bgRows, pspRows] = await Promise.all([
      fetchAllInChunks<{ id: string; signed_name: string; signed_at: string }>(
        bgIds,
        'bgcheck_consents',
        (chunk) =>
          supabase.from('bgcheck_consents').select('id, signed_name, signed_at').in('id', chunk),
      ),
      fetchAllInChunks<{
        id: string
        signed_name: string
        signed_at: string
        form_version: string
      }>(pspConsentIds, 'psp_consents', (chunk) =>
        supabase
          .from('psp_consents')
          .select('id, signed_name, signed_at, form_version')
          .in('id', chunk),
      ),
    ])

    const bgById = new Map(bgRows.map((r) => [r.id, r]))
    const pspById = new Map(pspRows.map((r) => [r.id, r]))

    const consentBundleSummaries = consentBundles.map((b) => {
      const bg = b.bgcheck_consent_id
        ? bgById.get(b.bgcheck_consent_id as string)
        : null
      const psp = b.psp_consent_id ? pspById.get(b.psp_consent_id as string) : null
      const driverId = b.driver_user_id as string
      const c = driverId ? candidateById.get(driverId) : null
      return {
        id: b.id as string,
        driverUserId: driverId,
        candidateName: c
          ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || null
          : null,
        avatarUrl: c?.avatarUrl ?? null,
        status: b.status as string,
        completedAt: b.completed_at as string | null,
        createdAt: b.created_at as string,
        cdlisSignedAt: b.cdlis_signed_at as string | null,
        cdlisSignedName: b.cdlis_signed_name as string | null,
        bg: bg ? { signedName: bg.signed_name, signedAt: bg.signed_at } : null,
        psp: psp
          ? {
              signedName: psp.signed_name,
              signedAt: psp.signed_at,
              formVersion: psp.form_version,
            }
          : null,
      }
    })

    return NextResponse.json({
      success: true,
      mvr: shape('mvr'),
      psp: shape('psp'),
      consentBundles: consentBundleSummaries,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMPLOYER SCREENINGS]', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
