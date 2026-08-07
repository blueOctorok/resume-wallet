'use client'

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import ProfileSetup from '@/components/app/ProfileSetup'
import MessageInbox from '@/components/messaging/MessageInbox'
import DotApplicationFlow from '@/components/app/DotApplicationFlow'
import CareerCardView from '@/components/app/CareerCardView'
import CandidateHub from '@/components/hub/CandidateHub'
import CandidateInboxPage from '@/components/hub/CandidateInboxPage'
import CandidateAskAiPage from '@/components/hub/CandidateAskAiPage'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore, useNeedsOnboarding } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import HubOnboardingForm from '@/components/hub/HubOnboardingForm'

/** Routes this shell renders — anything else is reset to hub in an effect (never during render). */
const CANDIDATE_SHELL_PAGES: readonly PageType[] = [
  'profile-setup',
  'dotapp',
  'resume',
  'storm-resume',
  'developer-resume',
  'general-resume',
  'employment-verification',
  'mvr',
  'psp',
  'screening-consent',
  'portfolio',
  'github',
  // 'jobs' intentionally omitted — legacy nav targets get redirected to
  // Guided Mode below (uiMode='simple' + clear page) so we have ONE
  // job-discovery surface across the app.
  'hunt-desk',
  'applications',
  'career-card',
  'build',
  'messages',
  'inbox',
  'ask-ai',
]

