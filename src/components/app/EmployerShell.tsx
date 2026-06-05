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

interface EmployerShellProps {
  sessionUserId: string
}

// Pages that EmployerShell knows how to render
const KNOWN_PAGES = new Set([
  'company-setup',
  'applicants',
  'talent-search',
  'post-job',
  'team',
  'company-profile',
  'messages',
])

/**
 * EmployerShell - Contains all employer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function EmployerShell({ sessionUserId }: EmployerShellProps) {
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
    return <ApplicantsPage sessionUserId={sessionUserId} onBack={goBack} />
  }

  if (currentPage === 'talent-search') {
    return <TalentSearchPage sessionUserId={sessionUserId} onBack={goBack} />
  }

  if (currentPage === 'post-job') {
    return (
      <JobPostingForm
        sessionUserId={sessionUserId}
        onBack={goBack}
        onSuccess={() => {
          triggerJourneyStep('employer.jobPosted')
          goBack()
        }}
      />
    )
  }

  if (currentPage === 'team') {
    return <TeamManagement sessionUserId={sessionUserId} onBack={goBack} />
  }

  if (currentPage === 'company-profile') {
    return (
      <CompanyOnboarding
        onComplete={() => setCurrentPage(null)}
        showBackButton={true}
      />
    )
  }

  if (currentPage === 'messages') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MessageInbox
          sessionUserId={sessionUserId}
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
      sessionUserId={sessionUserId}
      onNavigate={(page) => {
        if (KNOWN_PAGES.has(page)) {
          setCurrentPage(page)
        }
      }}
    />
  )
}
