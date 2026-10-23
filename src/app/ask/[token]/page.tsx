import type { Metadata } from 'next'
import RecruiterAsk from '@/components/ask/RecruiterAsk'

export const metadata: Metadata = {
  title: 'Ask a driver',
  robots: { index: false, follow: false },
}

export default async function AskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <RecruiterAsk token={token} />
}
