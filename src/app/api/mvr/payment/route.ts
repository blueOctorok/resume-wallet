import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { txHash, amountUsdc, walletAddress } = body

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

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

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

    // Get user ID from wallet address, or create user if doesn't exist
    let user = null
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (existingUser) {
      user = existingUser
    } else {
      // User doesn't exist, create them
      console.log('[MVR PAYMENT] User not found, creating new user for wallet:', walletAddress)
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
        })
        .select('id')
        .single()

      if (createError || !newUser) {
        console.error('[MVR PAYMENT] Error creating user:', createError)
        return NextResponse.json(
          { error: 'Failed to create user record', details: createError.message },
          { status: 500 }
        )
      }
      
      user = newUser
    }

    // Record payment
    // Truncate tx_hash to 66 characters (standard Ethereum hash length)
    // If it's longer, it's likely a call ID, which we'll truncate
    const truncatedTxHash = txHash.length > 66 ? txHash.substring(0, 66) : txHash
    
    // Check if payment with this tx_hash already exists (prevent duplicates)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, tx_hash, amount_usdc')
      .eq('tx_hash', truncatedTxHash)
      .eq('type', 'MVR_ORDER')
      .maybeSingle()

    if (existingPayment) {
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
        type: 'MVR_ORDER',
        amount_usdc: parseFloat(amountUsdc),
        tx_hash: truncatedTxHash,
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
      walletAddress: walletAddress,
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


