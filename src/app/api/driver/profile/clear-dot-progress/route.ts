import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

function isNetworkError(msg: string | undefined): boolean {
  const m = (msg ?? '').toLowerCase()
  return (
    msg === 'fetch failed' ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('network')
  )
}

/**
 * POST /api/driver/profile/clear-dot-progress
 *
 * Discards in-progress DOT application: deletes the row(s) from driver_applications
 * (so they disappear from the hub) and clears DOT-specific profile fields.
 *
 * What gets deleted:
 * - All driver_applications rows for this user that are not on blockchain (in-progress)
 *
 * What gets cleared on profile:
 * - Emergency contact, driving_experience, last_updated_from (when set by DOT)
 *
 * What stays intact:
 * - Personal info, CDL, employment, education, skills, references (shared with Resume Builder)
 *
 * Headers:
 *   x-wallet-address: User's wallet address (required)
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      if (userError && isNetworkError(userError.message)) {
        console.warn('[CLEAR DOT PROGRESS] Network error (user lookup):', userError.message)
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete in-progress DOT application rows so they disappear from the hub
    // Only delete apps that are BOTH: not on blockchain AND not complete
    // This prevents deleting completed apps that haven't been written to chain yet
    const { error: deleteAppsError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('user_id', user.id)
      .eq('is_complete', false)
      .is('blockchain_tx_hash', null)

    if (deleteAppsError) {
      console.error('[CLEAR DOT PROGRESS] Error deleting in-progress apps:', deleteAppsError)
      if (isNetworkError(deleteAppsError.message)) {
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    const { data: profile, error: findError } = await supabase
      .from('driver_profiles')
      .select('id, last_updated_from')
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('[CLEAR DOT PROGRESS] Error fetching profile:', findError)
      if (isNetworkError(findError.message)) {
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ success: true, message: 'In-progress application discarded' })
    }

    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update({
        emergency_contact_name: null,
        emergency_contact_relationship: null,
        emergency_contact_phone: null,
        driving_experience: null,
        ...(profile.last_updated_from === 'dot_application' ? { last_updated_from: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('[CLEAR DOT PROGRESS] Update error:', updateError)
      if (isNetworkError(updateError.message)) {
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    console.log('[CLEAR DOT PROGRESS] Deleted in-progress app(s), cleared DOT profile fields')
    return NextResponse.json({
      success: true,
      message: 'In-progress application discarded',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    console.error('[CLEAR DOT PROGRESS] Unexpected error:', err)
    if (isNetworkError(message)) {
      return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
