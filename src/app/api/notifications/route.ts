import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { isSupabaseNetworkError } from '@/lib/supabase-errors'

/**
 * GET /api/notifications
 *
 * Returns the most recent 50 notifications for the authenticated user.
 * Unread notifications come first; within each group newest first.
 *
 * Response: { notifications: Notification[], unreadCount: number }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      if (isSupabaseNetworkError(userError.message)) {
        return NextResponse.json(
          { error: 'Database unavailable', notifications: [], unreadCount: 0 },
          { status: 503 },
        )
      }
      console.error('[NOTIFICATIONS] User lookup error:', userError)
      return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 })
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, data, action_url, read, created_at')
      .eq('user_id', user.id)
      .order('read', { ascending: true })     // unread first
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[NOTIFICATIONS] Fetch error:', error)
      if (isSupabaseNetworkError(error.message)) {
        return NextResponse.json(
          { error: 'Database unavailable', notifications: [], unreadCount: 0 },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    const unreadCount = (notifications ?? []).filter(n => !n.read).length

    return NextResponse.json({ notifications: notifications ?? [], unreadCount })
  } catch (err) {
    console.error('[NOTIFICATIONS] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications
 *
 * Marks ALL notifications as read for the authenticated user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      console.error('[NOTIFICATIONS] Mark-all-read error:', error)
      return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[NOTIFICATIONS] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
