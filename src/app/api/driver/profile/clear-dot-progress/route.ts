import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmergencyContact, getDrivingExperience, saveEmergencyContact, saveDrivingExperience } from '@/lib/block-data'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Delete in-progress DOT application rows so they disappear from the hub
    // Only delete apps that are BOTH: not on blockchain AND not complete
    // This prevents deleting completed apps that haven't been written to chain yet
    const { error: deleteAppsError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('user_id', userId)
      .eq('is_complete', false)
      .is('blockchain_tx_hash', null)

    if (deleteAppsError) {
      console.error('[CLEAR DOT PROGRESS] Error deleting in-progress apps:', deleteAppsError)
      if (isNetworkError(deleteAppsError.message)) {
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    // Check block tables for DOT-specific data to confirm profile exists
    const [emergency, experience] = await Promise.all([
      getEmergencyContact(supabase, userId),
      getDrivingExperience(supabase, userId),
    ])

    if (!emergency && !experience) {
      return NextResponse.json({ success: true, message: 'In-progress application discarded' })
    }

    // Clear DOT-specific block data
    try {
      await Promise.all([
        saveEmergencyContact(supabase, userId, {
          contact_name: null,
          contact_relationship: null,
          contact_phone: null,
        }),
        saveDrivingExperience(supabase, userId, null),
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      console.error('[CLEAR DOT PROGRESS] Block table clear error:', err)
      if (isNetworkError(msg)) {
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
