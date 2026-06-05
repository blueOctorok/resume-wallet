import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  getDevGithub, getDevPortfolio, getDevProfile, getSkills, getEducation,
} from '@/lib/block-data'

/**
 * GET /api/admin/dev-profiles/[id]
 * Get detailed developer profile information
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

    // id is a block_dev_profile row id — look up user_id from it
    const { data: devRow, error } = await supabase
      .from('block_dev_profile')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !devRow) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      )
    }

    const userId = devRow.user_id

    const [user, github, portfolio, skills, education, projects] = await Promise.all([
      supabase.from('users').select('wallet_address, email').eq('id', userId).single().then(r => r.data),
      getDevGithub(supabase, userId),
      getDevPortfolio(supabase, userId),
      getSkills(supabase, userId),
      getEducation(supabase, userId),
      supabase.from('developer_projects')
        .select('id, title, description, tech_stack, is_featured, is_public, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(r => r.data),
    ])

    const profile = {
      id: devRow.id,
      user_id: userId,
      bio: devRow.bio,
      headline: devRow.bio,
      github_username: github?.username ?? null,
      portfolio_url: portfolio?.portfolio_url ?? null,
      linkedin_url: portfolio?.linkedin_url ?? null,
      twitter_url: portfolio?.twitter_url ?? null,
      personal_website: portfolio?.personal_website ?? null,
      skills,
      education,
      available_for_work: devRow.available_for_work,
      years_experience: devRow.years_experience,
      job_types: devRow.job_types,
      work_styles: devRow.work_styles,
      willing_to_relocate: devRow.willing_to_relocate,
      certifications: devRow.certifications,
      created_at: devRow.created_at,
      updated_at: devRow.updated_at,
      legacyWalletAddress: user?.wallet_address,
    }

    return NextResponse.json({
      success: true,
      profile,
      projects: projects || [],
    })
  } catch (error) {
    console.error('[ADMIN DEV PROFILE DETAIL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/dev-profiles/[id]
 * Delete a developer profile (cascades to projects)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: profile, error: findError } = await supabase
      .from('block_dev_profile')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (findError || !profile) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      )
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', profile.user_id)
      .maybeSingle()

    const displayName =
      [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() ||
      'unnamed'

    // Delete all block data for this developer
    await Promise.all([
      supabase.from('block_dev_profile').delete().eq('user_id', profile.user_id),
      supabase.from('block_dev_github').delete().eq('user_id', profile.user_id),
      supabase.from('block_dev_portfolio').delete().eq('user_id', profile.user_id),
      supabase.from('block_skills').delete().eq('user_id', profile.user_id),
      supabase.from('block_education').delete().eq('user_id', profile.user_id),
    ])

    console.log(
      `[ADMIN] Developer profile deleted: ${id} (${displayName}) by admin: ${auth.email}`
    )

    return NextResponse.json({
      success: true,
      message: `Developer profile ${displayName} deleted`,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROFILE DELETE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
