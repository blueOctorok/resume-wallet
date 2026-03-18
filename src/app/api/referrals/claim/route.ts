import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  isTreasuryConfigured,
  distributeTreasuryBatch,
} from '@/lib/storm-contract'
import { toWei, REFERRAL_REWARD_PER_PERSON } from '@/lib/storm-rewards'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * POST /api/referrals/claim
 *
 * Server-only endpoint — protected by a shared secret so external callers
 * cannot trigger treasury payouts. Wallet addresses are ALWAYS resolved from
 * the DB, never trusted from the request body.
 *
 * Body: { referralId, referrerWallet, referredWallet }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth gate: only callable from our own backend ──
    const internalSecret = process.env.INTERNAL_API_SECRET
    const providedSecret = request.headers.get('x-internal-secret')

    if (!internalSecret || providedSecret !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { referralId } = await request.json()

    if (!referralId) {
      return NextResponse.json({ error: 'referralId is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // ── Fetch referral with an atomic status lock ──
    // Use update-where to atomically transition signed_up → rewarded,
    // preventing race conditions where two concurrent requests could
    // both read status = 'signed_up' before either writes.
    const { data: claimed, error: claimErr } = await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        rewarded_at: new Date().toISOString(),
      })
      .eq('id', referralId)
      .eq('status', 'signed_up') // only transitions from signed_up
      .select('id, referrer_id, referred_user_id')
      .maybeSingle()

    if (claimErr || !claimed) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Referral not found or already rewarded',
      })
    }

    // ── Self-referral guard (defense in depth — set-role also checks) ──
    if (claimed.referrer_id === claimed.referred_user_id) {
      console.warn('[Referral] Self-referral detected, reverting claim:', referralId)
      await supabase
        .from('referrals')
        .update({ status: 'signed_up', rewarded_at: null })
        .eq('id', referralId)
      return NextResponse.json({ success: false, skipped: true, reason: 'Self-referral blocked' })
    }

    // ── Resolve wallet addresses from DB — never trust request body ──
    const { data: referrerUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', claimed.referrer_id)
      .single()

    const { data: referredUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', claimed.referred_user_id)
      .single()

    if (!referrerUser?.wallet_address || !referredUser?.wallet_address) {
      console.warn('[Referral] Missing wallet for referral:', referralId)
      // Revert status since we can't pay out
      await supabase
        .from('referrals')
        .update({ status: 'signed_up', rewarded_at: null })
        .eq('id', referralId)
      return NextResponse.json({ success: false, skipped: true, reason: 'Wallet not found' })
    }

    // ── Same-wallet guard (different user IDs but same wallet address) ──
    if (referrerUser.wallet_address.toLowerCase() === referredUser.wallet_address.toLowerCase()) {
      console.warn('[Referral] Same wallet address detected:', referralId)
      return NextResponse.json({ success: false, skipped: true, reason: 'Same wallet blocked' })
    }

    if (!isTreasuryConfigured()) {
      console.log('[Referral] Treasury not configured, reverting')
      await supabase
        .from('referrals')
        .update({ status: 'signed_up', rewarded_at: null })
        .eq('id', referralId)
      return NextResponse.json({ success: false, skipped: true, reason: 'Treasury not configured' })
    }

    // ── Distribute 2.5 STORM to each party ──
    const amountWei = toWei(REFERRAL_REWARD_PER_PERSON)
    let txHash: string
    try {
      txHash = await distributeTreasuryBatch(
        [referrerUser.wallet_address, referredUser.wallet_address],
        [amountWei, amountWei]
      )
    } catch (distErr) {
      console.error('[Referral] Distribution failed, reverting status:', distErr)
      await supabase
        .from('referrals')
        .update({ status: 'signed_up', rewarded_at: null })
        .eq('id', referralId)
      return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
    }

    // ── Record tx hash ──
    await supabase
      .from('referrals')
      .update({ storm_tx_hash: txHash })
      .eq('id', referralId)

    console.log('[Referral] Reward distributed:', {
      referralId,
      referrer: referrerUser.wallet_address,
      referred: referredUser.wallet_address,
      txHash,
    })

    return NextResponse.json({ success: true, txHash })
  } catch (error) {
    console.error('[Referral] Claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
