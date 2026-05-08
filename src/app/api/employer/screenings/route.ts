import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'

/**
 * GET /api/employer/screenings
 *
 * Lists every MVR + PSP order this company paid for (`ordered_by_company_id = ctx.companyId`),
 * each joined to the candidate's identity via **`user_profiles`** (not the role-specific block tables).
 * Drives the "Purchased screenings" panel in the employer hub.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, walletAddress)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const [{ data: mvrOrders }, { data: pspOrders }] = await Promise.all([
      supabase
        .from('mvr_orders')
        .select(
          'id, driver_user_id, status, dl_state, ordered_at, created_at, completed_at, fee_amount',
        )
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('psp_orders')
        .select(
          'id, driver_user_id, status, dl_state, ordered_at, created_at, completed_at, fee_amount',
        )
        .eq('ordered_by_company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const candidateIds = Array.from(
      new Set([
        ...((mvrOrders ?? []).map((o) => o.driver_user_id).filter(Boolean) as string[]),
        ...((pspOrders ?? []).map((o) => o.driver_user_id).filter(Boolean) as string[]),
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
      (kind === 'mvr' ? mvrOrders ?? [] : pspOrders ?? []).map((o) => {
        const id = o.driver_user_id as string | null
        const c = id ? candidateById.get(id) : null
        const candidateName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || null
        return {
          id: o.id as string,
          kind,
          candidateUserId: id,
          candidateName,
          avatarUrl: c?.avatarUrl ?? null,
          status: o.status as string,
          dlState: o.dl_state as string | null,
          orderedAt: (o.ordered_at as string | null) ?? (o.created_at as string),
          completedAt: o.completed_at as string | null,
          feeAmount: o.fee_amount as number | string | null,
        }
      })

    return NextResponse.json({
      success: true,
      mvr: shape('mvr'),
      psp: shape('psp'),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMPLOYER SCREENINGS]', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
