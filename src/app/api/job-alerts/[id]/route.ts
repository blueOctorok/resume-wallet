import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import {
  deleteJobAlertPreference,
  getJobAlertPreferenceForUser,
  updateJobAlertPreference,
} from '@/lib/job-alert-data'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/job-alerts/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const patch: {
      label?: string | null
      keywords?: string
      location?: string | null
      salary_min?: number | null
      min_match_score?: number
      is_active?: boolean
    } = {}

    if (body.label !== undefined) {
      patch.label = typeof body.label === 'string' ? body.label : null
    }
    if (body.keywords !== undefined) {
      if (typeof body.keywords !== 'string' || !body.keywords.trim()) {
        return NextResponse.json({ error: 'keywords cannot be empty' }, { status: 400 })
      }
      patch.keywords = body.keywords.trim()
    }
    if (body.location !== undefined) {
      patch.location = typeof body.location === 'string' ? body.location : null
    }
    if (body.salary_min !== undefined) {
      patch.salary_min =
        body.salary_min === null
          ? null
          : typeof body.salary_min === 'number' && Number.isFinite(body.salary_min)
            ? Math.max(0, Math.round(body.salary_min))
            : undefined
    }
    if (body.min_match_score !== undefined) {
      if (typeof body.min_match_score === 'number' && Number.isFinite(body.min_match_score)) {
        patch.min_match_score = Math.min(95, Math.max(50, Math.round(body.min_match_score)))
      }
    }
    if (body.is_active !== undefined) {
      patch.is_active = Boolean(body.is_active)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await getJobAlertPreferenceForUser(supabase, user.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const updated = await updateJobAlertPreference(supabase, user.id, id, patch)
    return NextResponse.json({ preference: updated })
  } catch (e) {
    console.error('[JOB_ALERTS] PATCH:', e)
    return NextResponse.json({ error: 'Failed to update job alert' }, { status: 500 })
  }
}

/**
 * DELETE /api/job-alerts/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await getJobAlertPreferenceForUser(supabase, user.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    await deleteJobAlertPreference(supabase, user.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[JOB_ALERTS] DELETE:', e)
    return NextResponse.json({ error: 'Failed to delete job alert' }, { status: 500 })
  }
}
