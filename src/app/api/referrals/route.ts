import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserByWallet } from '@/lib/user-by-wallet'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Hard cap: no user can have more than 500 completed referrals.
// Prevents automated farming even if someone bypasses other checks.
const MAX_REFERRALS_PER_USER = 500

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * GET /api/referrals
 *
 * Returns the caller's referral code and stats.
 * Creates a referral row with a unique code if one doesn't exist yet.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = getAdminClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has an available (unclaimed) referral code
    const { data: existing } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .is('referred_user_id', null)
      .limit(1)
      .maybeSingle()

    let referralCode: string

    if (existing) {
      referralCode = existing.referral_code
    } else {
      // Before creating a new code, check the referral cap
      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', user.id)
        .not('referred_user_id', 'is', null)

      if ((count ?? 0) >= MAX_REFERRALS_PER_USER) {
        return NextResponse.json(
          { error: 'Referral limit reached' },
          { status: 429 }
        )
      }

      referralCode = crypto.randomBytes(4).toString('hex')

      const { error: insertErr } = await supabase.from('referrals').insert({
        referrer_id: user.id,
        referral_code: referralCode,
        status: 'pending',
      })

      // Handle unlikely collision — retry once with longer code
      if (insertErr?.code === '23505') {
        referralCode = crypto.randomBytes(6).toString('hex')
        await supabase.from('referrals').insert({
          referrer_id: user.id,
          referral_code: referralCode,
          status: 'pending',
        })
      }
    }

    // Aggregate stats across all referral rows for this user
    const { data: allReferrals } = await supabase
      .from('referrals')
      .select('status')
      .eq('referrer_id', user.id)
      .not('referred_user_id', 'is', null)

    const stats = {
      totalReferred: allReferrals?.length ?? 0,
      signedUp: allReferrals?.filter((r) => r.status === 'signed_up').length ?? 0,
      rewarded: allReferrals?.filter((r) => r.status === 'rewarded').length ?? 0,
      limit: MAX_REFERRALS_PER_USER,
    }

    return NextResponse.json({ referralCode, stats })
  } catch (error) {
    console.error('[Referrals] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
