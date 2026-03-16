import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmploymentFromResumes } from '@/lib/developer-employment-from-resumes'


/**
 * GET /api/developer/profile
 *
 * Gets the developer profile for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
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

    const [{ data: profile, error: profileError }, { data: userProfile }] = await Promise.all([
      supabase.from('developer_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_profiles').select('first_name, last_name, email, phone, city, state, headline').eq('user_id', user.id).maybeSingle(),
    ])

    if (profileError || !profile) {
      return NextResponse.json({
        success: true,
        profile: null,
      })
    }

    // Use profile employment_history if present. When empty, only backfill from resume if
    // explicitly requested (?syncFromResume=1). Otherwise return [] so that after the user
    // deletes employments they stay gone (instead of being repopulated from resume on next fetch).
    let employmentHistory = (profile.employment_history as Array<Record<string, unknown>>) || []
    const syncFromResume = request.nextUrl.searchParams.get('syncFromResume') === '1'
    if (employmentHistory.length === 0) {
      if (syncFromResume) {
        const fromResume = await getEmploymentFromResumes(supabase, user.id)
        if (fromResume.length > 0) {
          employmentHistory = fromResume
          await supabase
            .from('developer_profiles')
            .update({
              employment_history: fromResume,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
        }
      }
      // If not syncing, employmentHistory stays [] (deleted entries stay deleted)
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        firstName: userProfile?.first_name ?? null,
        lastName: userProfile?.last_name ?? null,
        displayName: profile.display_name,
        email: userProfile?.email ?? null,
        phone: userProfile?.phone ?? null,
        location: userProfile?.city && userProfile?.state ? `${userProfile.city}, ${userProfile.state}` : profile.location,
        headline: profile.headline,
        bio: profile.bio,
        yearsExperience: profile.years_experience,
        githubUsername: profile.github_username,
        portfolioUrl: profile.portfolio_url,
        linkedinUrl: profile.linkedin_url,
        twitterUrl: profile.twitter_url,
        personalWebsite: profile.personal_website,
        skills: profile.skills || [],
        jobTypes: profile.job_types || [],
        workStyles: profile.work_styles || [],
        willingToRelocate: profile.willing_to_relocate,
        availableForWork: profile.available_for_work,
        education: profile.education || [],
        certifications: profile.certifications || [],
        employmentHistory,
      },
    })
  } catch (error) {
    console.error('[DEVELOPER PROFILE GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/developer/profile
 *
 * Updates the developer profile.
 */
export async function PUT(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Map camelCase to snake_case (identity fields go to user_profiles, not here)
    const updates: Record<string, unknown> = {}
    if (body.displayName !== undefined) updates.display_name = body.displayName
    if (body.location !== undefined) updates.location = body.location
    if (body.headline !== undefined) updates.headline = body.headline
    if (body.bio !== undefined) updates.bio = body.bio
    if (body.yearsExperience !== undefined)
      updates.years_experience = body.yearsExperience
    if (body.githubUsername !== undefined)
      updates.github_username = body.githubUsername
    if (body.portfolioUrl !== undefined)
      updates.portfolio_url = body.portfolioUrl
    if (body.linkedinUrl !== undefined) updates.linkedin_url = body.linkedinUrl
    if (body.twitterUrl !== undefined) updates.twitter_url = body.twitterUrl
    if (body.personalWebsite !== undefined)
      updates.personal_website = body.personalWebsite
    if (body.skills !== undefined) updates.skills = body.skills
    if (body.jobTypes !== undefined) updates.job_types = body.jobTypes
    if (body.workStyles !== undefined) updates.work_styles = body.workStyles
    if (body.willingToRelocate !== undefined)
      updates.willing_to_relocate = body.willingToRelocate
    if (body.availableForWork !== undefined)
      updates.available_for_work = body.availableForWork
    if (body.education !== undefined) updates.education = body.education
    if (body.certifications !== undefined)
      updates.certifications = body.certifications
    if (body.employmentHistory !== undefined)
      updates.employment_history = body.employmentHistory

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('developer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('developer_profiles')
        .update(updates)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[DEVELOPER PROFILE PUT] Update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }

    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('developer_profiles')
        .insert({
          user_id: user.id,
          ...updates,
        })

      if (insertError) {
        console.error('[DEVELOPER PROFILE PUT] Insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated',
    })
  } catch (error) {
    console.error('[DEVELOPER PROFILE PUT] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
