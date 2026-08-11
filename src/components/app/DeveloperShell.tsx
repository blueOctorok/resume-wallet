'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore, usePreferencesStore, useAuthStore } from '@/stores'
import ProfileSetup from '@/components/app/ProfileSetup'
import MessageInbox from '@/components/messaging/MessageInbox'

const DeveloperHub = dynamic(
  () => import('@/components/DeveloperHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Developer Hub...' fullScreen={false} />,
  }
)

const PortfolioPage = dynamic(
  () => import('@/components/developer/PortfolioPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Portfolio...' fullScreen={false} />,
  }
)

const ResumeBuilder = dynamic(
  () => import('@/components/ResumeBuilder').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Resume Builder...' fullScreen={false} />,
  }
)

const SimpleModeShell = dynamic(
  () => import('@/components/simple/SimpleModeShell').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading jobs...' fullScreen={false} />,
  }
)

interface DeveloperShellProps {
  userAddress: string
}

/**
 * @deprecated Frozen legacy shell — not mounted from `page.tsx` (2026-08-11).
 * Product is driver-only via CandidateShell. Do not wire this back into routing.
 *
 * DeveloperShell - Contains all developer-role pages and routing.
 */
export default function DeveloperShell({ userAddress }: DeveloperShellProps) {
  const { currentPage, setCurrentPage, triggerJourneyStep, initialThreadId } = useUIStore()
  const { hasCompletedJourneyStep } = usePreferencesStore()
  const { user } = useAuthStore()

  const goBack = () => setCurrentPage(null)
  
  // First login journey modal - show welcome message for new developers
  useEffect(() => {
    if (userAddress && !hasCompletedJourneyStep('developer.firstLogin')) {
      const timer = setTimeout(() => {
        triggerJourneyStep('developer.firstLogin')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [userAddress, hasCompletedJourneyStep, triggerJourneyStep])

  if (currentPage === 'profile-setup') {
    return (
      <ProfileSetup
        role="developer"
        sessionUserId={userAddress}
        onComplete={goBack}
      />
    )
  }

  // Default: Developer Hub
  if (!currentPage) {
    return (
      <DeveloperHub
        userAddress={userAddress}
        onNavigate={(page) => {
          if (
            page === 'portfolio' ||
            page === 'resume' ||
            page === 'github' ||
            page === 'jobs' ||
            page === 'applications' ||
            page === 'profile-setup' ||
            page === 'messages'
          ) {
            setCurrentPage(page)
          }
        }}
      />
    )
  }

  if (currentPage === 'portfolio') {
    return <PortfolioPage userAddress={userAddress} onBack={goBack} />
  }

  if (currentPage === 'resume') {
    return (
      <div className='max-w-4xl mx-auto space-y-6'>
        <ResumeBuilder
          user={user}
          onBack={goBack}
          onSave={() => {
            goBack()
          }}
        />
      </div>
    )
  }

  /*
   Unified job discovery — same SimpleModeShell as candidates and drivers.
   Legacy `JobListings.tsx` deleted; this redirect keeps existing developer
   navigation working.
  */
  if (currentPage === 'jobs') {
    return <SimpleModeShell />
  }

  if (currentPage === 'messages') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MessageInbox
          sessionUserId={userAddress}
          onBack={goBack}
          initialThreadId={initialThreadId}
        />
      </div>
    )
  }

  // Any unrecognised page value (e.g. 'github', 'applications') falls back to the hub
  // rather than rendering a blank screen.
  if (currentPage) {
    setCurrentPage(null)
  }

  return null
}
