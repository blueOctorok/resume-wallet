import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  calculateReward,
  toWei,
  fromWei,
  TOTAL_REWARD_POOL,
  UserType,
  USER_MULTIPLIERS,
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
    const { walletAddress, usdcAmount, paymentId, paymentType, userType: rawUserType } = body
    
    // Validate and default userType
    const userType: UserType = rawUserType === 'employer' ? 'employer' : 'applicant'

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

    // Calculate reward using decay formula (employers earn at 0.5x rate)
    const rewardAmount = calculateReward(usdcAmount, totalDistributed, userType)
    const multiplier = USER_MULTIPLIERS[userType]

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
      userType,
      multiplier,
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
          user_type: userType,
          rate_multiplier: multiplier,
          tx_hash: txHash,
          total_distributed_before: totalDistributed,
        }).then(({ error }) => {
          if (error && !error.message.includes('does not exist')) {
            console.warn('[STORM] Failed to record distribution:', error.message)
          }
        })
      }
    } catch (dbError) {
      console.warn('[STORM] Failed to record distribution in DB:', dbError)
    }

    // Check if this user was referred and hasn't been rewarded yet.
    // Fires on their FIRST paid action only (status = 'signed_up').
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Find pending referral where this user is the referred party
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .ilike('wallet_address', walletAddress.toLowerCase())
          .maybeSingle()

        if (user) {
          const { data: pendingRef } = await supabase
            .from('referrals')
            .select('id, referrer_id')
            .eq('referred_user_id', user.id)
            .eq('status', 'signed_up')
            .maybeSingle()

          if (pendingRef) {
            // Look up referrer's wallet to distribute treasury reward
            const { data: referrer } = await supabase
              .from('users')
              .select('wallet_address')
              .eq('id', pendingRef.referrer_id)
              .single()

            if (referrer?.wallet_address) {
              const { triggerReferralReward } = await import('@/lib/storm-rewards')
              await triggerReferralReward(
                referrer.wallet_address,
                walletAddress,
                pendingRef.id
              )
            }
          }
        }
      }
    } catch (refErr) {
      console.warn('[STORM] Referral reward check failed (non-fatal):', refErr)
    }

    return NextResponse.json({
      success: true,
      txHash,
      reward: {
        amount: rewardAmount,
        amountWei: rewardWei.toString(),
        userType,
        multiplier,
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

    // Calculate current rates for both user types
    return NextResponse.json({
      configured: true,
      pool: {
        total: TOTAL_REWARD_POOL,
        distributed: totalDistributed,
        remaining,
        percentUsed: (totalDistributed / TOTAL_REWARD_POOL) * 100,
      },
      currentRates: {
        applicant: {
          multiplier: USER_MULTIPLIERS.applicant,
          per1Usdc: calculateReward(1, totalDistributed, 'applicant'),
          per3Usdc: calculateReward(3, totalDistributed, 'applicant'),
        },
        employer: {
          multiplier: USER_MULTIPLIERS.employer,
          per1Usdc: calculateReward(1, totalDistributed, 'employer'),
          per3Usdc: calculateReward(3, totalDistributed, 'employer'),
        },
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
