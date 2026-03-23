'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { PageType } from '@/stores/types'
import {
  calculateEmployerProgress,
  type EmployerProgressData,
  type JourneyProgress,
} from '@/lib/journey-progress'
import { useEmployerHiringPathStore } from '@/stores/employer-journey-snapshot-store'
import PathGuidance from './PathGuidance'
import CareerPathSteps from './CareerPathSteps'
import MiniEmployerHiringCard from './MiniEmployerHiringCard'

export interface EmployerPathSidebarProps {
  variant: 'sticky' | 'drawer'
  id?: string
  onCloseDrawer?: () => void
  onNavigate: (view: string) => void
  /**
   * Sticky rail: pass live `JourneyProgress` from `EmployerHub` so the first paint is correct
   * (store sync runs in useEffect after paint).
   */
  progressOverride?: JourneyProgress
  /** Sticky: same source as progress — drives the 3-step highlight */
  pathSummary?: {
    companyProfileComplete: boolean
    hasPostedJob: boolean
  }
  companyName?: string | null
  activeJobs?: number
  totalApplicants?: number
  pendingReview?: number
  className?: string
}

const EMPTY_EMPLOYER: EmployerProgressData = {
  isWalletConnected: true,
  hasCompanyProfile: false,
  companyProfileComplete: false,
  hasPostedJob: false,
  jobPostCount: 0,
  hasReviewedApplicants: false,
  applicantCount: 0,
  hasRequestedVerification: false,
}

export default function EmployerPathSidebar({
  variant,
  id,
  onCloseDrawer,
  onNavigate,
  progressOverride,
  pathSummary,
  companyName: companyNameProp,
  activeJobs: activeJobsProp,
  totalApplicants: totalApplicantsProp,
  pendingReview: pendingReviewProp,
  className,
}: EmployerPathSidebarProps) {
  const hiring = useEmployerHiringPathStore((s) => s.hiring)

  const companyName = companyNameProp ?? hiring?.companyName ?? null
  const activeJobs = activeJobsProp ?? hiring?.activeJobs ?? 0
  const totalApplicants = totalApplicantsProp ?? hiring?.totalApplicants ?? 0
  const pendingReview = pendingReviewProp ?? hiring?.pendingReview ?? 0

  const fromStore = useMemo(
    () => calculateEmployerProgress(hiring?.snapshot ?? EMPTY_EMPLOYER),
    [hiring],
  )
  const progress = progressOverride ?? fromStore

  const companyProfileComplete =
    pathSummary?.companyProfileComplete ?? hiring?.snapshot?.companyProfileComplete ?? false
  const hasPostedJob = pathSummary?.hasPostedJob ?? hiring?.snapshot?.hasPostedJob ?? false

  const handleNavigate = (target: PageType) => {
    onCloseDrawer?.()
    if (target) onNavigate(String(target))
  }

  const body = (
    <div className='space-y-5'>
      <PathGuidance
        audience='employer'
        companyName={companyName}
        companyProfileComplete={companyProfileComplete}
        hasPostedJob={hasPostedJob}
        overallProgress={progress.overallProgress}
      />
      <hr className='border-gray-200 dark:border-gray-700' />
      <CareerPathSteps onNavigate={handleNavigate} progressOverride={progress} />
      <hr className='border-gray-200 dark:border-gray-700' />
      <MiniEmployerHiringCard
        companyName={companyName}
        activeJobs={activeJobs}
        totalApplicants={totalApplicants}
        pendingReview={pendingReview}
        onPostJob={() => {
          onCloseDrawer?.()
          onNavigate('post-job')
        }}
        onApplicants={() => {
          onCloseDrawer?.()
          onNavigate('applicants')
        }}
        onFindTalent={() => {
          onCloseDrawer?.()
          onNavigate('talent-search')
        }}
      />
    </div>
  )

  if (variant === 'sticky') {
    return (
      <aside
        id={id}
        className={cn(
          'hidden lg:block w-80 shrink-0 self-start sticky top-24',
          'rounded-2xl border border-gray-200 dark:border-gray-700',
          'bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-4 shadow-sm',
          className,
        )}
      >
        {body}
      </aside>
    )
  }

  return <div className={cn('space-y-5', className)}>{body}</div>
}
