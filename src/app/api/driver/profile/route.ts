import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { DriverProfileRow, UnifiedDriverProfile } from '@/types/driver-profile'
import { rowToProfile, profileToRow } from '@/types/driver-profile'

/**
 * GET /api/driver/profile
 * Fetch the user's unified driver profile
 * 
 * Headers:
 *   x-wallet-address: User's wallet address
 * 
 * Returns:
 *   { success: true, profile: UnifiedDriverProfile } on success
 *   { success: true, profile: null } if no profile exists yet
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user ID from wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[DRIVER PROFILE GET] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get driver profile
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If no profile exists, return null (not an error)
    if (profileError && profileError.code === 'PGRST116') {
      return NextResponse.json({
        success: true,
        profile: null,
      })
    }

    if (profileError) {
      console.error('[DRIVER PROFILE GET] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch driver profile' },
        { status: 500 }
      )
    }

    // Convert to app format
    const unifiedProfile = rowToProfile(profile as DriverProfileRow)

    return NextResponse.json({
      success: true,
      profile: unifiedProfile,
    })

  } catch (error) {
    console.error('[DRIVER PROFILE GET] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/driver/profile
 * Create or fetch (upsert) a driver profile
 * 
 * Body:
 *   { walletAddress: string }
 * 
 * Returns:
 *   { success: true, profile: UnifiedDriverProfile }
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

    const supabase = await getAdminSupabaseClient()

    // Get user ID from wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[DRIVER PROFILE POST] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create driver profile
    let { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If profile doesn't exist, create it
    if (profileError && profileError.code === 'PGRST116') {
      console.log('[DRIVER PROFILE POST] Creating new profile for user:', user.id)
      
      const { data: newProfile, error: createError } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: user.id,
          profile_completion_score: 0,
          employment_history: [],
          references: [],
          education: [],
          skills: [],
          driving_experience: {},
          mvr_violations: [],
          mvr_accidents: [],
        })
        .select()
        .single()

      if (createError) {
        console.error('[DRIVER PROFILE POST] Error creating profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create driver profile' },
          { status: 500 }
        )
      }

      profile = newProfile
    } else if (profileError) {
      console.error('[DRIVER PROFILE POST] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch driver profile' },
        { status: 500 }
      )
    }

    // Convert to app format
    const unifiedProfile = rowToProfile(profile as DriverProfileRow)

    return NextResponse.json({
      success: true,
      profile: unifiedProfile,
    })

  } catch (error) {
    console.error('[DRIVER PROFILE POST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/driver/profile
 * Update the user's driver profile
 * 
 * Headers:
 *   x-wallet-address: User's wallet address
 * 
 * Body:
 *   { 
 *     profileData: Partial<UnifiedDriverProfile>,
 *     source: 'resume_builder' | 'dot_application' | 'uploaded_resume' | 'manual'
 *   }
 * 
 * Returns:
 *   { success: true, profile: UnifiedDriverProfile }
 */
export async function PUT(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const { profileData, source } = await request.json()

    if (!profileData) {
      return NextResponse.json(
        { error: 'Profile data is required' },
        { status: 400 }
      )
    }

    const validSources = ['resume_builder', 'dot_application', 'uploaded_resume', 'manual', 'mvr']
    if (source && !validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user ID from wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[DRIVER PROFILE PUT] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Convert to database format
    const updateData = profileToRow(profileData, source || 'manual')

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('driver_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    
    if (existingProfile) {
      // Update existing profile
      const { data: updated, error: updateError } = await supabase
        .from('driver_profiles')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('[DRIVER PROFILE PUT] Error updating profile:', updateError)
        return NextResponse.json(
          { error: 'Failed to update driver profile' },
          { status: 500 }
        )
      }
      result = updated
    } else {
      // Create new profile with the data
      const { data: created, error: createError } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: user.id,
          ...updateData,
          profile_completion_score: 0,
        })
        .select()
        .single()

      if (createError) {
        console.error('[DRIVER PROFILE PUT] Error creating profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create driver profile' },
          { status: 500 }
        )
      }
      result = created
    }

    // Convert to app format
    const unifiedProfile = rowToProfile(result as DriverProfileRow)

    console.log(`[DRIVER PROFILE PUT] Profile updated from ${source || 'manual'} for user:`, user.id)

    return NextResponse.json({
      success: true,
      profile: unifiedProfile,
    })

  } catch (error) {
    console.error('[DRIVER PROFILE PUT] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
