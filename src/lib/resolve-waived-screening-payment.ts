import type { SupabaseClient } from '@supabase/supabase-js'

export type ScreeningPaymentType = 'MVR_ORDER' | 'PSP_ORDER'

type ResolvePaymentInput = {
  paymentTxHash?: string | null
  paymentType: ScreeningPaymentType
  userId: string
  companyId?: string | null
  candidateUserId?: string | null
}

type ResolvePaymentResult =
  | { ok: true; paymentId: string; resolvedTxHash: string | null }
  | { ok: false; error: string; status: number }

/**
 * USDC payments were removed in D3. When paymentTxHash is omitted, upsert a
 * synthetic waived payment row so duplicate checks and audit trails still work.
 */
export async function resolveScreeningPayment(
  supabase: SupabaseClient,
  input: ResolvePaymentInput,
): Promise<ResolvePaymentResult> {
  const { paymentTxHash, paymentType, userId, companyId = null, candidateUserId = null } = input

  if (paymentTxHash) {
    let payment = null

    const { data: exactPayment, error: exactError } = await supabase
      .from('payments')
      .select('id, status, amount_usdc, user_id, tx_hash, company_id, created_at')
      .eq('tx_hash', paymentTxHash)
      .eq('type', paymentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactPayment) {
      payment = exactPayment
    } else if (paymentTxHash.length > 66) {
      const legacyHash = paymentTxHash.substring(0, 66)
      const { data: legacyPayment, error: legacyError } = await supabase
        .from('payments')
        .select('id, status, amount_usdc, user_id, tx_hash, company_id, created_at')
        .eq('tx_hash', legacyHash)
        .eq('type', paymentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      payment = legacyPayment
      if (legacyError && !legacyPayment) {
        console.error('[SCREENING PAYMENT] legacy lookup error:', legacyError)
      }
    } else if (exactError) {
      console.error('[SCREENING PAYMENT] lookup error:', exactError)
      return { ok: false, error: 'Failed to verify payment. Please try again.', status: 500 }
    }

    if (!payment) {
      return { ok: false, error: 'Payment not found. Please complete payment before ordering.', status: 400 }
    }

    if (payment.status !== 'COMPLETED') {
      return { ok: false, error: 'Payment not completed. Please wait for payment confirmation.', status: 400 }
    }

    if (companyId && payment.company_id && payment.company_id !== companyId) {
      return { ok: false, error: 'This payment is tied to a different company', status: 403 }
    }

    return {
      ok: true,
      paymentId: payment.id as string,
      resolvedTxHash: payment.tx_hash as string,
    }
  }

  const syntheticTxHash =
    companyId && candidateUserId
      ? `waived-${companyId}-${candidateUserId}-${paymentType === 'MVR_ORDER' ? 'mvr' : 'psp'}`
      : `waived-${companyId ? `company-${companyId}` : `user-${userId}`}-${paymentType.toLowerCase()}`

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('tx_hash', syntheticTxHash)
    .eq('type', paymentType)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, paymentId: existing.id as string, resolvedTxHash: null }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('payments')
    .insert({
      tx_hash: syntheticTxHash,
      type: paymentType,
      status: 'COMPLETED',
      amount_usdc: 0,
      user_id: userId,
      company_id: companyId,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[SCREENING PAYMENT] waived insert:', insertErr)
    return { ok: false, error: 'Failed to record internal order', status: 500 }
  }

  return { ok: true, paymentId: inserted.id as string, resolvedTxHash: null }
}
