import { NextRequest, NextResponse } from 'next/server'
import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'

/**
 * oEmbed 1.0 for Storm career cards.
 * Example: `/api/oembed?url=https://provven.com/card/TOKEN`
 */
export async function GET(request: NextRequest) {
  try {
    const urlParam = request.nextUrl.searchParams.get('url')
    if (!urlParam) {
      return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 })
    }

    let pathname: string
    try {
      pathname = new URL(urlParam).pathname
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const match = pathname.match(/^\/card\/([^/]+)\/?$/)
    if (!match?.[1]) {
      return NextResponse.json({ error: 'URL must be a Provven career card link (/card/{token})' }, { status: 404 })
    }

    const token = match[1]
    const card = await loadCareerCardByShareToken(token)
    if (!card) {
      return NextResponse.json({ error: 'Career card not found' }, { status: 404 })
    }

    const origin = request.nextUrl.origin
    const embedUrl = `${origin}/card/${token}/embed`
    const iframe = `<iframe src="${embedUrl}" width="420" height="360" style="border:0;border-radius:12px;max-width:100%;" title="${escapeAttr(card.name)} — Provven Career Card" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`

    const title = `${card.name} — Provven Career Card`
    const authorName = card.name

    return NextResponse.json({
      version: '1.0',
      type: 'rich',
      provider_name: 'Provven',
      provider_url: origin,
      title,
      author_name: authorName,
      html: iframe,
      width: 420,
      height: 360,
    })
  } catch (e) {
    console.error('[OEMBED]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
