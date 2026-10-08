import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getAppBaseUrl } from '@/lib/app-url'
import {
  createScreeningCheckout,
  findDriverScreeningCredit,
  getScreeningPrice,
  isScreeningCheckoutConfigured,
  parsePaidScreeningKind,
} from '@/lib/screening-stripe-payment'

/**
 * Driver-initiated MVR payment (DEC-2026-10-001).
 *
 * GET  ?kind=mvr → { paid, price } — does this driver already hold an unused paid session?
 * POST { kind }  → { url }         — open Stripe Checkout; the driver is sent back to the block.
 *
 * Company-sponsored orders never touch this route. PSP is employer-ordered only.
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const kind = parsePaidScreeningKind(request.nextUrl.searchParams.get('kind'))
    if (!kind) return NextResponse.json({ error: 'kind must be mvr' }, { status: 400 })
    if (!isScreeningCheckoutConfigured(kind)) {
      return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })
    }

    const supabase = await getAdminSupabaseClient()
    const [credit, price] = await Promise.all([
      findDriverScreeningCredit(supabase, userId, kind),
      getScreeningPrice(kind),
    ])
    return NextResponse.json({ paid: Boolean(credit), price })
  } catch (error) {
    console.error('[SCREENING CHECKOUT] status error:', error)
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as { kind?: string }
    const kind = parsePaidScreeningKind(body.kind)
    if (!kind) return NextResponse.json({ error: 'kind must be mvr' }, { status: 400 })
    if (!isScreeningCheckoutConfigured(kind)) {
      return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()

    const url = await createScreeningCheckout(supabase, {
      userId,
      email: user?.email ?? null,
      kind,
      appBaseUrl: getAppBaseUrl(request),
    })
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[SCREENING CHECKOUT] create error:', error)
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 })
  }
}
