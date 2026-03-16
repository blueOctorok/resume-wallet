import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/profiles/[id]
 * Get detailed profile information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: profile, error } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address, email')
      .eq('id', profile.user_id)
      .single()

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        walletAddress: user?.wallet_address,
      },
    })

  } catch (error) {
    console.error('[ADMIN PROFILE DETAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/profiles/[id]
 * Delete or clear a driver profile
 * 
 * Query params:
 *   mode - 'delete' (remove entire profile) or 'clear' (reset form fields only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'delete'

  try {
    const supabase = await getAdminSupabaseClient()

    // Verify profile exists
    const { data: profile, error: findError } = await supabase
      .from('driver_profiles')
      .select('id, user_id, first_name, last_name')
      .eq('id', id)
      .single()

    if (findError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (mode === 'clear') {
      // Clear form data fields but keep the profile record
      const { error: updateError } = await supabase
        .from('driver_profiles')
        .update({
          first_name: null,
          middle_name: null,
          last_name: null,
          email: null,
          phone: null,
          date_of_birth: null,
          ssn_last_four: null,
          address: null,
          city: null,
          state: null,
          zip_code: null,
          professional_summary: null,
          cdl_number: null,
          cdl_state: null,
          cdl_class: null,
          cdl_expiration: null,
          endorsements: [],
          restrictions: [],
          emergency_contact_name: null,
          emergency_contact_relationship: null,
          emergency_contact_phone: null,
          employment_history: [],
          references: [],
          education: [],
          skills: [],
          driving_experience: null,
          last_updated_from: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('[ADMIN PROFILE CLEAR] Error:', updateError)
        return NextResponse.json({ error: 'Failed to clear profile' }, { status: 500 })
      }

      console.log(`[ADMIN] Profile cleared: ${id} by admin: ${auth.walletAddress}`)

      return NextResponse.json({
        success: true,
        message: `Profile for ${profile.first_name || 'user'} ${profile.last_name || ''} cleared`,
      })

    } else {
      // Full delete
      const { error: deleteError } = await supabase
        .from('driver_profiles')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('[ADMIN PROFILE DELETE] Error:', deleteError)
        return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
      }

      console.log(`[ADMIN] Profile deleted: ${id} by admin: ${auth.walletAddress}`)

      return NextResponse.json({
        success: true,
        message: `Profile ${id} deleted`,
      })
    }

  } catch (error) {
    console.error('[ADMIN PROFILE DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
