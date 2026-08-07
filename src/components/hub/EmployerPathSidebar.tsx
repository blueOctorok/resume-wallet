'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navControlButtonClass } from '@/lib/navigation-styles'
import { useTheme } from '@/contexts/ThemeContext'
import { getBlockColor } from '@/lib/block-registry'
import Button from '@/components/ui/Button'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
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
  /** Sticky rail only: collapse control for desktop clutter-free layout */
  onRequestCollapse?: () => void
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
  onRequestCollapse,
}: EmployerPathSidebarProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const pathVaultGlow = getBlockColor('general-resume').glowColor
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

  const divider = (
    <div
      aria-hidden
      className='h-px shrink-0 bg-gradient-to-r from-transparent via-slate-300/55 to-transparent dark:via-teal-400/20'
    />
  )

  const rail = (
    <VaultCredentialChrome
      isDark={isDark}
      glowColor={pathVaultGlow}
      hasRoute
      showSigil={false}
      className='w-full max-w-full min-w-0'
      style={
        variant === 'sticky'
          ? {
              filter: isDark
                ? 'drop-shadow(0 4px 22px rgba(0,0,0,0.5))'
                : 'drop-shadow(0 4px 14px rgba(15,23,42,0.1))',
            }
          : undefined
      }
    >
      <div
        className={cn(
          'relative flex min-h-0 min-w-0 flex-col gap-4 px-3.5 pb-[14px] pt-3.5',
          onRequestCollapse && 'pr-11',
        )}
      >
        {onRequestCollapse && (
          <div className='absolute right-4 top-3 z-20'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn('!h-8 !w-8 !p-1.5 shadow-sm backdrop-blur-sm', navControlButtonClass(isDark))}
              onClick={onRequestCollapse}
              aria-label='Collapse job path panel'
              title='Collapse job path'
            >
              <ChevronRight className='h-4 w-4' aria-hidden />
            </Button>
          </div>
        )}
        <PathGuidance
          audience='employer'
          companyName={companyName}
          companyProfileComplete={companyProfileComplete}
          hasPostedJob={hasPostedJob}
          overallProgress={progress.overallProgress}
        />
        {divider}
        <CareerPathSteps onNavigate={handleNavigate} progressOverride={progress} />
        {divider}
        <MiniEmployerHiringCard
          embedded
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
    </VaultCredentialChrome>
  )

  if (variant === 'sticky') {
    return (
      <aside
        id={id}
        className={cn(
          'hidden xl:block w-80 shrink-0 self-start sticky top-24 p-0',
          className,
        )}
      >
        {rail}
      </aside>
    )
  }

  return <div className={cn('min-w-0 max-w-full overflow-x-hidden', className)}>{rail}</div>
}
