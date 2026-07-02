import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { buildProjectedCareerCard } from '@/lib/projected-career-card'
import { buildCareerCardPdfBuffer } from '@/lib/career-card-pdf'

const defaultShareSettings = { showContact: false, allowConnect: true }

/**
 * GET /api/career-card/pdf — download Career Card as PDF (wallet auth).
 * Requires an active share token so the QR links to the public card.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, created_at, share_token, share_settings')
      .eq('id', userId)
      .single()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const row = user as Record<string, unknown>
    const shareToken = (row.share_token as string | null) ?? null
    if (!shareToken) {
      return NextResponse.json(
        { error: 'Create a share link first so your PDF can include a QR to your public card.' },
        { status: 400 },
      )
    }

    const shareSettings =
      (row.share_settings as { showContact?: boolean; allowConnect?: boolean }) ?? defaultShareSettings

    const memberSince = user.created_at ?? new Date().toISOString()
    const { searchParams } = new URL(request.url)
    const lensId = searchParams.get('lens')
    const card = await buildProjectedCareerCard(supabase, user.id, {
      memberSince,
      shareToken,
      shareSettings: { ...defaultShareSettings, ...shareSettings },
      contactMode: 'self',
      lensId,
    })

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      request.headers.get('origin') ||
      'https://zknight.io'
    const publicCardUrl = `${base}/card/${shareToken}`

    const buffer = await buildCareerCardPdfBuffer(card, publicCardUrl)
    const safeName = card.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'career-card'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="storm-career-card-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[CAREER CARD PDF]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
