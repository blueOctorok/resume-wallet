import { ImageResponse } from 'next/og'
import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'
import { buildCareerCardOgElement, tryAvatarDataUrl } from '@/lib/og/career-card-og-image'

export const runtime = 'nodejs'

/** 600×150 PNG for email signatures — stable URL: `/card/[token]/signature` */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const card = await loadCareerCardByShareToken(token)
  if (!card) {
    return new Response('Not found', { status: 404 })
  }
  const avatarDataUrl = await tryAvatarDataUrl(card.avatarUrl)
  return new ImageResponse(buildCareerCardOgElement(card, 'signature', { avatarDataUrl }), {
    width: 600,
    height: 150,
  })
}
