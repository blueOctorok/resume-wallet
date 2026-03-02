import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/candidate/profile-info
 *
 * Returns the driver's personal info fields needed to pre-fill the
 * Background Check Disclosure & Authorization form.
 * Pulls from the user record + DOT application data.
 */
export async function GET(request: NextRequest) {
  const walletAddress = request.headers.get('x-wallet-address')

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
  }

  const supabase = await getAdminSupabaseClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, email, name')
    .ilike('wallet_address', walletAddress)
    .single()

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get the most recent completed DOT application for personal info
  const { data: dotApp } = await supabase
    .from('driver_applications')
    .select('application_data')
    .eq('user_id', user.id)
    .eq('is_complete', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const form1 = dotApp?.application_data?.form1Data || {}

  // Get DL info from driver profile
  const { data: driverProfile } = await supabase
    .from('driver_profiles')
    .select('cdl_number, cdl_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const nameParts = (user.name || '').split(' ')
  const firstName = form1.firstName || nameParts[0] || ''
  const lastName = form1.lastName || nameParts.slice(1).join(' ') || ''

  return NextResponse.json({
    profile: {
      firstName,
      lastName,
      dateOfBirth: form1.dateOfBirth || '',
      address: form1.address || '',
      city: form1.city || '',
      state: form1.state || '',
      zip: form1.zip || '',
      dlNumber: driverProfile?.cdl_number || form1.cdlNumber || '',
      dlState: driverProfile?.cdl_state || form1.cdlState || '',
      email: user.email || form1.email || '',
    },
  })
}
