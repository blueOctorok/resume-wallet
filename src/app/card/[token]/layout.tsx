import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ token: string }>
}

function absoluteCardUrl(host: string, proto: string, token: string): string {
  const base = `${proto}://${host}`.replace(/\/$/, '')
  return `${base}/card/${token}`
}

/** First value only — x-forwarded-* can be comma-separated when behind multiple proxies. */
function firstForwarded(value: string | null): string | null {
  if (!value) return null
  const v = value.split(',')[0]?.trim()
  return v || null
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { token } = await params
  const card = await loadCareerCardByShareToken(token)

  if (!card) {
    return {
      title: 'Career Card',
      description: 'Provven Career Card — verified credentials and selective disclosure.',
      robots: { index: false, follow: false },
    }
  }

  const n = card.employerConfirmedEmploymentCount
  const title = `${card.name} — Provven Career Card`
  const description = `Verified by Provven career card.${n > 0 ? ` ${n} employer confirmation${n === 1 ? '' : 's'}.` : ''}${card.occupation ? ` ${card.occupation}` : ''}`

  const h = await headers()
  const host =
    firstForwarded(h.get('x-forwarded-host')) ?? firstForwarded(h.get('host')) ?? 'provven.com'
  const proto = firstForwarded(h.get('x-forwarded-proto')) ?? 'https'
  const cardUrl = absoluteCardUrl(host, proto, token)
  /** Absolute PNG URL for crawlers (LinkedIn, Slack, iMessage). Next file convention serves this path; explicit tags avoid merge gaps with client-only pages. */
  const ogImageUrl = `${cardUrl}/opengraph-image`
  const oembed = `${proto}://${host}/api/oembed?url=${encodeURIComponent(cardUrl)}`

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url: cardUrl,
      siteName: 'Provven',
      locale: 'en_US',
      images: [
        {
          url: ogImageUrl,
          secureUrl: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    /** oEmbed endpoint for this card URL (paste into oEmbed consumers or discovery tools) */
    alternates: {
      canonical: `/card/${token}`,
      types: {
        'application/json+oembed': oembed,
      },
    },
  }
}

export default function CardTokenLayout({ children }: LayoutProps) {
  return children
}
