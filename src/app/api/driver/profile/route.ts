import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { DriverProfileRow, UnifiedDriverProfile } from '@/types/driver-profile'
import { rowToProfile, profileToRow } from '@/types/driver-profile'
import { mergeIntoProfile } from '@/lib/profile-mapper'

/**
 * GET /api/driver/profile
 * Fetch a driver profile
 * 
 * Headers:
 *   x-wallet-address: User's wallet address (required)
 * 
 * Query params:
 *   userId: (optional) Fetch a specific driver's profile by user ID
 *           Useful for employers viewing applicant profiles
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

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    const supabase = await getAdminSupabaseClient()

    let targetUserId: string

    if (requestedUserId) {
      // Employer is fetching a specific driver's profile
      // Verify the requester exists (basic auth check)
      const { data: requester } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()

      if (!requester) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      targetUserId = requestedUserId
    } else {
      // User is fetching their own profile
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

      targetUserId = user.id
    }

    // Get driver profile
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', targetUserId)
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
          driving_experience: null,
          mvr_violations: [],
          mvr_accidents: [],
        })
        .select()
        .single()

      if (createError) {
        console.error('[DRIVER PROFILE POST] Error creating profile:', {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          userId: user.id,
        })
        return NextResponse.json(
          { error: 'Failed to create driver profile', details: createError.message },
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

    const { profileData, source, force } = await request.json()

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

    // Check if profile exists and get full data for conflict detection
    const { data: existingProfileRow } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    let result
    
    if (existingProfileRow) {
      // Convert existing profile to app format for conflict detection
      const existingProfile = rowToProfile(existingProfileRow as DriverProfileRow)
      
      // Detect conflicts: different name, CDL number, or email
      const conflicts: string[] = []
      
      if (profileData.firstName && existingProfile.firstName && 
          profileData.firstName.toLowerCase() !== existingProfile.firstName.toLowerCase()) {
        conflicts.push(`Name mismatch: "${existingProfile.firstName} ${existingProfile.lastName}" vs "${profileData.firstName} ${profileData.lastName || ''}"`)
      }
      
      if (profileData.lastName && existingProfile.lastName && 
          profileData.lastName.toLowerCase() !== existingProfile.lastName.toLowerCase()) {
        // Only add if firstName didn't already catch it
        if (!conflicts.some(c => c.includes('Name mismatch'))) {
          conflicts.push(`Name mismatch: "${existingProfile.firstName} ${existingProfile.lastName}" vs "${profileData.firstName || ''} ${profileData.lastName}"`)
        }
      }
      
      if (profileData.cdlNumber && existingProfile.cdlNumber && 
          profileData.cdlNumber !== existingProfile.cdlNumber) {
        conflicts.push(`CDL Number mismatch: "${existingProfile.cdlNumber}" vs "${profileData.cdlNumber}"`)
      }
      
      if (profileData.email && existingProfile.email && 
          profileData.email.toLowerCase() !== existingProfile.email.toLowerCase()) {
        conflicts.push(`Email mismatch: "${existingProfile.email}" vs "${profileData.email}"`)
      }
      
      // If conflicts detected and source is uploaded_resume, return conflict response
      // (Allow overwrites from resume_builder and dot_application as user is actively editing)
      // Unless force flag is set (user explicitly chose to replace)
      if (conflicts.length > 0 && source === 'uploaded_resume' && !force) {
        console.warn('[DRIVER PROFILE PUT] Conflict detected:', conflicts)
        return NextResponse.json({
          success: false,
          conflict: true,
          conflicts,
          existingProfile: {
            name: `${existingProfile.firstName || ''} ${existingProfile.lastName || ''}`.trim(),
            cdlNumber: existingProfile.cdlNumber,
            email: existingProfile.email,
            lastUpdatedFrom: existingProfile.lastUpdatedFrom,
          },
          incomingProfile: {
            name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim(),
            cdlNumber: profileData.cdlNumber,
            email: profileData.email,
            source,
          },
          message: 'This resume appears to be for a different person. Do you want to replace your existing profile data?',
        }, { status: 409 }) // 409 Conflict
      }
      
      // No conflicts or source is user-initiated (resume_builder/dot_application) - proceed with update
      // Use smart merge to preserve existing data where new data is empty
      const mergedData = mergeIntoProfile(existingProfile, profileData as Partial<UnifiedDriverProfile>)
      const mergedUpdateData = profileToRow(mergedData, source || 'manual')
      
      const { data: updated, error: updateError } = await supabase
        .from('driver_profiles')
        .update(mergedUpdateData)
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
      console.log('[DRIVER PROFILE PUT] Creating new profile for user:', user.id)
      console.log('[DRIVER PROFILE PUT] Insert data:', JSON.stringify(updateData, null, 2))
      
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
        console.error('[DRIVER PROFILE PUT] Error creating profile:', {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          userId: user.id,
        })
        return NextResponse.json(
          { error: 'Failed to create driver profile', details: createError.message },
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
