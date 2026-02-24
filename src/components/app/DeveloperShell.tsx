'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore, usePreferencesStore, useAuthStore } from '@/stores'

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

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Jobs...' fullScreen={false} />,
  }
)

interface DeveloperShellProps {
  userAddress: string
}

/**
 * DeveloperShell - Contains all developer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function DeveloperShell({ userAddress }: DeveloperShellProps) {
  const { currentPage, setCurrentPage, triggerJourneyStep } = useUIStore()
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
            page === 'applications'
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

  if (currentPage === 'jobs') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <JobListings onBack={goBack} userAddress={userAddress} />
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
