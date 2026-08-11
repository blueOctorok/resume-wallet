import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { reconcilePendingScreeningsForCompany } from '@/lib/reconcile-pending-screenings'
import { syncOutreachInvitesForCompany } from '@/lib/sync-outreach-invite-status'
import { can, capabilityDeniedMessage } from '@/lib/employer-permissions'

/**
 * POST /api/employer/screenings/reconcile
 *
 * Pulls results from Accio for stuck pending MVR/PSP orders (30+ min old) and
 * imports them the same way webhooks would. Use when Key shows complete but
 * Storm is still "processing".
 *
 * Body (optional):
 *   { orderId?: string, kind?: 'mvr' | 'psp' }
 */
export async function POST(request: NextRequest) {
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

    // Reconcile imports MVR/PSP results from Accio, so it lands Tier 2 data in
    // the company's account — same gate as placing the order.
    if (!can(ctx.companyRole, 'orderScreenings')) {
      return NextResponse.json(
        { error: capabilityDeniedMessage('orderScreenings') },
        { status: 403 }
      )
    }

    let body: { orderId?: string; kind?: 'mvr' | 'psp'; staleMinutes?: number } = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine — reconcile all stale for company
    }

    const results = await reconcilePendingScreeningsForCompany(supabase, ctx.companyId, {
      orderId: body.orderId,
      kind: body.kind,
      staleMinutes: body.staleMinutes,
    })

    const reconciled = results.filter((r) => r.action === 'reconciled').length
    const stillPending = results.filter((r) => r.action === 'still_pending').length
    const errors = results.filter(
      (r) => r.action === 'accio_error' || r.action === 'process_error',
    ).length

    const outreachSync = await syncOutreachInvitesForCompany(supabase, ctx.companyId)

    console.log('[EMPLOYER RECONCILE]', {
      companyId: ctx.companyId,
      checked: results.length,
      reconciled,
      stillPending,
      errors,
      invitesCompleted: outreachSync.updated,
    })

    return NextResponse.json({
      success: true,
      checked: results.length,
      reconciled,
      stillPending,
      errors,
      invitesCompleted: outreachSync.updated,
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMPLOYER RECONCILE]', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
