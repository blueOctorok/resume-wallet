import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getDriverEmployment, saveDriverEmployment } from '@/lib/block-data'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * DELETE /api/driver/profile/employment
 * Remove one employment entry from block_driver_employment by id.
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

    const current = await getDriverEmployment(supabase, userId)
    const updated = current.filter((e) => e.id !== employmentId)
    if (updated.length === current.length) {
      return NextResponse.json(
        { error: 'Employment entry not found' },
        { status: 404 }
      )
    }

    try {
      await saveDriverEmployment(supabase, userId, updated)
    } catch (err) {
      console.error('[DRIVER PROFILE] Remove employment error:', err)
      return NextResponse.json({ error: 'Failed to remove employment' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Employment removed' })
  } catch (error) {
    console.error('[DRIVER PROFILE] DELETE employment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
