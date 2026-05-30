import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getDevProfile, saveDevProfile } from '@/lib/block-data'

/**
 * DELETE /api/developer/profile/employment
 * Remove one employment entry from block_dev_profile.employment_history by id.
 * Body: { employmentId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const employmentId = body.employmentId
    if (!employmentId || typeof employmentId !== 'string') {
      return NextResponse.json(
        { error: 'employmentId is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const devProfile = await getDevProfile(supabase, userId)

    if (!devProfile) {
      return NextResponse.json({ error: 'Developer profile not found' }, { status: 404 })
    }

    const current = (devProfile.employment_history as Array<{ id?: string }>) || []
    const updated = current.filter((e) => e.id !== employmentId)
    if (updated.length === current.length) {
      return NextResponse.json(
        { error: 'Employment entry not found' },
        { status: 404 }
      )
    }

    try {
      await saveDevProfile(supabase, userId, { employment_history: updated })
    } catch (err) {
      console.error('[DEVELOPER PROFILE] Remove employment error:', err)
      return NextResponse.json(
        { error: 'Failed to remove employment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Employment removed' })
  } catch (error) {
    console.error('[DEVELOPER PROFILE] DELETE employment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
