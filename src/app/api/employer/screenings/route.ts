import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'

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

    // 500 per kind is plenty for any single company in normal usage — covers years
    // of orders before we'd need real pagination. Both the Active outreach tab and
    // the Files vault tab share this single fetch, so we read once and group client-side.
    const [{ data: mvrOrders }, { data: pspOrders }, { data: consentBundles }] = await Promise.all([
      supabase
        .from('mvr_orders')
        .select(
          'id, driver_user_id, status, result_outcome, dl_state, dl_number, error_code, error_message, ordered_at, created_at, completed_at, processed_at, fee_amount, ordered_by_company_id',
        )
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('psp_orders')
        .select(
          'id, driver_user_id, status, result_outcome, dl_state, dl_number, error_code, error_message, ordered_at, created_at, completed_at, processed_at, fee_amount, ordered_by_company_id',
        )
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('screening_consent_bundles')
        .select(
          'id, driver_user_id, status, completed_at, created_at, bgcheck_consent_id, psp_consent_id, cdlis_signed_at, cdlis_signed_name',
        )
        .eq('company_id', ctx.companyId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(500),
    ])

    const consentDriverIds = Array.from(
      new Set(
        (consentBundles ?? [])
          .filter((b) => b.status === 'complete' && b.driver_user_id)
          .map((b) => b.driver_user_id as string),
      ),
    )

    let driverOwnedMvr: typeof mvrOrders = []
    let driverOwnedPsp: typeof pspOrders = []
    if (consentDriverIds.length > 0) {
      const [{ data: domvr }, { data: dosp }] = await Promise.all([
        supabase
          .from('mvr_orders')
          .select(
            'id, driver_user_id, status, result_outcome, dl_state, dl_number, error_code, error_message, ordered_at, created_at, completed_at, processed_at, fee_amount, ordered_by_company_id',
          )
          .is('ordered_by_company_id', null)
          .in('driver_user_id', consentDriverIds)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('psp_orders')
          .select(
            'id, driver_user_id, status, result_outcome, dl_state, dl_number, error_code, error_message, ordered_at, created_at, completed_at, processed_at, fee_amount, ordered_by_company_id',
          )
          .is('ordered_by_company_id', null)
          .in('driver_user_id', consentDriverIds)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      driverOwnedMvr = domvr ?? []
      driverOwnedPsp = dosp ?? []
    }

    const mergedMvr = [...(mvrOrders ?? []), ...driverOwnedMvr]
    const mergedPsp = [...(pspOrders ?? []), ...driverOwnedPsp]

    const candidateIds = Array.from(
      new Set([
        ...(mergedMvr.map((o) => o.driver_user_id).filter(Boolean) as string[]),
        ...(mergedPsp.map((o) => o.driver_user_id).filter(Boolean) as string[]),
        ...((consentBundles ?? []).map((b) => b.driver_user_id).filter(Boolean) as string[]),
      ]),
    )

    // Identity (name/avatar/headline) lives in user_profiles for ALL roles. Block tables
    // do not store names — see .cursor/rules/block-development.mdc.
    const candidateById = new Map<
      string,
      { firstName: string | null; lastName: string | null; avatarUrl: string | null }
    >()
    if (candidateIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', candidateIds)

      for (const p of profiles ?? []) {
        candidateById.set(p.user_id as string, {
          firstName: p.first_name ?? null,
          lastName: p.last_name ?? null,
          avatarUrl: p.avatar_url ?? null,
        })
      }
    }

    const shape = (kind: 'mvr' | 'psp') =>
      (kind === 'mvr' ? mergedMvr : mergedPsp).map((o) => {
        const id = o.driver_user_id as string | null
        const c = id ? candidateById.get(id) : null
        const candidateName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || null
        const driverOwned = o.ordered_by_company_id == null
        return {
          id: o.id as string,
          kind,
          candidateUserId: id,
          candidateName,
          avatarUrl: c?.avatarUrl ?? null,
          status: o.status as string,
          // Accio outcome (clear/hits/etc) from src/lib/accio-result-status.ts
          resultOutcome: (o.result_outcome as string | null) ?? null,
          dlState: o.dl_state as string | null,
          dlNumber: (o.dl_number as string | null) ?? null,
          errorCode: (o.error_code as string | null) ?? null,
          errorMessage: (o.error_message as string | null) ?? null,
          orderedAt: (o.ordered_at as string | null) ?? (o.created_at as string),
          processedAt: (o.processed_at as string | null) ?? null,
          completedAt: o.completed_at as string | null,
          feeAmount: o.fee_amount as number | string | null,
          driverOwned,
        }
      })

    const bgIds = (consentBundles ?? [])
      .map((b) => b.bgcheck_consent_id)
      .filter(Boolean) as string[]
    const pspIds = (consentBundles ?? [])
      .map((b) => b.psp_consent_id)
      .filter(Boolean) as string[]

    const [{ data: bgRows }, { data: pspRows }] = await Promise.all([
      bgIds.length
        ? supabase.from('bgcheck_consents').select('id, signed_name, signed_at').in('id', bgIds)
        : Promise.resolve({ data: [] as { id: string; signed_name: string; signed_at: string }[] }),
      pspIds.length
        ? supabase.from('psp_consents').select('id, signed_name, signed_at, form_version').in('id', pspIds)
        : Promise.resolve({ data: [] as { id: string; signed_name: string; signed_at: string; form_version: string }[] }),
    ])

    const bgById = new Map((bgRows ?? []).map((r) => [r.id, r]))
    const pspById = new Map((pspRows ?? []).map((r) => [r.id, r]))

    const consentBundleSummaries = (consentBundles ?? []).map((b) => {
      const bg = b.bgcheck_consent_id ? bgById.get(b.bgcheck_consent_id as string) : null
      const psp = b.psp_consent_id ? pspById.get(b.psp_consent_id as string) : null
      const driverId = b.driver_user_id as string
      const c = driverId ? candidateById.get(driverId) : null
      return {
        id: b.id as string,
        driverUserId: driverId,
        candidateName: c ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || null : null,
        avatarUrl: c?.avatarUrl ?? null,
        status: b.status as string,
        completedAt: b.completed_at as string | null,
        createdAt: b.created_at as string,
        cdlisSignedAt: b.cdlis_signed_at as string | null,
        cdlisSignedName: b.cdlis_signed_name as string | null,
        bg: bg
          ? { signedName: bg.signed_name, signedAt: bg.signed_at }
          : null,
        psp: psp
          ? { signedName: psp.signed_name, signedAt: psp.signed_at, formVersion: psp.form_version }
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
