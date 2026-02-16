import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  computeDriverCareerScore,
  type DriverCareerScoreResult,
} from '@/lib/driver-career-score'

/**
 * GET /api/ai/driver-career-score?token=<share_token>
 *
 * Returns a driver career score for the public Career Card.
 * Score is computed from MVR record, experience, DOT completion, endorsements, and profile completeness.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select(
        'id, user_id, experience_years, endorsements, mvr_license_status, mvr_total_points, mvr_violation_count, employment_history, professional_summary, first_name, last_name, city, state, cdl_class, cdl_state, cdl_expiration'
      )
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const { data: resumeRow } = await supabase
      .from('resumes')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('verification_status', 'VERIFIED')
      .limit(1)
      .maybeSingle()

    const { data: dotRow } = await supabase
      .from('driver_applications')
      .select('is_complete')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const endorsementCount = Array.isArray(profile.endorsements)
      ? profile.endorsements.length
      : 0
    const employmentCount = Array.isArray(profile.employment_history)
      ? profile.employment_history.length
      : 0

    const input = {
      mvrLicenseStatus: profile.mvr_license_status,
      mvrTotalPoints: profile.mvr_total_points ?? null,
      mvrViolationCount: profile.mvr_violation_count ?? null,
      experienceYears: profile.experience_years ?? null,
      hasVerifiedResume: !!resumeRow,
      dotComplete: !!dotRow?.is_complete,
      endorsementCount,
      hasProfessionalSummary: !!profile.professional_summary?.trim(),
      hasName: !!(
        profile.first_name?.trim() &&
        profile.last_name?.trim()
      ),
      hasLocation: !!(profile.city || profile.state),
      hasCdlInfo: !!(profile.cdl_class && profile.cdl_state),
      employmentHistoryCount: employmentCount,
      hasCdlClass: !!profile.cdl_class,
    }

    const result: DriverCareerScoreResult =
      computeDriverCareerScore(input)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[DRIVER CAREER SCORE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to compute driver career score' },
      { status: 500 }
    )
  }
}
