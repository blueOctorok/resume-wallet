import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getFullDriverProfile,
  saveCdlData,
  saveDriverEmployment,
  saveEmergencyContact,
  saveDrivingExperience,
  saveEducation,
  saveSkills,
  saveReferences,
} from '@/lib/block-data'
import type { UnifiedDriverProfile, UnifiedEmployment, UnifiedEducation, UnifiedSkill, UnifiedReference, DrivingExperience } from '@/types/driver-profile'

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')
    const supabase = await getAdminSupabaseClient()
    // A resolved userId already proves the caller exists, so the old
    // requester-existence lookups collapse away. `?userId=` lets a caller read
    // another user's profile (self-view falls back to their own id).
    const targetUserId = requestedUserId ?? userId

    // Compose profile from block tables + merge identity from user_profiles
    const unifiedProfile = await getFullDriverProfile(supabase, targetUserId)
    if (!unifiedProfile) {
      return NextResponse.json({ success: true, profile: null })
    }

    // Merge identity fields from user_profiles
    const { data: up } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email, phone, date_of_birth, address, city, state, zip_code, headline')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (up) {
      unifiedProfile.firstName = up.first_name || ''
      unifiedProfile.lastName = up.last_name || ''
      unifiedProfile.email = up.email || ''
      unifiedProfile.phone = up.phone || ''
      unifiedProfile.dateOfBirth = up.date_of_birth || ''
      unifiedProfile.address = up.address || ''
      unifiedProfile.city = up.city || ''
      unifiedProfile.state = up.state || ''
      unifiedProfile.zipCode = up.zip_code || ''
      unifiedProfile.professionalSummary = up.headline || ''
    }

    return NextResponse.json({ success: true, profile: unifiedProfile })
  } catch (error) {
    console.error('[DRIVER PROFILE GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users').select('id').eq('id', sessionUserId).single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let unifiedProfile = await getFullDriverProfile(supabase, user.id)

    if (!unifiedProfile) {
      // Create an empty CDL row so getFullDriverProfile returns non-null
      await saveCdlData(supabase, user.id, {})
      unifiedProfile = await getFullDriverProfile(supabase, user.id)
    }

    return NextResponse.json({ success: true, profile: unifiedProfile })
  } catch (error) {
    console.error('[DRIVER PROFILE POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { profileData, source, force } = await request.json()
    if (!profileData) {
      return NextResponse.json({ error: 'Profile data is required' }, { status: 400 })
    }

    const validSources = ['resume_builder', 'dot_application', 'uploaded_resume', 'manual', 'mvr']
    if (source && !validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Read existing for conflict detection
    const existingProfile = await getFullDriverProfile(supabase, userId)

    // Conflict detection for uploaded resumes
    if (existingProfile && source === 'uploaded_resume' && !force) {
      const conflicts: string[] = []
      if (profileData.cdlNumber && existingProfile.cdlNumber &&
          profileData.cdlNumber !== existingProfile.cdlNumber) {
        conflicts.push(`CDL Number mismatch: "${existingProfile.cdlNumber}" vs "${profileData.cdlNumber}"`)
      }
      if (conflicts.length > 0) {
        return NextResponse.json({
          success: false, conflict: true, conflicts,
          existingProfile: { cdlNumber: existingProfile.cdlNumber },
          incomingProfile: { cdlNumber: profileData.cdlNumber, source },
          message: 'This resume appears to be for a different person. Do you want to replace your existing profile data?',
        }, { status: 409 })
      }
    }

    // Write directly to block tables
    const writes: Promise<void>[] = []

    if (profileData.cdlNumber !== undefined || profileData.cdlState !== undefined ||
        profileData.cdlClass !== undefined || profileData.cdlExpiration !== undefined ||
        profileData.endorsements !== undefined || profileData.restrictions !== undefined) {
      writes.push(saveCdlData(supabase, userId, {
        cdl_number: (profileData.cdlNumber as string) || null,
        cdl_state: (profileData.cdlState as string)?.slice(0, 2).toUpperCase() || null,
        cdl_class: (profileData.cdlClass as string) || null,
        cdl_expiration: (profileData.cdlExpiration as string) || null,
        endorsements: (profileData.endorsements as string[]) ?? [],
        restrictions: (profileData.restrictions as string[]) ?? [],
      }))
    }

    if (profileData.employmentHistory !== undefined) {
      writes.push(saveDriverEmployment(supabase, userId, profileData.employmentHistory as UnifiedEmployment[]))
    }

    if (profileData.emergencyContactName !== undefined ||
        profileData.emergencyContactRelationship !== undefined ||
        profileData.emergencyContactPhone !== undefined) {
      writes.push(saveEmergencyContact(supabase, userId, {
        contact_name: (profileData.emergencyContactName as string) || null,
        contact_relationship: (profileData.emergencyContactRelationship as string) || null,
        contact_phone: (profileData.emergencyContactPhone as string) || null,
      }))
    }

    if (profileData.drivingExperience !== undefined) {
      writes.push(saveDrivingExperience(supabase, userId, profileData.drivingExperience as DrivingExperience | null))
    }

    if (profileData.education !== undefined) {
      writes.push(saveEducation(supabase, userId, profileData.education as UnifiedEducation[]))
    }

    if (profileData.skills !== undefined) {
      writes.push(saveSkills(supabase, userId, profileData.skills as UnifiedSkill[]))
    }

    if (profileData.references !== undefined) {
      writes.push(saveReferences(supabase, userId, profileData.references as UnifiedReference[]))
    }

    // If no block data existed, ensure at least one row exists
    if (!existingProfile && writes.length === 0) {
      writes.push(saveCdlData(supabase, userId, {}))
    }

    await Promise.all(writes)

    // Read back the updated profile
    const updatedProfile = await getFullDriverProfile(supabase, userId)

    console.log(`[DRIVER PROFILE PUT] Profile updated from ${source || 'manual'} for user:`, userId)

    return NextResponse.json({ success: true, profile: updatedProfile })
  } catch (error) {
    console.error('[DRIVER PROFILE PUT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
