'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore } from '@/stores'
import CompanyOnboarding from '@/components/app/CompanyOnboarding'
import MessageInbox from '@/components/messaging/MessageInbox'

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

const StormChainView = dynamic(
  () => import('@/components/StormChainView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading STORM Token...' fullScreen={false} />,
  }
)

interface EmployerShellProps {
  walletAddress: string
}

// Pages that EmployerShell knows how to render
const KNOWN_PAGES = new Set([
  'company-setup',
  'applicants',
  'talent-search',
  'post-job',
  'team',
  'company-profile',
  'stormchain',
  'messages',
])

/**
 * EmployerShell - Contains all employer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function EmployerShell({ walletAddress }: EmployerShellProps) {
  const { currentPage, setCurrentPage, triggerJourneyStep, initialThreadId } = useUIStore()

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
      <CompanyOnboarding
        onComplete={() => setCurrentPage(null)}
      />
    )
  }

  if (currentPage === 'applicants') {
    return <ApplicantsPage walletAddress={walletAddress} onBack={goBack} />
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
      <CompanyOnboarding
        onComplete={() => setCurrentPage(null)}
        showBackButton={true}
      />
    )
  }

  if (currentPage === 'stormchain') {
    return <StormChainView onBack={goBack} />
  }

  if (currentPage === 'messages') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MessageInbox
          walletAddress={walletAddress}
          onBack={goBack}
          initialThreadId={initialThreadId}
        />
      </div>
    )
  }

  // Default: Employer Hub (when currentPage is null or being reset).
  // onNavigate accepts any string — KNOWN_PAGES validation in the useEffect
  // above will bounce unknown routes back to the hub.
  return (
    <EmployerHub
      walletAddress={walletAddress}
      onNavigate={(page) => {
        if (KNOWN_PAGES.has(page)) {
          setCurrentPage(page)
        }
      }}
    />
  )
}
