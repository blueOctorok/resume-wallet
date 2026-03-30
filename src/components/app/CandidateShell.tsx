'use client'

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import ProfileSetup from '@/components/app/ProfileSetup'
import MessageInbox from '@/components/messaging/MessageInbox'
import StormChainView from '@/components/StormChainView'
import DotApplicationFlow from '@/components/app/DotApplicationFlow'
import CareerCardView from '@/components/app/CareerCardView'
import CandidateHub from '@/components/hub/CandidateHub'
import { useAuthStore, useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'

/** Routes this shell renders — anything else is reset to hub in an effect (never during render). */
const CANDIDATE_SHELL_PAGES: readonly PageType[] = [
  'profile-setup',
  'dotapp',
  'resume',
  'developer-resume',
  'general-resume',
  'employment-verification',
  'mvr',
  'portfolio',
  'github',
  'jobs',
  'hunt-desk',
  'applications',
  'stormchain',
  'career-card',
  'messages',
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

const EmploymentVerificationBlock = dynamic(
  () => import('@/components/blocks/EmploymentVerificationBlock'),
  { ssr: false, loading: () => <LoadingScreen message='Loading…' fullScreen={false} /> }
)

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading jobs...' fullScreen={false} /> }
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
 * Default (null) renders CandidateHub which shows the block grid.
 *
 * Each block's `pageRoute` in the registry maps to one of the cases below.
 */
export default function CandidateShell() {
  const { user, walletAddress } = useAuthStore()
  const { currentPage, setCurrentPage, navigateToHub, initialThreadId, editingResumeId, setEditingResumeId } =
    useUIStore()

  const unknownCandidatePage =
    currentPage !== null && !CANDIDATE_SHELL_PAGES.includes(currentPage)

  useEffect(() => {
    if (unknownCandidatePage) {
      setCurrentPage(null)
    }
  }, [unknownCandidatePage, setCurrentPage])

  const goBack = useCallback(() => {
    setEditingResumeId(undefined)
    navigateToHub()
  }, [navigateToHub, setEditingResumeId])

  if (unknownCandidatePage) {
    return null
  }

  if (currentPage === 'profile-setup') {
    return (
      <ProfileSetup
        role='candidate'
        walletAddress={walletAddress ?? ''}
        onComplete={goBack}
        onSkip={goBack}
      />
    )
  }

  if (currentPage === 'dotapp') {
    return (
      <DotApplicationFlow
        walletAddress={walletAddress ?? ''}
        userAddress={user?.address}
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
        <MvrOrderForm userAddress={user?.address ?? ''} onBack={goBack} />
      </div>
    )
  }

  if (currentPage === 'portfolio') {
    return <PortfolioPage userAddress={user?.address ?? ''} onBack={goBack} />
  }

  if (currentPage === 'github') {
    return <GitHubPage userAddress={user?.address ?? ''} onBack={goBack} />
  }

  if (currentPage === 'jobs') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <JobListings onBack={goBack} userAddress={user?.address ?? null} />
      </div>
    )
  }

  if (currentPage === 'hunt-desk') {
    return (
      <div className='relative z-0'>
        <CandidateHuntDesk onBack={goBack} userAddress={user?.address ?? null} />
      </div>
    )
  }

  if (currentPage === 'applications') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <MyApplications onBack={goBack} userAddress={user?.address ?? null} />
      </div>
    )
  }

  if (currentPage === 'stormchain') {
    return <StormChainView onBack={goBack} />
  }

  if (currentPage === 'career-card') {
    return <CareerCardView onBack={goBack} />
  }

  if (currentPage === 'messages') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MessageInbox
          walletAddress={walletAddress ?? ''}
          onBack={goBack}
          initialThreadId={initialThreadId}
        />
      </div>
    )
  }

  // Default: the composable hub
  return <CandidateHub />
}
