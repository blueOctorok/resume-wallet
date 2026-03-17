'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import ProfileSetup from '@/components/app/ProfileSetup'
import MessageInbox from '@/components/messaging/MessageInbox'
import StormChainView from '@/components/StormChainView'
import DotApplicationFlow from '@/components/app/DotApplicationFlow'
import CareerCardView from '@/components/app/CareerCardView'
import CandidateHub from '@/components/hub/CandidateHub'
import { useAuthStore, useUIStore } from '@/stores'

const ResumeBuilder = dynamic(
  () => import('@/components/ResumeBuilder'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume builder...' fullScreen={false} /> }
)

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading jobs...' fullScreen={false} /> }
)

const MyApplications = dynamic(
  () => import('@/components/MyApplications').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading applications...' fullScreen={false} /> }
)

const MvrOrderForm = dynamic(
  () => import('@/components/MvrOrderForm').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading MVR order form...' fullScreen={false} /> }
)

const PortfolioPage = dynamic(
  () => import('@/components/developer/PortfolioPage').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading portfolio...' fullScreen={false} /> }
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
  const { currentPage, setCurrentPage, initialThreadId, editingResumeId, setEditingResumeId } = useUIStore()

  const goBack = useCallback(() => {
    setEditingResumeId(undefined)
    setCurrentPage(null)
  }, [setCurrentPage, setEditingResumeId])

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

  if (currentPage === 'jobs') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <JobListings onBack={goBack} userAddress={user?.address ?? null} />
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
  if (!currentPage) {
    return <CandidateHub />
  }

  // Unknown page — fall back to hub rather than blank screen
  if (currentPage) {
    setCurrentPage(null)
  }

  return null
}
