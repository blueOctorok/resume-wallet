import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * DELETE /api/driver/profile/employment
 * Remove one employment entry from driver_profiles.employment_history by id.
 * Body: { employmentId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const employmentId = body.employmentId
    if (!employmentId || typeof employmentId !== 'string') {
      return NextResponse.json(
        { error: 'employmentId is required' },
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

    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('employment_history')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
    }

    const current = (profile.employment_history as Array<{ id?: string }>) || []
    const updated = current.filter((e) => e.id !== employmentId)
    if (updated.length === current.length) {
      return NextResponse.json(
        { error: 'Employment entry not found' },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update({
        employment_history: updated,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[DRIVER PROFILE] Remove employment error:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove employment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Employment removed' })
  } catch (error) {
    console.error('[DRIVER PROFILE] DELETE employment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
