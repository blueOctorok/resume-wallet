'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore } from '@/stores'
import MotorCarrierOnboarding from '@/components/app/MotorCarrierOnboarding'

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

const ReportsPage = dynamic(
  () => import('@/components/employer/ReportsPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading reports...' fullScreen={false} />,
  }
)

interface EmployerShellProps {
  walletAddress: string
}

// Pages that EmployerShell knows how to render
const KNOWN_PAGES = new Set([
  'company-setup',
  'applicants',
  'find-drivers',
  'talent-search',
  'post-job',
  'team',
  'company-profile',
  'reports',
])

/**
 * EmployerShell - Contains all employer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function EmployerShell({ walletAddress }: EmployerShellProps) {
  const { currentPage, setCurrentPage, triggerJourneyStep } = useUIStore()

  const goBack = () => setCurrentPage(null)

  // Reset unknown pages back to hub.
  // Must be called unconditionally (Rules of Hooks) — the condition is inside.
  useEffect(() => {
    if (currentPage && !KNOWN_PAGES.has(currentPage)) {
      setCurrentPage(null)
    }
  }, [currentPage, setCurrentPage])

  // Motor Carrier onboarding — blocking gate for new company owners
  if (currentPage === 'company-setup') {
    return (
      <MotorCarrierOnboarding
        onComplete={() => setCurrentPage(null)}
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

  if (currentPage === 'company-profile') {
    return (
      <MotorCarrierOnboarding
        onComplete={() => setCurrentPage(null)}
        showBackButton={true}
      />
    )
  }

  if (currentPage === 'reports') {
    return <ReportsPage walletAddress={walletAddress} onBack={goBack} />
  }

  // Default: Employer Hub (when currentPage is null or being reset)
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
          page === 'company-setup' ||
          page === 'reports' ||
          page === 'team'
        ) {
          setCurrentPage(page)
        }
      }}
    />
  )
}
