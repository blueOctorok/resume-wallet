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

  // Data is stored as { form1, form2, form3 } by save-progress route
  const form1 = dotApp?.application_data?.form1 || {}

  // Get DL info from driver profile
  const { data: driverProfile } = await supabase
    .from('driver_profiles')
    .select('cdl_number, cdl_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const nameParts = (user.name || '').split(' ')
  const firstName = form1.firstName || nameParts[0] || ''
  const lastName = form1.lastName || nameParts.slice(1).join(' ') || ''

  // Address is nested under currentMailing in Form 1
  const mailing = form1.currentMailing || {}

  // CDL info is in currentLicenses array
  const license = form1.currentLicenses?.[0] || {}

  return NextResponse.json({
    profile: {
      firstName,
      lastName,
      dateOfBirth: form1.dateOfBirth || '',
      address: mailing.street || '',
      city: mailing.city || '',
      state: mailing.state || '',
      zip: mailing.zipCode || '',
      dlNumber: driverProfile?.cdl_number || license.licenseNumber || '',
      dlState: driverProfile?.cdl_state || license.state || '',
      email: user.email || form1.email || '',
    },
  })
}
