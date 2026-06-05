import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * API Route: Record MVR Payment
 * 
 * POST /api/mvr/payment
 * 
 * Records a USDC payment for an MVR order in the payments table.
 * Called after successful blockchain transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      txHash,
      amountUsdc,
      userType = 'applicant',
      companyId: companyIdRaw,
      /** When paying from company SCW, record which member initiated (personal smart wallet). */
      paidByWalletAddress,
    } = body

    if (!txHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      )
    }

    if (!amountUsdc) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      )
    }

    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[MVR PAYMENT] Received request with sessionUserId:', sessionUserId)

    // Use service role client to bypass RLS for payments
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[MVR PAYMENT] Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey,
      })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address')
      .eq('id', sessionUserId)
      .maybeSingle()
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const payerWalletAddress =
      typeof paidByWalletAddress === 'string' && paidByWalletAddress.trim()
        ? paidByWalletAddress.trim().toLowerCase()
        : user.wallet_address?.toLowerCase() ?? null

    let companyId: string | null = null
    if (typeof companyIdRaw === 'string' && companyIdRaw.trim()) {
      const { data: co } = await supabase
        .from('companies')
        .select('id, wallet_address')
        .eq('id', companyIdRaw.trim())
        .maybeSingle()
      if (
        co?.wallet_address &&
        payerWalletAddress &&
        co.wallet_address.toLowerCase() === payerWalletAddress
      ) {
        companyId = co.id
      } else {
        console.warn('[MVR PAYMENT] Ignoring companyId: does not match payer wallet', {
          companyIdRaw,
          sessionUserId,
        })
      }
    }

    // Store the full tx hash / call-ID — payments.tx_hash is VARCHAR (no limit).
    // Previous code truncated to 66 chars which caused false collisions between
    // different Alchemy bundler call-IDs that shared a prefix.
    const normalizedTxHash = txHash.trim()

    // Check if payment with this tx_hash already exists (prevent duplicates)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, tx_hash, amount_usdc, user_id')
      .eq('tx_hash', normalizedTxHash)
      .eq('type', 'MVR_ORDER')
      .maybeSingle()

    if (existingPayment) {
      if (existingPayment.user_id !== user.id) {
        console.error('[MVR PAYMENT] Duplicate tx_hash already tied to another user — refusing:', {
          existingUserId: existingPayment.user_id,
          requestUserId: user.id,
          sessionUserId,
          payerWalletAddress,
          txHash: normalizedTxHash,
        })
        return NextResponse.json(
          {
            error: 'payment_tx_already_recorded',
            message:
              'This transaction was already recorded for a different account. If you use a smart wallet, ensure the app shows the same address you paid with, or contact support.',
          },
          { status: 409 },
        )
      }

      console.log('[MVR PAYMENT] ✅ Payment already exists, returning existing:', existingPayment.id)

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
        type: 'MVR_ORDER',
        amount_usdc: parseFloat(amountUsdc),
        tx_hash: normalizedTxHash,
        status: 'COMPLETED',
      })
      .select()
      .single()

    if (paymentError) {
      console.error('[MVR PAYMENT] Error recording payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to record payment', details: paymentError.message },
        { status: 500 }
      )
    }

    console.log('[MVR PAYMENT] ✅ Payment successfully recorded:', {
      paymentId: payment.id,
      userId: user.id,
      sessionUserId: sessionUserId,
      txHash: payment.tx_hash,
      amountUsdc: payment.amount_usdc,
      type: 'MVR_ORDER',
      status: 'COMPLETED'
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        txHash: payment.tx_hash,
        amountUsdc: payment.amount_usdc,
      },
    })

  } catch (error: any) {
    console.error('[MVR PAYMENT] Unexpected error:', error)
    console.error('[MVR PAYMENT] Error stack:', error?.stack)
    console.error('[MVR PAYMENT] Error details:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}


