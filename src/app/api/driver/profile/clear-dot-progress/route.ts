import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/driver/profile/clear-dot-progress
 *
 * Clears in-progress DOT application data from the authenticated driver's profile.
 * Used when a user discards an unsaved DOT application from the Driver Hub.
 *
 * IMPORTANT: This only clears DOT-SPECIFIC fields that are NOT shared with Resume Builder.
 * Fields like name, email, employment history, CDL info, etc. are shared and should NOT
 * be cleared here - they may have come from the Resume Builder and should persist.
 *
 * What gets cleared:
 * - Emergency contact info (DOT-specific)
 * - Driving experience/record (DOT Form 2)
 * - last_updated_from marker (so profile appears "fresh")
 *
 * What stays intact:
 * - Personal info (name, email, phone, address) - shared with Resume Builder
 * - CDL info - shared with Resume Builder
 * - Employment history - shared with Resume Builder
 * - Education, skills, references - shared with Resume Builder
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: profile, error: findError } = await supabase
      .from('driver_profiles')
      .select('id, last_updated_from')
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('[CLEAR DOT PROGRESS] Error fetching profile:', findError)
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ success: true, message: 'No profile to clear' })
    }

    // Only clear DOT-specific fields, preserve Resume Builder data
    // If last_updated_from is 'resume_builder', we definitely want to keep that data
    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update({
        // DOT-specific fields only (not in Resume Builder)
        emergency_contact_name: null,
        emergency_contact_relationship: null,
        emergency_contact_phone: null,
        driving_experience: null, // DOT Form 2 driving record
        // Reset the source marker so next DOT app save can set it
        // But only if current source is 'dot_application'
        ...(profile.last_updated_from === 'dot_application' ? { last_updated_from: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('[CLEAR DOT PROGRESS] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 })
    }

    console.log('[CLEAR DOT PROGRESS] Cleared DOT-specific fields, preserved resume data')
    return NextResponse.json({ 
      success: true, 
      message: 'In-progress DOT data cleared (resume data preserved)' 
    })
  } catch (err) {
    console.error('[CLEAR DOT PROGRESS] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
