import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculateProfileScore } from '@/lib/profile-completeness'

/**
 * API Route: Sync DOT Application → Driver Profile
 * 
 * Called when a driver completes their DOT application.
 * Extracts relevant data and updates their driver_profiles record.
 * Calculates and updates profile_completion_score.
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

    const supabase = await createClient()

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
    const appData = dotApplication.application_data || {}
    
    // CDL Information
    const cdlInfo = appData.cdlInfo || {}
    const cdl_class = cdlInfo.cdlClass || null
    const cdl_endorsements = cdlInfo.endorsements || []
    const cdl_state = cdlInfo.cdlState || null
    const cdl_number = cdlInfo.cdlNumber || null

    // Driving Experience
    const drivingExp = appData.drivingExperience || {}
    let totalYears = 0
    let totalMiles = 0

    // Calculate total experience from equipment types
    if (drivingExp.equipmentTypes) {
      const equipment = drivingExp.equipmentTypes
      Object.values(equipment).forEach((exp: any) => {
        if (exp && typeof exp === 'object') {
          totalYears = Math.max(totalYears, exp.years || 0)
          totalMiles += exp.miles || 0
        }
      })
    }

    console.log('[DOT SYNC] Extracted data:', {
      cdl_class,
      cdl_endorsements,
      cdl_state,
      cdl_number,
      experience_years: totalYears,
      total_miles_driven: totalMiles
    })

    // 5. Get or create driver profile
    let { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
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

    // 6. Update driver profile with DOT data
    const updateData: any = {
      driver_application_id: dotApplication.id,
      dot_application_data: appData,
      cdl_class,
      cdl_endorsements,
      cdl_state,
      cdl_number,
      experience_years: totalYears > 0 ? totalYears : null,
      total_miles_driven: totalMiles > 0 ? totalMiles : null,
      updated_at: new Date().toISOString()
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

