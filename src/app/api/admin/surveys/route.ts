import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { paginateInMemory, resolveUserIdsMatchingSearch } from '@/lib/admin-search'
import type { DriverSurveyAnswers } from '@/lib/driver-survey'

interface SurveyRow {
  user_id: string
  answers: DriverSurveyAnswers
  submitted_at: string
  updated_at: string
}

/**
 * GET /api/admin/surveys
 * Every submitted driver survey, with the name and email on that login.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const supabase = await getAdminSupabaseClient()
    let query = supabase
      .from('driver_surveys')
      .select('user_id, answers, submitted_at, updated_at')
      .order('submitted_at', { ascending: false })

    if (search) {
      const ids = await resolveUserIdsMatchingSearch(supabase, search)
      if (ids.length === 0) {
        return NextResponse.json({ success: true, surveys: [], total: 0 })
      }
      query = query.in('user_id', ids)
    }

    const { data, error } = await query
    if (error) {
      console.error('[ADMIN SURVEYS]', error)
      return NextResponse.json({ error: 'Could not load surveys' }, { status: 500 })
    }

    const rows = (data ?? []) as SurveyRow[]
    const userIds = rows.map((row) => row.user_id)
    const [{ data: profiles }, { data: users }] = await Promise.all([
      userIds.length
        ? supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name, email')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase.from('users').select('id, email').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileById = new Map(
      (profiles ?? []).map((profile) => [profile.user_id as string, profile]),
    )
    const emailById = new Map((users ?? []).map((user) => [user.id as string, user.email as string | null]))

    const surveys = rows.map((row) => {
      const profile = profileById.get(row.user_id)
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      return {
        userId: row.user_id,
        name: name || null,
        email: (profile?.email as string | null) || emailById.get(row.user_id) || null,
        submittedAt: row.submitted_at,
        updatedAt: row.updated_at,
        answers: row.answers,
      }
    })

    return NextResponse.json({
      success: true,
      surveys: paginateInMemory(surveys, offset, limit),
      total: surveys.length,
    })
  } catch (err) {
    console.error('[ADMIN SURVEYS]', err)
    return NextResponse.json({ error: 'Could not load surveys' }, { status: 500 })
  }
}
