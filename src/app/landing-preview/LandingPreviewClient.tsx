'use client'

import LandingPage from '@/components/landing/LandingPage'

/** CTAs are stubbed — this route exists only to review the page visually. */
export default function LandingPreviewClient() {
  return (
    <LandingPage
      isAuthenticated={false}
      onGetStarted={() => alert('CTA: Build your Career Card (routes to sign-in on the real page)')}
      onBrowseJobs={() => alert('CTA: Browse jobs (opens Guided Mode on the real page)')}
    />
  )
}