const ResumeBuilder = dynamic(
  () => import('@/components/ResumeBuilder'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume builder...' fullScreen={false} /> }
)

const DeveloperResumeBlock = dynamic(
  () => import('@/components/blocks/DeveloperResumeBlock'),
  { ssr: false, loading: () => <LoadingScreen message='Loading developer resume…' fullScreen={false} /> }
)

const GeneralResumeBlock = dynamic(
  () => import('@/components/blocks/GeneralResumeBlock'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume builder…' fullScreen={false} /> }
)

const StormResumeBlock = dynamic(
  () => import('@/components/blocks/StormResumeBlock'),
  { ssr: false, loading: () => <LoadingScreen message='Loading STORM Resume…' fullScreen={false} /> }
)

const EmploymentVerificationBlock = dynamic(
  () => import('@/components/blocks/EmploymentVerificationBlock'),
  { ssr: false, loading: () => <LoadingScreen message='Loading…' fullScreen={false} /> }
)

const MyApplications = dynamic(
  () => import('@/components/MyApplications').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading applications...' fullScreen={false} /> }
)

const CandidateHuntDesk = dynamic(
  () => import('@/components/CandidateHuntDesk').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Opening Hunt Desk...' fullScreen={false} /> }
)

const MvrOrderForm = dynamic(
  () => import('@/components/MvrOrderForm').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading MVR order form...' fullScreen={false} /> }
)

const PspOrderForm = dynamic(
  () => import('@/components/PspOrderForm').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading PSP order form...' fullScreen={false} /> }
)

const ScreeningConsentBlock = dynamic(
  () => import('@/components/blocks/ScreeningConsentBlock').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading screening consent…' fullScreen={false} /> }
)

const PortfolioPage = dynamic(
  () => import('@/components/developer/PortfolioPage').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading portfolio...' fullScreen={false} /> }
)

const GitHubPage = dynamic(
  () => import('@/components/developer/GitHubPage').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading GitHub...' fullScreen={false} /> }
)

/**
 * CandidateShell — the composable hub shell for all non-employer users.
 *
 * Reads `currentPage` from UIStore and routes to the correct view.
 * Default home is the Career Card showroom (`null` / `career-card`).
 * Build (`build`) is the DQ board workspace.
 *
 * Each block's `pageRoute` in the registry maps to one of the cases below.
 */
export default function CandidateShell() {
  const { user, sessionUserId } = useAuthStore()
  const { currentPage, setCurrentPage, navigateToHub, initialThreadId, editingResumeId, setEditingResumeId } =
    useUIStore()
  const needsOnboarding = useNeedsOnboarding()
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)

  // Hub data must be fetched here (not in CandidateHub) so that both
  // Simple mode and Construct mode have installed blocks, onboarding state,
  // user profile, and the server-side UI mode preference available.
  useEffect(() => {
    if (sessionUserId) fetchHubData(sessionUserId)
  }, [sessionUserId, fetchHubData])

  const unknownCandidatePage =
    currentPage !== null && !CANDIDATE_SHELL_PAGES.includes(currentPage)

  /*
   Legacy `'jobs'` redirect: old bookmarks, journey configs, hub explore links,
   and Stormi tools all still navigate to `'jobs'`. Apply (job-first) mode has
   been removed, so we simply clear the page and land on the composable hub.
  */
  useEffect(() => {
    if (currentPage === 'jobs' || unknownCandidatePage) {
      setCurrentPage(null)
    }
  }, [currentPage, unknownCandidatePage, setCurrentPage])

  const goBack = useCallback(() => {
    setEditingResumeId(undefined)
    navigateToHub()
  }, [navigateToHub, setEditingResumeId])

  // Onboarding form renders as a portal (Modal), so it works in any mode.
  // Must live here (not CandidateHub) so it shows for Simple-mode users too.
  if (needsOnboarding) {
    return <HubOnboardingForm />
  }

  if (unknownCandidatePage) {
    return null
  }

  if (currentPage === 'profile-setup') {
    return (
      <ProfileSetup
        role='candidate'
        sessionUserId={sessionUserId ?? ''}
        onComplete={goBack}
      />
    )
  }

  if (currentPage === 'dotapp') {
    return (
      <DotApplicationFlow
        sessionUserId={sessionUserId ?? ''}
        userAddress={sessionUserId}
        onBack={goBack}
      />
    )
  }

  if (currentPage === 'resume') {
    return (
      <div className='max-w-4xl mx-auto space-y-6'>
        <ResumeBuilder
          user={user}
          onBack={goBack}
          existingResumeId={editingResumeId}
          onSave={() => goBack()}
        />
      </div>
    )
  }

  if (currentPage === 'storm-resume') {
    return <StormResumeBlock user={user} onBack={goBack} />
  }

  if (currentPage === 'developer-resume') {
    return (
      <DeveloperResumeBlock
        user={user}
        onBack={goBack}
        existingResumeId={editingResumeId}
        onSave={goBack}
      />
    )
  }

  if (currentPage === 'general-resume') {
    return (
      <GeneralResumeBlock
        user={user}
        onBack={goBack}
        existingResumeId={editingResumeId}
        onSave={goBack}
      />
    )
  }

  if (currentPage === 'employment-verification') {
    return <EmploymentVerificationBlock />
  }

  if (currentPage === 'mvr') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MvrOrderForm userAddress={sessionUserId ?? ''} onBack={goBack} />
      </div>
    )
  }

  if (currentPage === 'psp') {
    return (
      <div className='max-w-2xl mx-auto'>
        <PspOrderForm userAddress={sessionUserId ?? ''} onBack={goBack} />
      </div>
    )
  }

  if (currentPage === 'screening-consent') {
    return (
      <div className='max-w-2xl mx-auto'>
        <ScreeningConsentBlock userAddress={sessionUserId ?? ''} onBack={goBack} />
      </div>
    )
  }

  if (currentPage === 'portfolio') {
    return <PortfolioPage userAddress={sessionUserId ?? ''} onBack={goBack} />
  }

  if (currentPage === 'github') {
    return <GitHubPage userAddress={sessionUserId ?? ''} onBack={goBack} />
  }

  if (currentPage === 'hunt-desk') {
    return (
      <div className='relative z-0'>
        <CandidateHuntDesk onBack={goBack} userAddress={sessionUserId ?? null} />
      </div>
    )
  }

  if (currentPage === 'applications') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <MyApplications onBack={goBack} userAddress={sessionUserId ?? null} />
      </div>
    )
  }

  // Explicit Build workspace (DQ board)
  if (currentPage === 'build') {
    return <CandidateHub />
  }

  // Career Card is home — `null` (default after login) and `career-card` both land here
  if (currentPage === 'career-card' || currentPage === null) {
    return <CareerCardView onBack={() => setCurrentPage('build')} />
  }

  if (currentPage === 'messages') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MessageInbox
          sessionUserId={sessionUserId ?? ''}
          onBack={goBack}
          initialThreadId={initialThreadId}
        />
      </div>
    )
  }

  if (currentPage === 'inbox') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <CandidateInboxPage />
      </div>
    )
  }

  if (currentPage === 'ask-ai') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <CandidateAskAiPage />
      </div>
    )
  }

  return <CareerCardView onBack={() => setCurrentPage('build')} />
}
