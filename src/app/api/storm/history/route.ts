import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/storm/history
 * 
 * Returns STORM token earning history for a wallet address.
 * Used for displaying earnings and generating tax records.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all STORM distributions for this wallet
    const { data: distributions, error } = await supabase
      .from('storm_distributions')
      .select('*')
      .ilike('wallet_address', walletAddress)
      .order('created_at', { ascending: false })

    if (error) {
      // Table might not exist yet
      if (error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          distributions: [],
          summary: {
            totalEarned: 0,
            totalUsdcSpent: 0,
            transactionCount: 0,
          },
        })
      }
      console.error('[STORM HISTORY] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      )
    }

    // Calculate summary stats
    const totalEarned = (distributions || []).reduce(
      (sum, d) => sum + (d.amount_storm || 0),
      0
    )
    const totalUsdcSpent = (distributions || []).reduce(
      (sum, d) => sum + (d.usdc_spent || 0),
      0
    )

    return NextResponse.json({
      success: true,
      distributions: (distributions || []).map(d => ({
        id: d.id,
        amountStorm: d.amount_storm,
        usdcSpent: d.usdc_spent,
        paymentType: d.payment_type,
        userType: d.user_type || 'applicant',
        rateMultiplier: d.rate_multiplier || 1.0,
        txHash: d.tx_hash,
        createdAt: d.created_at,
        // For tax records
        totalDistributedBefore: d.total_distributed_before,
      })),
      summary: {
        totalEarned,
        totalUsdcSpent,
        transactionCount: (distributions || []).length,
        averageRate: totalUsdcSpent > 0 ? totalEarned / totalUsdcSpent : 0,
      },
    })
  } catch (error) {
    console.error('[STORM HISTORY] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
