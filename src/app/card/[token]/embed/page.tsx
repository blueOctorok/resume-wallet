import { notFound } from 'next/navigation'
import { loadCareerCardByShareToken } from '@/lib/career-card-by-share-token'
import CareerCardEmbed from '@/components/career-card/CareerCardEmbed'

type PageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ theme?: string; compact?: string }>
}

export default async function CareerCardEmbedPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const sp = await searchParams
  const card = await loadCareerCardByShareToken(token)
  if (!card) notFound()

  const theme = sp.theme === 'light' ? 'light' : 'dark'
  const compact = sp.compact === 'true' || sp.compact === '1'

  return (
    <div
      className={theme === 'dark' ? 'dark min-h-screen' : 'min-h-screen'}
      data-theme={theme === 'dark' ? 'dark' : 'light'}
    >
      <CareerCardEmbed token={token} card={card} compact={compact} theme={theme} />
    </div>
  )
}
