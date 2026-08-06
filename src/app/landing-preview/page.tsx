import { notFound } from 'next/navigation'
import LandingPreviewClient from './LandingPreviewClient'

/**
 * Dev-only preview of the marketing landing page.
 *
 * The real landing page renders at `/` for signed-out visitors only, which
 * makes it awkward to review while signed in. This route bypasses the auth
 * routing so you can see it anytime during development. 404s in production.
 */
export default function LandingPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <LandingPreviewClient />
}
