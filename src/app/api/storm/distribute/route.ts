import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  calculateReward,
  toWei,
  fromWei,
  TOTAL_REWARD_POOL,
} from '@/lib/storm-rewards'
import {
  isStormConfigured,
  getTotalDistributed,
  distributeReward,
} from '@/lib/storm-contract'

/**
 * API Route: Distribute STORM Rewards
 *
 * POST /api/storm/distribute
 *
 * Called after a successful USDC payment to distribute STORM tokens
 * to the user based on the smooth decay formula.
 *
 * Body:
 * - walletAddress: User's wallet address
 * - usdcAmount: Amount of USDC spent (e.g., 2.99)
 * - paymentId: ID of the payment record (for logging/tracking)
 * - paymentType: Type of payment (e.g., "MVR_ORDER", "SUBSCRIPTION")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress, usdcAmount, paymentId, paymentType } = body

    // Validate inputs
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!usdcAmount || usdcAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid USDC amount is required' },
        { status: 400 }
      )
    }

    // Check if STORM contracts are configured
    if (!isStormConfigured()) {
      console.log('[STORM] Contracts not configured, skipping distribution')
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'STORM contracts not configured',
      })
    }

    // Get current total distributed from the contract
    let totalDistributedWei: bigint
    try {
      totalDistributedWei = await getTotalDistributed()
    } catch (error) {
      console.error('[STORM] Error fetching totalDistributed:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reward pool state' },
        { status: 500 }
      )
    }

    const totalDistributed = fromWei(totalDistributedWei)

    // Check if pool is exhausted
    if (totalDistributed >= TOTAL_REWARD_POOL) {
      console.log('[STORM] Reward pool exhausted')
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Reward pool exhausted',
      })
    }

    // Calculate reward using decay formula
    const rewardAmount = calculateReward(usdcAmount, totalDistributed)

    if (rewardAmount <= 0) {
      console.log('[STORM] Calculated reward is 0')
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Calculated reward is 0',
      })
    }

    // Convert to wei for contract call
    const rewardWei = toWei(rewardAmount)

    console.log('[STORM] Distributing reward:', {
      walletAddress,
      usdcAmount,
      rewardAmount,
      rewardWei: rewardWei.toString(),
      totalDistributed,
      paymentId,
      paymentType,
    })

    // Distribute the reward
    let txHash: string
    try {
      txHash = await distributeReward(walletAddress, rewardWei)
    } catch (error: any) {
      console.error('[STORM] Distribution failed:', error)
      return NextResponse.json(
        {
          error: 'STORM distribution failed',
          details: error?.message || String(error),
        },
        { status: 500 }
      )
    }

    console.log('[STORM] ✅ Distribution successful:', {
      txHash,
      walletAddress,
      rewardAmount,
    })

    // Record the distribution in the database (optional, for tracking)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Try to insert into storm_distributions table if it exists
        // This is optional - if the table doesn't exist, we just log
        await supabase.from('storm_distributions').insert({
          wallet_address: walletAddress,
          amount_storm: rewardAmount,
          usdc_spent: usdcAmount,
          payment_id: paymentId,
          payment_type: paymentType,
          tx_hash: txHash,
          total_distributed_before: totalDistributed,
        }).then(({ error }) => {
          if (error && !error.message.includes('does not exist')) {
            console.warn('[STORM] Failed to record distribution:', error.message)
          }
        })
      }
    } catch (dbError) {
      // Non-fatal - distribution succeeded, just logging failed
      console.warn('[STORM] Failed to record distribution in DB:', dbError)
    }

    return NextResponse.json({
      success: true,
      txHash,
      reward: {
        amount: rewardAmount,
        amountWei: rewardWei.toString(),
      },
      poolState: {
        totalDistributedBefore: totalDistributed,
        totalDistributedAfter: totalDistributed + rewardAmount,
        remaining: TOTAL_REWARD_POOL - totalDistributed - rewardAmount,
      },
    })
  } catch (error: any) {
    console.error('[STORM] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/storm/distribute
 *
 * Get current reward pool state (for debugging/display)
 */
export async function GET() {
  try {
    if (!isStormConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'STORM contracts not configured',
      })
    }

    const totalDistributedWei = await getTotalDistributed()
    const totalDistributed = fromWei(totalDistributedWei)
    const remaining = TOTAL_REWARD_POOL - totalDistributed

    // Calculate current rate (tokens per $1 USDC)
    const currentRate = calculateReward(1, totalDistributed)

    return NextResponse.json({
      configured: true,
      pool: {
        total: TOTAL_REWARD_POOL,
        distributed: totalDistributed,
        remaining,
        percentUsed: (totalDistributed / TOTAL_REWARD_POOL) * 100,
      },
      currentRate: {
        per1Usdc: currentRate,
        per3Usdc: calculateReward(3, totalDistributed),
      },
    })
  } catch (error: any) {
    console.error('[STORM] Error fetching pool state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pool state', details: error?.message },
      { status: 500 }
    )
  }
}
