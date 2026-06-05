import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  getCdlData, getDriverEmployment, getMvrData, getSkills, getEducation,
  getEmergencyContact, getDrivingExperience, getReferences,
  saveCdlData, saveDriverEmployment, saveEmergencyContact, saveDrivingExperience,
  saveSkills, saveEducation, saveReferences,
} from '@/lib/block-data'

/**
 * GET /api/admin/profiles/[id]
 * Get detailed profile information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // id is a block_driver_cdl row id — look up user_id from it
    const { data: cdlRow, error } = await supabase
      .from('block_driver_cdl')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !cdlRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userId = cdlRow.user_id

    // Parallel block reads + user info
    const [user, userProfile, employment, mvr, skills, education, emergency, experience, refs] =
      await Promise.all([
        supabase.from('users').select('wallet_address, email').eq('id', userId).single().then(r => r.data),
        supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle().then(r => r.data),
        getDriverEmployment(supabase, userId),
        getMvrData(supabase, userId),
        getSkills(supabase, userId),
        getEducation(supabase, userId),
        getEmergencyContact(supabase, userId),
        getDrivingExperience(supabase, userId),
        getReferences(supabase, userId),
      ])

    const profile = {
      id: cdlRow.id,
      user_id: userId,
      first_name: userProfile?.first_name ?? null,
      last_name: userProfile?.last_name ?? null,
      email: userProfile?.email ?? null,
      phone: userProfile?.phone ?? null,
      cdl_number: cdlRow.cdl_number,
      cdl_state: cdlRow.cdl_state,
      cdl_class: cdlRow.cdl_class,
      cdl_expiration: cdlRow.cdl_expiration,
      endorsements: cdlRow.endorsements,
      restrictions: cdlRow.restrictions,
      employment_history: employment,
      skills,
      education,
      references: refs,
      emergency_contact_name: emergency?.contact_name ?? null,
      emergency_contact_relationship: emergency?.contact_relationship ?? null,
      emergency_contact_phone: emergency?.contact_phone ?? null,
      driving_experience: experience,
      mvr,
      last_updated_from: null,
      created_at: cdlRow.created_at,
      updated_at: cdlRow.updated_at,
      legacyWalletAddress: user?.wallet_address,
    }

    return NextResponse.json({ success: true, profile })

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
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'delete'

  try {
    const supabase = await getAdminSupabaseClient()

    // id is a block_driver_cdl row id — look up user_id from it
    const { data: cdlRow, error: findError } = await supabase
      .from('block_driver_cdl')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (findError || !cdlRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userId = cdlRow.user_id

    // Get display name from user_profiles
    const { data: up } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()

    if (mode === 'clear') {
      // Clear all block table data but keep the rows
      try {
        await Promise.all([
          saveCdlData(supabase, userId, {
            cdl_number: null, cdl_state: null, cdl_class: null,
            cdl_expiration: null, endorsements: [], restrictions: [],
          }),
          saveDriverEmployment(supabase, userId, []),
          saveEmergencyContact(supabase, userId, {
            contact_name: null, contact_relationship: null, contact_phone: null,
          }),
          saveDrivingExperience(supabase, userId, null),
          saveEducation(supabase, userId, []),
          saveSkills(supabase, userId, []),
          saveReferences(supabase, userId, []),
        ])
      } catch (err) {
        console.error('[ADMIN PROFILE CLEAR] Error:', err)
        return NextResponse.json({ error: 'Failed to clear profile' }, { status: 500 })
      }

      console.log(`[ADMIN] Profile cleared: ${id} by admin: ${auth.email}`)

      return NextResponse.json({
        success: true,
        message: `Profile for ${up?.first_name || 'user'} ${up?.last_name || ''} cleared`,
      })

    } else {
      // Full delete — remove block table rows by user_id
      const blockTables = [
        'block_driver_cdl', 'block_driver_employment', 'block_driver_mvr',
        'block_driver_emergency', 'block_driver_experience',
        'block_education', 'block_skills', 'block_references',
      ] as const

      try {
        await Promise.all(
          blockTables.map((table) =>
            supabase.from(table).delete().eq('user_id', userId)
          )
        )
      } catch (err) {
        console.error('[ADMIN PROFILE DELETE] Error:', err)
        return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
      }

      console.log(`[ADMIN] Profile deleted: ${id} by admin: ${auth.email}`)

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
