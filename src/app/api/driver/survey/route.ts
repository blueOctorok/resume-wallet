import { NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  normalizeDriverSurvey,
  validateDriverSurvey,
  type DriverSurveyAnswers,
} from '@/lib/driver-survey'

/** The signed-in driver's own survey. One row, attached to their login. */
export async function GET(request: Request) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('driver_surveys')
      .select('answers, submitted_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[DRIVER SURVEY] Load failed:', error)
      return NextResponse.json({ error: 'Could not load the survey' }, { status: 500 })
    }

    return NextResponse.json({
      survey: data
        ? { answers: data.answers as DriverSurveyAnswers, submittedAt: data.submitted_at }
        : null,
    })
  } catch (err) {
    console.error('[DRIVER SURVEY] Load failed:', err)
    return NextResponse.json({ error: 'Could not load the survey' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as { answers?: unknown }
    const problem = validateDriverSurvey(body.answers)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    const answers = normalizeDriverSurvey(body.answers as DriverSurveyAnswers)
    const supabase = await getAdminSupabaseClient()
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('driver_surveys')
      .select('submitted_at')
      .eq('user_id', userId)
      .maybeSingle()

    const { data, error } = await supabase
      .from('driver_surveys')
      .upsert(
        {
          user_id: userId,
          answers,
          submitted_at: existing?.submitted_at ?? now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      )
      .select('answers, submitted_at')
      .single()

    if (error || !data) {
      console.error('[DRIVER SURVEY] Save failed:', error)
      return NextResponse.json({ error: 'Could not save the survey' }, { status: 500 })
    }

    return NextResponse.json({
      survey: { answers: data.answers as DriverSurveyAnswers, submittedAt: data.submitted_at },
    })
  } catch (err) {
    console.error('[DRIVER SURVEY] Save failed:', err)
    return NextResponse.json({ error: 'Could not save the survey' }, { status: 500 })
  }
}
