import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { calculateProfileScore } from '@/lib/profile-completeness'
import { form1ToProfile, form2ToProfile, form3ToProfile } from '@/lib/dot-form-mapper'

/**
 * API Route: Sync DOT Application → Driver Profile
 * 
 * Called when a driver completes their DOT application.
 * application_data is stored as { form1, form2, form3 } by save-progress.
 * We use the existing mapper functions to translate each form into profile fields.
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    console.log('[DOT SYNC] Starting sync for wallet:', walletAddress)

    const supabase = await getAdminSupabaseClient()

    // 1. Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[DOT SYNC] User not found:', walletAddress)
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

    // 3. Get latest resume
    const { data: latestResume } = await supabase
      .from('resumes')
      .select('id, ipfs_url, ipfs_hash')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 4. Extract data from DOT application
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
    let totalMiles = 0
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

    // 5. Get or create driver profile
    let { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      console.log('[DOT SYNC] Creating new profile')
      const { data: newProfile, error: createError } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: user.id,
          profile_completion_score: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('[DOT SYNC] Error creating profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create driver profile' },
          { status: 500 }
        )
      }

      profile = newProfile
    } else if (profileError) {
      console.error('[DOT SYNC] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch driver profile' },
        { status: 500 }
      )
    }

    // 6. Build update payload from mapped profile fields → DB column names
    const updateData: Record<string, unknown> = {
      driver_application_id: dotApplication.id,
      dot_application_data: appData,
      // Personal info (Form 1)
      first_name: profileFromForms.firstName || null,
      middle_name: profileFromForms.middleName || null,
      last_name: profileFromForms.lastName || null,
      email: profileFromForms.email || null,
      phone: profileFromForms.phone || null,
      date_of_birth: profileFromForms.dateOfBirth || null,
      address: profileFromForms.address || null,
      city: profileFromForms.city || null,
      state: profileFromForms.state || null,
      zip_code: profileFromForms.zipCode || null,
      // CDL info (Form 1 currentLicenses[0])
      cdl_class: profileFromForms.cdlClass || null,
      cdl_endorsements: profileFromForms.endorsements || [],
      cdl_state: profileFromForms.cdlState || null,
      cdl_number: profileFromForms.cdlNumber || null,
      cdl_expiration: profileFromForms.cdlExpiration || null,
      // Driving experience (Form 2)
      experience_years: totalYears > 0 ? totalYears : null,
      // Employment history & education (Form 3)
      employment_history: profileFromForms.employmentHistory ?? [],
      education: profileFromForms.education ?? [],
      updated_at: new Date().toISOString(),
    }

    // Add resume data if available
    if (latestResume) {
      updateData.resume_id = latestResume.id
      updateData.resume_url = latestResume.ipfs_url
      updateData.resume_ipfs_hash = latestResume.ipfs_hash
    }

    // Calculate profile completion score
    const scoreResult = calculateProfileScore({
      ...profile,
      ...updateData
    })

    updateData.profile_completion_score = scoreResult.score

    console.log('[DOT SYNC] Updating profile with score:', scoreResult.score)

    const { data: updatedProfile, error: updateError } = await supabase
      .from('driver_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[DOT SYNC] Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update driver profile' },
        { status: 500 }
      )
    }

    console.log('[DOT SYNC] ✅ Profile updated successfully:', {
      score: scoreResult.score,
      status: scoreResult.status
    })

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      completeness: scoreResult
    })

  } catch (error) {
    console.error('[DOT SYNC] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

