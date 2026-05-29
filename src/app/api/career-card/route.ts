import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { buildProjectedCareerCard } from '@/lib/projected-career-card'

/**
 * GET /api/career-card
 *
 * Builds a projected career card from the user's installed hub blocks.
 *
 * Auth modes:
 *   - `x-wallet-address` header → self-view (authenticated user)
 *   - `?token=xxx` query param → public view (no auth, share token lookup)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminSupabaseClient()

    const { searchParams } = new URL(request.url)
    const shareToken = searchParams.get('token')
    // `?lens=<uuid>` is advisory — bad IDs silently fall back to default so a
    // mistyped URL can never break the card.
    const lensId = searchParams.get('lens')

    let userId: string
    let memberSince: string
    let shareTokenValue: string | null = null
    let shareSettings = { showContact: false, allowConnect: true }
    let viewCount: number | undefined

    if (shareToken) {
      const { data: user } = await supabase
        .from('users')
        .select('id, created_at, share_token, share_settings, share_views_count')
        .eq('share_token', shareToken)
        .single()

      if (!user) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      userId = user.id
      memberSince = user.created_at
      shareTokenValue = user.share_token
      shareSettings = user.share_settings ?? shareSettings
      viewCount = user.share_views_count ?? 0

      const nextViews = (viewCount ?? 0) + 1
      await supabase.from('users').update({ share_views_count: nextViews }).eq('id', userId)

      const card = await buildProjectedCareerCard(supabase, userId, {
        memberSince,
        shareToken: shareTokenValue,
        shareSettings,
        contactMode: 'public',
        viewCount: nextViews,
        lensId,
      })

      return NextResponse.json({ success: true, card })
    }

    const sessionUserId = await getStormUserIdFromRequest(request)
    if (sessionUserId) {
      const { data: user } = await supabase
        .from('users')
        .select('id, created_at, share_token, share_settings')
        .eq('id', sessionUserId)
        .single()
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userId = user.id
      memberSince = user.created_at ?? new Date().toISOString()
      shareTokenValue = (user as Record<string, unknown>).share_token as string | null ?? null
      shareSettings = (user as Record<string, unknown>).share_settings as typeof shareSettings ?? shareSettings

      const card = await buildProjectedCareerCard(supabase, userId, {
        memberSince,
        shareToken: shareTokenValue,
        shareSettings,
        contactMode: 'self',
        lensId,
      })

      return NextResponse.json({ success: true, card })
    }

    return NextResponse.json({ error: 'Authentication or share token required' }, { status: 401 })
  } catch (error) {
    console.error('[CAREER CARD] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
