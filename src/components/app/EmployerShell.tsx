'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore, usePreferencesStore } from '@/stores'

const EmployerHub = dynamic(
  () => import('@/components/EmployerHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Employer Hub...' fullScreen={false} />,
  }
)

const ApplicantsPage = dynamic(
  () => import('@/components/employer/ApplicantsPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading applicants...' fullScreen={false} />,
  }
)

const FindDriversPage = dynamic(
  () => import('@/components/employer/FindDriversPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading driver search...' fullScreen={false} />,
  }
)

const TalentSearchPage = dynamic(
  () => import('@/components/employer/TalentSearchPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading talent search...' fullScreen={false} />,
  }
)

const JobPostingForm = dynamic(
  () => import('@/components/employer/JobPostingForm').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading job form...' fullScreen={false} />,
  }
)

const TeamManagement = dynamic(
  () => import('@/components/employer/TeamManagement').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading team...' fullScreen={false} />,
  }
)

interface EmployerShellProps {
  walletAddress: string
}

/**
 * EmployerShell - Contains all employer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function EmployerShell({ walletAddress }: EmployerShellProps) {
  const { currentPage, setCurrentPage, triggerJourneyStep } = useUIStore()
  const { hasCompletedJourneyStep } = usePreferencesStore()

  const goBack = () => setCurrentPage(null)
  
  // First login journey modal - show welcome message for new employers
  useEffect(() => {
    if (walletAddress && !hasCompletedJourneyStep('employer.firstLogin')) {
      const timer = setTimeout(() => {
        triggerJourneyStep('employer.firstLogin')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [walletAddress, hasCompletedJourneyStep, triggerJourneyStep])

  // Default: Employer Hub
  if (!currentPage) {
    return (
      <EmployerHub
        walletAddress={walletAddress}
        onNavigate={(page) => {
          if (
            page === 'post-job' ||
            page === 'jobs' ||
            page === 'applicants' ||
            page === 'find-drivers' ||
            page === 'talent-search' ||
            page === 'company-profile' ||
            page === 'reports' ||
            page === 'team'
          ) {
            setCurrentPage(page)
          }
        }}
      />
    )
  }

  if (currentPage === 'applicants') {
    return <ApplicantsPage walletAddress={walletAddress} onBack={goBack} />
  }

  if (currentPage === 'find-drivers') {
    return <FindDriversPage walletAddress={walletAddress} onBack={goBack} />
  }

  if (currentPage === 'talent-search') {
    return <TalentSearchPage walletAddress={walletAddress} onBack={goBack} />
  }

  if (currentPage === 'post-job') {
    return (
      <JobPostingForm
        walletAddress={walletAddress}
        onBack={goBack}
        onSuccess={() => {
          triggerJourneyStep('employer.jobPosted')
          goBack()
        }}
      />
    )
  }

  if (currentPage === 'team') {
    return <TeamManagement walletAddress={walletAddress} onBack={goBack} />
  }

  // Any unrecognised page value (e.g. 'company-profile') falls back to the hub
  // rather than rendering a blank screen.
  if (currentPage) {
    setCurrentPage(null)
  }

  return null
}
