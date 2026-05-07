import type { SupabaseClient } from '@supabase/supabase-js'

export interface PlacePspMvrBundleDbParams {
  driverUserId: string
  orderNumber: string
  orderXml: string
  accioOrderId: string | null
  mvrSuborderId: string | null
  fmcsaSuborderId: string | null
  applicantPortalUrl: string | null
  dlNumber: string
  dlState: string
  expiresAtIso: string
  orderedByCompanyId?: string | null
  orderedByUserId?: string | null
  orderedByEmployer?: boolean | null
  paymentId?: string | null
  paymentTxHash?: string | null
}

/**
 * Inserts matching `mvr_orders` + `psp_orders` rows for a single Accio bundle
 * (same `accio_order_number`, different suborder IDs).
 */
export async function insertPspMvrBundleOrders(
  supabase: SupabaseClient,
  p: PlacePspMvrBundleDbParams,
): Promise<{ mvrOrderId: string; pspOrderId: string } | { error: string }> {
  const dl = p.dlNumber.trim()
  const st = p.dlState.trim().toUpperCase()

  const sharedEmployer = {
    ordered_by_company_id: p.orderedByCompanyId ?? null,
    ordered_by_user_id: p.orderedByUserId ?? null,
    ordered_by_employer: p.orderedByEmployer ?? Boolean(p.orderedByCompanyId),
  }

  const mvrRow: Record<string, unknown> = {
    driver_user_id: p.driverUserId,
    accio_order_number: p.orderNumber,
    accio_suborder_number: p.mvrSuborderId,
    accio_remote_order_number: p.accioOrderId,
    accio_remote_suborder_number: p.mvrSuborderId,
    order_type: 'MVR',
    mvr_search_type: 'standard',
    dl_number: dl,
    dl_state: st,
    status: 'pending',
    order_xml: p.orderXml,
    applicant_portal_url: p.applicantPortalUrl,
    expires_at: p.expiresAtIso,
    ...sharedEmployer,
  }

  if (p.paymentId) {
    mvrRow.payment_id = p.paymentId
    mvrRow.payment_tx_hash = p.paymentTxHash ?? null
  }

  const { data: mvrOrder, error: mvrErr } = await supabase.from('mvr_orders').insert(mvrRow).select('id').single()
  if (mvrErr || !mvrOrder) {
    console.error('[PSP+MVR BUNDLE] mvr_orders insert:', mvrErr)
    return { error: mvrErr?.message || 'Failed to store MVR order' }
  }

  const pspRow: Record<string, unknown> = {
    driver_user_id: p.driverUserId,
    payment_id: p.paymentId ?? null,
    payment_tx_hash: p.paymentTxHash ?? null,
    accio_order_number: p.orderNumber,
    accio_suborder_number: p.fmcsaSuborderId,
    accio_remote_order_number: p.accioOrderId,
    accio_remote_suborder_number: p.fmcsaSuborderId,
    dl_number: dl,
    dl_state: st,
    status: 'pending',
    order_xml: p.orderXml,
    expires_at: p.expiresAtIso,
    ...sharedEmployer,
  }

  const { data: pspOrder, error: pspErr } = await supabase.from('psp_orders').insert(pspRow).select('id').single()
  if (pspErr || !pspOrder) {
    console.error('[PSP+MVR BUNDLE] psp_orders insert:', pspErr)
    return { error: pspErr?.message || 'Failed to store PSP order' }
  }

  return { mvrOrderId: mvrOrder.id as string, pspOrderId: pspOrder.id as string }
}
