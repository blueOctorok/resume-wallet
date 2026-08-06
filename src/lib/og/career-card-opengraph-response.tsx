import { ImageResponse } from 'next/og'
import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'
import { buildCareerCardOgElement, tryAvatarDataUrl } from '@/lib/og/career-card-og-image'

const NOT_FOUND = (
  <div
    style={{
      width: 1200,
      height: 630,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      color: '#94a3b8',
      fontSize: 32,
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    Provven — Career Card not found
  </div>
)

/** Shared by `opengraph-image.tsx` (and any future Twitter-specific image route). */
export async function getCareerCardOpengraphImageResponse(token: string) {
  const card = await loadCareerCardByShareToken(token)
  if (!card) {
    return new ImageResponse(NOT_FOUND, { width: 1200, height: 630 })
  }
  const avatarDataUrl = await tryAvatarDataUrl(card.avatarUrl)
  return new ImageResponse(buildCareerCardOgElement(card, 'link', { avatarDataUrl }), {
    width: 1200,
    height: 630,
  })
}
