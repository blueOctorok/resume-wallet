import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmploymentFromResumes } from '@/lib/developer-employment-from-resumes'
import {
  getDevProfile,
  getDevGithub,
  getDevPortfolio,
  getSkills,
  getEducation,
  saveDevProfile,
  saveDevGithub,
  saveDevPortfolio,
  saveSkills,
  saveEducation,
} from '@/lib/block-data'


/**
 * GET /api/developer/profile
 *
 * Gets the developer profile for the authenticated user.
 * Reads from block tables (block_dev_profile, block_dev_github, etc.).
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

    const [devProfile, github, portfolio, skills, education, userProfile] = await Promise.all([
      getDevProfile(supabase, user.id),
      getDevGithub(supabase, user.id),
      getDevPortfolio(supabase, user.id),
      getSkills(supabase, user.id),
      getEducation(supabase, user.id),
      supabase.from('user_profiles').select('first_name, last_name, email, phone, city, state, headline').eq('user_id', user.id).maybeSingle().then(r => r.data),
    ])

    // No block data at all means no profile yet
    if (!devProfile && !github && !portfolio) {
      return NextResponse.json({
        success: true,
        profile: null,
      })
    }

    // Use profile employment_history if present. When empty, only backfill from resume if
    // explicitly requested (?syncFromResume=1). Otherwise return [] so that after the user
    // deletes employments they stay gone (instead of being repopulated from resume on next fetch).
    let employmentHistory = (devProfile?.employment_history as Array<Record<string, unknown>>) || []
    const syncFromResume = request.nextUrl.searchParams.get('syncFromResume') === '1'
    if (employmentHistory.length === 0) {
      if (syncFromResume) {
        const fromResume = await getEmploymentFromResumes(supabase, user.id)
        if (fromResume.length > 0) {
          employmentHistory = fromResume
          await saveDevProfile(supabase, user.id, { employment_history: fromResume })
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: devProfile?.id ?? user.id,
        firstName: userProfile?.first_name ?? null,
        lastName: userProfile?.last_name ?? null,
        displayName: null,
        email: userProfile?.email ?? null,
        phone: userProfile?.phone ?? null,
        location: userProfile?.city && userProfile?.state ? `${userProfile.city}, ${userProfile.state}` : null,
        headline: userProfile?.headline ?? null,
        bio: devProfile?.bio ?? null,
        yearsExperience: devProfile?.years_experience ?? null,
        githubUsername: github?.username ?? null,
        portfolioUrl: portfolio?.portfolio_url ?? null,
        linkedinUrl: portfolio?.linkedin_url ?? null,
        twitterUrl: portfolio?.twitter_url ?? null,
        personalWebsite: portfolio?.personal_website ?? null,
        skills: skills ?? [],
        jobTypes: devProfile?.job_types ?? [],
        workStyles: devProfile?.work_styles ?? [],
        willingToRelocate: devProfile?.willing_to_relocate ?? false,
        availableForWork: devProfile?.available_for_work ?? false,
        education: education ?? [],
        certifications: devProfile?.certifications ?? [],
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

    // Write to block tables directly
    const writes: Promise<void>[] = []

    // Dev profile fields
    const devProfileFields: Record<string, unknown> = {}
    if (body.bio !== undefined) devProfileFields.bio = body.bio
    if (body.yearsExperience !== undefined) devProfileFields.years_experience = body.yearsExperience
    if (body.employmentHistory !== undefined) devProfileFields.employment_history = body.employmentHistory
    if (body.jobTypes !== undefined) devProfileFields.job_types = body.jobTypes
    if (body.workStyles !== undefined) devProfileFields.work_styles = body.workStyles
    if (body.willingToRelocate !== undefined) devProfileFields.willing_to_relocate = body.willingToRelocate
    if (body.availableForWork !== undefined) devProfileFields.available_for_work = body.availableForWork
    if (body.certifications !== undefined) devProfileFields.certifications = body.certifications
    if (Object.keys(devProfileFields).length > 0) {
      writes.push(saveDevProfile(supabase, user.id, devProfileFields))
    }

    // GitHub
    if (body.githubUsername !== undefined) {
      writes.push(saveDevGithub(supabase, user.id, { username: body.githubUsername }))
    }

    // Portfolio links
    if (body.portfolioUrl !== undefined || body.linkedinUrl !== undefined ||
        body.twitterUrl !== undefined || body.personalWebsite !== undefined) {
      writes.push(saveDevPortfolio(supabase, user.id, {
        portfolio_url: body.portfolioUrl ?? undefined,
        linkedin_url: body.linkedinUrl ?? undefined,
        twitter_url: body.twitterUrl ?? undefined,
        personal_website: body.personalWebsite ?? undefined,
      }))
    }

    // Skills
    if (body.skills !== undefined) {
      writes.push(saveSkills(supabase, user.id, body.skills))
    }

    // Education
    if (body.education !== undefined) {
      writes.push(saveEducation(supabase, user.id, body.education))
    }

    // Identity fields → user_profiles
    const identityFields: Record<string, string | null> = {}
    if (body.headline !== undefined) identityFields.headline = body.headline
    if (body.location !== undefined) {
      const parts = body.location.split(',').map((s: string) => s.trim())
      if (parts[0]) identityFields.city = parts[0]
      if (parts[1]) identityFields.state = parts[1]
    }
    if (Object.keys(identityFields).length > 0) {
      writes.push(
        supabase.from('user_profiles')
          .upsert({ user_id: user.id, ...identityFields }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) console.warn('[DEV PROFILE PUT] user_profiles upsert error:', error.message)
          })
      )
    }

    await Promise.all(writes)

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
