import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'

export const runtime = 'nodejs'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** shields.io-style SVG badge for READMEs — `/card/[token]/badge` */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const card = await loadCareerCardByShareToken(token)
  if (!card) {
    return new Response('Not found', { status: 404 })
  }
  const n = card.employerConfirmedEmploymentCount
  const label = n > 0 ? `${n} confirmed` : `Score ${card.careerCardScore}`
  const right = 'Provven'
  const w = 200
  const h = 28
  const split = 108
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="Provven Career Card">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0f766e"/>
      <stop offset="100%" style="stop-color:#14b8a6"/>
    </linearGradient>
  </defs>
  <rect width="${split}" height="${h}" fill="#1e293b"/>
  <rect x="${split}" width="${w - split}" height="${h}" fill="url(#g)"/>
  <text x="8" y="18" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="11" font-weight="600">${escapeXml(label)}</text>
  <text x="${split + 10}" y="18" fill="#ffffff" font-family="system-ui,sans-serif" font-size="11" font-weight="700">${escapeXml(right)}</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
