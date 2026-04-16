import { getCareerCardOpengraphImageResponse } from '@/lib/og/career-card-opengraph-response'

export const runtime = 'nodejs'
export const alt = 'Storm Career Card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return getCareerCardOpengraphImageResponse(token)
}
