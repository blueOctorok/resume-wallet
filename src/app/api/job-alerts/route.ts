import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  countJobAlertPreferences,
  createJobAlertPreference,
  getMaxJobAlertsForUser,
  listJobAlertPreferences,
} from '@/lib/job-alert-data'

/**
 * GET /api/job-alerts — list preferences + limits for the connected wallet.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const [preferences, maxAlerts] = await Promise.all([
      listJobAlertPreferences(supabase, userId),
      getMaxJobAlertsForUser(supabase, userId),
    ])

    return NextResponse.json({
      preferences,
      maxAlerts,
      count: preferences.length,
    })
  } catch (e) {
    console.error('[JOB_ALERTS] GET:', e)
    return NextResponse.json({ error: 'Failed to load job alerts' }, { status: 500 })
  }
}

/**
 * POST /api/job-alerts — create a saved search.
 * Body: { keywords, label?, location?, salary_min?, min_match_score?, is_active? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const keywords = typeof body.keywords === 'string' ? body.keywords.trim() : ''
    if (!keywords || keywords.length > 280) {
      return NextResponse.json({ error: 'keywords is required (max 280 chars)' }, { status: 400 })
    }

    const label = typeof body.label === 'string' ? body.label : null
    const location = typeof body.location === 'string' ? body.location : null
    const salary_min =
      typeof body.salary_min === 'number' && Number.isFinite(body.salary_min)
        ? Math.max(0, Math.round(body.salary_min))
        : null
    let min_match_score = 72
    if (typeof body.min_match_score === 'number' && Number.isFinite(body.min_match_score)) {
      min_match_score = Math.min(95, Math.max(50, Math.round(body.min_match_score)))
    }
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : true

    const supabase = await getAdminSupabaseClient()

    const [maxAlerts, currentCount] = await Promise.all([
      getMaxJobAlertsForUser(supabase, userId),
      countJobAlertPreferences(supabase, userId),
    ])

    if (currentCount >= maxAlerts) {
      return NextResponse.json(
        {
          error: `You can save up to ${maxAlerts} job alert${maxAlerts === 1 ? '' : 's'}. Remove one or add Stormi credits for more.`,
          maxAlerts,
        },
        { status: 403 },
      )
    }

    const pref = await createJobAlertPreference(supabase, userId, {
      label,
      keywords,
      location,
      salary_min,
      min_match_score,
      is_active,
    })

    return NextResponse.json({ preference: pref })
  } catch (e) {
    console.error('[JOB_ALERTS] POST:', e)
    return NextResponse.json({ error: 'Failed to create job alert' }, { status: 500 })
  }
}
