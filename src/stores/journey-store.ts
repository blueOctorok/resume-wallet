import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './auth-store'
import { useDriverHubStore } from './driver-hub-store'
import { useHubBlocksStore } from './hub-blocks-store'
import { useDotApplicationStore } from './dot-application-store'
import {
  type JourneyProgress,
  type BlockProgressData,
  type EmployerProgressData,
  calculateBlockJourney,
  calculateEmployerProgress,
} from '@/lib/journey-progress'

/**
 * Journey Store - Manages AvA Journey Guide state
 *
 * Responsible for:
 * - Guide visibility (open/closed)
 * - Aggregating progress from other stores
 * - Tracking first-time guide displays
 */

interface JourneyState {
  isGuideOpen: boolean
  hasSeenWelcome: boolean
  lastDismissedAt: string | null
}

interface JourneyActions {
  openGuide: () => void
  closeGuide: () => void
  toggleGuide: () => void
  setHasSeenWelcome: (seen: boolean) => void
}

const initialState: JourneyState = {
  isGuideOpen: false,
  hasSeenWelcome: false,
  lastDismissedAt: null,
}

export const useJourneyStore = create<JourneyState & JourneyActions>()(
  persist(
    (set) => ({
      ...initialState,

      openGuide: () => set({ isGuideOpen: true }),

      closeGuide: () => set({
        isGuideOpen: false,
        lastDismissedAt: new Date().toISOString(),
      }),

      toggleGuide: () => set((state) => ({
        isGuideOpen: !state.isGuideOpen,
        lastDismissedAt: state.isGuideOpen ? new Date().toISOString() : state.lastDismissedAt,
      })),

      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
    }),
    {
      name: 'journey-guide',
      partialize: (state) => ({
        hasSeenWelcome: state.hasSeenWelcome,
        lastDismissedAt: state.lastDismissedAt,
      }),
    }
  )
)

/**
 * Hook to calculate current journey progress.
 *
 * For candidates/drivers/developers: block-inferred journey.
 * For employers: role-based journey (separate hub system).
 */
export function useJourneyProgress(): JourneyProgress {
  const { user, userRole } = useAuthStore()
  const isWalletConnected = !!user

  // All hooks must be called unconditionally (Rules of Hooks) even if
  // the employer branch doesn't use them.
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)
  const hubStore = useDriverHubStore()
  const { isApplicationCompleted } = useDotApplicationStore()

  // Employer journey stays role-based (they have EmployerBlockGrid, not the composable hub)
  if (userRole === 'employer') {
    const data: EmployerProgressData = {
      isWalletConnected,
      hasCompanyProfile: false,
      companyProfileComplete: false,
      hasPostedJob: false,
      jobPostCount: 0,
      hasReviewedApplicants: false,
      applicantCount: 0,
      hasRequestedVerification: false,
    }
    return calculateEmployerProgress(data)
  }

  const hasVerifiedDotApp = hubStore.dotApplications.some(
    (app) => app.blockchainTxHash != null
  )

  const data: BlockProgressData = {
    isWalletConnected,
    profileCompleteness: hubStore.stats?.profileCompleteness ?? 0,
    hasResume: hubStore.hasResume || hubStore.resumes.length > 0,
    resumeCount: hubStore.resumes.length,
    dotAppComplete: isApplicationCompleted || (hubStore.stats?.completedDotApps ? hubStore.stats.completedDotApps > 0 : false),
    dotAppVerified: hasVerifiedDotApp || (hubStore.stats?.verifiedDotApps ? hubStore.stats.verifiedDotApps > 0 : false),
    dotAppInProgress: hubStore.stats?.inProgressDotApps ? hubStore.stats.inProgressDotApps > 0 : false,
    hasMvrRecord: hubStore.mvrRecords.length > 0,
    hasAppliedToJobs: hubStore.jobApplications.length > 0,
    jobApplicationCount: hubStore.jobApplications.length,
    hasPortfolioProjects: false,
    portfolioProjectCount: 0,
    hasConnectedGithub: false,
  }

  const blockTypes = installedBlocks.map((b) => b.blockType)
  return calculateBlockJourney(blockTypes, data)
}

// Selector hooks
export const useIsGuideOpen = () => useJourneyStore((state) => state.isGuideOpen)
export const useHasSeenWelcome = () => useJourneyStore((state) => state.hasSeenWelcome)
