import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { form1ToProfile, form2ToProfile, form3ToProfile } from '@/lib/dot-form-mapper'
import {
  getFullDriverProfile,
  saveCdlData,
  saveDriverEmployment,
  saveEducation,
  saveEmergencyContact,
  saveDrivingExperience,
} from '@/lib/block-data'

/**
 * API Route: Sync DOT Application → Driver Profile
 * 
 * Called when a driver completes their DOT application.
 * application_data is stored as { form1, form2, form3 } by save-progress.
 * We use the existing mapper functions to translate each form into profile fields.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[DOT SYNC] Starting sync for user:', sessionUserId)

    const supabase = await getAdminSupabaseClient()

    // 1. Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', sessionUserId)
      .single()

    if (userError || !user) {
      console.error('[DOT SYNC] User not found:', sessionUserId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 2. Get completed DOT application
    const { data: dotApplication, error: dotError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dotError) {
      console.error('[DOT SYNC] Error fetching DOT application:', dotError)
      return NextResponse.json(
        { error: 'Failed to fetch DOT application' },
        { status: 500 }
      )
    }

    if (!dotApplication) {
      console.log('[DOT SYNC] No completed DOT application found')
      return NextResponse.json(
        { error: 'No completed DOT application found' },
        { status: 404 }
      )
    }

    // 3. Extract data from DOT application
    // Data is stored as { form1, form2, form3 } by the save-progress route
    const appData = dotApplication.application_data || {}
    const form1Data = appData.form1 || {}
    const form2Data = appData.form2 || {}
    const form3Data = appData.form3 || {}

    // Use the existing mapper functions — they already know how to parse each form
    const profileFromForms = {
      ...form1ToProfile(form1Data),
      ...form2ToProfile(form2Data),
      ...form3ToProfile(form3Data),
    }

    // Calculate total driving experience from form2 directly
    // form2ToProfile doesn't extract experience_years/miles, so we do it here
    let totalYears = 0
    const drivingExpArr = form2Data.drivingExperience || []
    if (Array.isArray(drivingExpArr)) {
      drivingExpArr.forEach((exp: { yearsOfExperience?: string }) => {
        const years = parseFloat(exp.yearsOfExperience || '0') || 0
        totalYears = Math.max(totalYears, years)
      })
    }

    console.log('[DOT SYNC] Extracted data:', {
      name: `${profileFromForms.firstName || ''} ${profileFromForms.lastName || ''}`.trim(),
      cdl_class: profileFromForms.cdlClass,
      cdl_state: profileFromForms.cdlState,
      experience_years: totalYears,
      employment_count: profileFromForms.employmentHistory?.length ?? 0,
      education_count: profileFromForms.education?.length ?? 0,
    })

    // 5. Write extracted data to block tables
    // saveCdlData upserts, so it also handles first-time creation
    const blockWrites: Promise<void>[] = []

    // CDL data (Form 1)
    blockWrites.push(
      saveCdlData(supabase, user.id, {
        cdl_number: profileFromForms.cdlNumber || null,
        cdl_state: profileFromForms.cdlState || null,
        cdl_class: profileFromForms.cdlClass || null,
        cdl_expiration: profileFromForms.cdlExpiration || null,
        endorsements: profileFromForms.endorsements || [],
      })
    )

    // Employment history (Form 2 AI-prefill + Form 3)
    if (profileFromForms.employmentHistory?.length) {
      blockWrites.push(
        saveDriverEmployment(supabase, user.id, profileFromForms.employmentHistory)
      )
    }

    // Education (Form 3)
    if (profileFromForms.education?.length) {
      blockWrites.push(
        saveEducation(supabase, user.id, profileFromForms.education)
      )
    }

    // Emergency contact (not currently in DOT forms, but keep the call so
    // future form additions land in the right place)
    if (profileFromForms.emergencyContactName) {
      blockWrites.push(
        saveEmergencyContact(supabase, user.id, {
          contact_name: profileFromForms.emergencyContactName || null,
          contact_relationship: profileFromForms.emergencyContactRelationship || null,
          contact_phone: profileFromForms.emergencyContactPhone || null,
        })
      )
    }

    // Driving experience (Form 2 — totalYears we already computed above)
    if (totalYears > 0) {
      blockWrites.push(
        saveDrivingExperience(supabase, user.id, {
          equipmentTypes: {
            straightTruck: { years: 0, miles: 0 },
            tractorTrailer: { years: 0, miles: 0 },
            tractorTwoTrailers: { years: 0, miles: 0 },
            specializedEquipment: [],
          },
          specialSkills: {
            moffettForklift: false,
            craneOperations: false,
            hazmatHandling: false,
            borderCrossing: false,
          },
        })
      )
    }

    await Promise.all(blockWrites)

    // Re-read the full block profile so the response shape stays the same
    const updatedProfile = await getFullDriverProfile(supabase, user.id)

    console.log('[DOT SYNC] Block tables updated successfully')

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    })

  } catch (error) {
    console.error('[DOT SYNC] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

