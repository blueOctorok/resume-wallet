import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'

/**
 * POST /api/psp/payment — record USDC payment before Accio PSP order (candidate or employer wallet).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      txHash,
      amountUsdc,
      walletAddress,
      userType = 'applicant',
      companyId: companyIdRaw,
      paidByWalletAddress,
    } = body

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }
    if (!amountUsdc) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payerLookupAddress =
      typeof paidByWalletAddress === 'string' && paidByWalletAddress.trim()
        ? paidByWalletAddress.trim()
        : walletAddress

    let user: { id: string }
    try {
      const { user: u } = await getOrCreateUserByWallet(supabase, payerLookupAddress)
      user = { id: u.id }
    } catch (err) {
      console.error('[PSP PAYMENT] get/create user:', err)
      return NextResponse.json(
        { error: 'Failed to get or create user record', details: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      )
    }

    let companyId: string | null = null
    if (typeof companyIdRaw === 'string' && companyIdRaw.trim()) {
      const { data: co } = await supabase
        .from('companies')
        .select('id, wallet_address')
        .eq('id', companyIdRaw.trim())
        .maybeSingle()
      if (co?.wallet_address && co.wallet_address.toLowerCase() === String(walletAddress).toLowerCase()) {
        companyId = co.id
      } else {
        console.warn('[PSP PAYMENT] Ignoring companyId: does not match payer wallet', { companyIdRaw, walletAddress })
      }
    }

    const normalizedTxHash = txHash.trim()

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, tx_hash, amount_usdc, user_id')
      .eq('tx_hash', normalizedTxHash)
      .eq('type', 'PSP_ORDER')
      .maybeSingle()

    if (existingPayment) {
      if (existingPayment.user_id !== user.id) {
        return NextResponse.json(
          {
            error: 'payment_tx_already_recorded',
            message:
              'This transaction was already recorded for a different account. If you use a smart wallet, ensure the app shows the same address you paid with, or contact support.',
          },
          { status: 409 },
        )
      }

      return NextResponse.json({
        success: true,
        payment: {
          id: existingPayment.id,
          txHash: existingPayment.tx_hash,
          amountUsdc: existingPayment.amount_usdc,
        },
        duplicate: true,
      })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        company_id: companyId,
        type: 'PSP_ORDER',
        amount_usdc: parseFloat(amountUsdc),
        tx_hash: normalizedTxHash,
        status: 'COMPLETED',
      })
      .select()
      .single()

    if (paymentError) {
      console.error('[PSP PAYMENT] insert error:', paymentError)
      return NextResponse.json({ error: 'Failed to record payment', details: paymentError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      payment: { id: payment.id, txHash: payment.tx_hash, amountUsdc: payment.amount_usdc },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP PAYMENT] Unexpected:', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}
