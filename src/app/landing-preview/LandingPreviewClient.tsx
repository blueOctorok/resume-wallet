'use client'

import LandingPage from '@/components/landing/LandingPage'

/** CTAs are stubbed — this route exists only to review the page visually. */
export default function LandingPreviewClient() {
  return (
    <LandingPage
      isAuthenticated={false}
      onLogIn={() => alert('CTA: Log in → /sign-in')}
      onBrowseJobs={() => alert('CTA: Browse jobs (opens Guided Mode on the real page)')}
    />
  )
}
