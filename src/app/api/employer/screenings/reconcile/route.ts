import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { reconcilePendingScreeningsForCompany } from '@/lib/reconcile-pending-screenings'
import { syncOutreachInvitesForCompany } from '@/lib/sync-outreach-invite-status'

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
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, walletAddress)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
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
