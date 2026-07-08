import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { deriveScreeningStatus } from '@/lib/accio-result-status'
import { parseAccioMvrResult, mvrResultToJsonb } from '@/lib/accio-xml-parser'
import { parsePspResult, pspResultToJsonb } from '@/lib/accio-psp-parser'
import { saveMvrData } from '@/lib/block-data'

/**
 * POST /api/admin/reparse-screening-results
 *
 * One-time admin action to re-process all existing MVR + PSP orders using
 * the latest parser logic.  Useful after fixing parser bugs (e.g. the
 * personalCharacteristics label-capture bug, dmvAsOfDate newline crossing)
 * so that stored `parsed_data` reflects the corrected output without needing
 * to re-fetch from Accio.
 *
 * Body (optional JSON):
 *   { "type": "mvr" | "psp" | "all" }   — defaults to "all"
 *   { "dryRun": true }                   — parse + diff but don't write
 *
 * Returns:
 *   { mvr: { processed, updated, errors }, psp: { processed, updated, errors } }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const body = await request.json().catch(() => ({})) as {
    type?: 'mvr' | 'psp' | 'all'
    dryRun?: boolean
  }
  const runType = body.type ?? 'all'
  const dryRun = body.dryRun === true

  const supabase = await getAdminSupabaseClient()

  const mvrStats = { processed: 0, updated: 0, errors: 0 }
  const pspStats = { processed: 0, updated: 0, errors: 0 }

  // YYYYMMDD → YYYY-MM-DD (string-only, no Date round-trip). Mirrors the
  // webhook's formatDateForDb so reparsed rows match webhook-written rows.
  const formatDateForDb = (dateStr: string | undefined): string | null => {
    if (!dateStr || dateStr.length !== 8) return null
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  }

  // ── MVR ───────────────────────────────────────────────────────────────────

  if (runType === 'mvr' || runType === 'all') {
    const { data: mvrOrders, error: mvrErr } = await supabase
      .from('mvr_orders')
      .select('id, driver_user_id, result_xml, ordered_by_company_id')
      .not('result_xml', 'is', null)
      .order('created_at', { ascending: true })

    if (mvrErr) {
      console.error('[REPARSE] MVR orders fetch error:', mvrErr)
      return NextResponse.json({ error: 'Failed to fetch MVR orders' }, { status: 500 })
    }

    for (const order of mvrOrders ?? []) {
      mvrStats.processed++
      try {
        const parsed = parseAccioMvrResult(order.result_xml as string)
        const jsonb = mvrResultToJsonb(parsed)

        if (!dryRun) {
          const { status, outcome } = deriveScreeningStatus({
            filledStatus: parsed.filledStatus,
            filledCode: parsed.filledCode,
            heldForReview: parsed.heldForReview,
          })

          const { error: orderUpdateErr } = await supabase
            .from('mvr_orders')
            .update({
              status,
              result_outcome: outcome,
            })
            .eq('id', order.id)

          if (orderUpdateErr) {
            console.error(`[REPARSE] MVR order status update error for ${order.id}:`, orderUpdateErr)
            mvrStats.errors++
            continue
          }

          // Refresh parsed_data AND the flat columns the UI reads directly
          // (license_class/status/etc.) — updating only the JSONB would leave
          // stale pre-fix values visible in the modal and career card.
          const primaryLicense = parsed.licenses?.[0] ?? null
          const safe = (v: string | undefined | null, max = 1000): string | null =>
            v ? v.slice(0, max) : null

          const { error: updateErr } = await supabase
            .from('mvr_results')
            .update({
              parsed_data: jsonb,
              parsed_at: new Date().toISOString(),
              license_number: safe(parsed.licenseNumber, 50),
              license_state: safe(parsed.licenseState, 2),
              license_class: safe(primaryLicense?.class),
              license_status: safe(primaryLicense?.status),
              license_expiration_date:
                formatDateForDb(primaryLicense?.expirationDate) ??
                formatDateForDb(parsed.licenseExpirationDate),
              total_points: parsed.totalPoints ?? 0,
              violation_count: parsed.violationCount ?? 0,
              violations: parsed.violations ?? [],
              accident_count: parsed.accidentCount ?? 0,
              accidents: parsed.accidents ?? [],
              suspension_count: parsed.suspensionCount ?? 0,
              suspensions: parsed.suspensions ?? [],
              medical_cert_expiration: parsed.medicalCertExpiration ?? null,
              medical_cert_status: parsed.medicalCertStatus ?? null,
              cdl_endorsements: primaryLicense?.endorsements ? [primaryLicense.endorsements] : [],
              cdl_restrictions: primaryLicense?.restrictions ? [primaryLicense.restrictions] : [],
            })
            .eq('mvr_order_id', order.id)

          if (updateErr) {
            console.error(`[REPARSE] MVR results update error for order ${order.id}:`, updateErr)
            mvrStats.errors++
            continue
          }

          // Refresh block_driver_mvr summary cache (only for candidate-owned orders)
          if (!order.ordered_by_company_id) {
            const primaryStatus = parsed.licenses?.[0]?.status ?? null
            await saveMvrData(supabase, order.driver_user_id as string, {
              license_status: primaryStatus,
              total_points: parsed.totalPoints ?? 0,
              violation_count: parsed.violationCount ?? 0,
              violations: (parsed.violations ?? []).map((v) => ({
                date: v.date ?? '',
                violation: v.description ?? v.type ?? '',
                state: v.state ?? '',
                points: v.points ?? 0,
              })),
              accidents: (parsed.accidents ?? []).map((a) => ({
                date: a.date ?? '',
                description: a.description ?? '',
                atFault: false,
                injuries: false,
                fatalities: false,
              })),
            })
          }
        }

        mvrStats.updated++
      } catch (err) {
        console.error(`[REPARSE] MVR parse error for order ${order.id}:`, err)
        mvrStats.errors++
      }
    }
  }

  // ── PSP ───────────────────────────────────────────────────────────────────

  if (runType === 'psp' || runType === 'all') {
    const { data: pspOrders, error: pspErr } = await supabase
      .from('psp_orders')
      .select('id, result_xml')
      .not('result_xml', 'is', null)
      .order('created_at', { ascending: true })

    if (pspErr) {
      console.error('[REPARSE] PSP orders fetch error:', pspErr)
      return NextResponse.json({ error: 'Failed to fetch PSP orders' }, { status: 500 })
    }

    for (const order of pspOrders ?? []) {
      pspStats.processed++
      try {
        const parsed = parsePspResult(order.result_xml as string)
        const jsonb = pspResultToJsonb(parsed)

        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from('psp_results')
            .update({ parsed_data: jsonb, parsed_at: new Date().toISOString() })
            .eq('psp_order_id', order.id)

          if (updateErr) {
            console.error(`[REPARSE] PSP results update error for order ${order.id}:`, updateErr)
            pspStats.errors++
            continue
          }
        }

        pspStats.updated++
      } catch (err) {
        console.error(`[REPARSE] PSP parse error for order ${order.id}:`, err)
        pspStats.errors++
      }
    }
  }

  console.log('[REPARSE] Complete:', { dryRun, runType, mvr: mvrStats, psp: pspStats })

  return NextResponse.json({
    success: true,
    dryRun,
    runType,
    mvr: mvrStats,
    psp: pspStats,
  })
}
