import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from './types'
import { useAuthStore } from './auth-store'
import { useDriverHubStore } from './driver-hub-store'
import { useDotApplicationStore } from './dot-application-store'
import {
  type JourneyProgress,
  type DriverProgressData,
  type EmployerProgressData,
  type DeveloperProgressData,
  calculateDriverProgress,
  calculateEmployerProgress,
  calculateDeveloperProgress,
  getEmptyProgress,
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

// Persisted state - only UI preferences
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
 * Hook to calculate current journey progress
 * Pulls from multiple stores to build a complete picture
 */
export function useJourneyProgress(): JourneyProgress {
  // Auth state
  const { user, userRole } = useAuthStore()
  const isWalletConnected = !!user
  
  // Hub data (for drivers)
  const hubStore = useDriverHubStore()
  
  // DOT application state
  const { isApplicationCompleted } = useDotApplicationStore()

  // Build progress based on role
  if (userRole === 'driver') {
    // Check if any DOT app has blockchain verification
    const hasVerifiedDotApp = hubStore.dotApplications.some(
      (app) => app.blockchainTxHash != null
    )
    
    const data: DriverProgressData = {
      isWalletConnected,
      hasResume: hubStore.hasResume || hubStore.resumes.length > 0,
      resumeCount: hubStore.resumes.length,
      hasDotApplication: hubStore.dotApplications.length > 0,
      dotAppComplete: isApplicationCompleted || hubStore.stats?.completedDotApps ? hubStore.stats.completedDotApps > 0 : false,
      dotAppVerified: hasVerifiedDotApp || (hubStore.stats?.verifiedDotApps ? hubStore.stats.verifiedDotApps > 0 : false),
      dotAppInProgress: hubStore.stats?.inProgressDotApps ? hubStore.stats.inProgressDotApps > 0 : false,
      hasMvrRecord: hubStore.mvrRecords.length > 0,
      mvrRecordCount: hubStore.mvrRecords.length,
      profileCompleteness: hubStore.stats?.profileCompleteness ?? 0,
      hasAppliedToJobs: hubStore.jobApplications.length > 0,
      jobApplicationCount: hubStore.jobApplications.length,
    }
    return calculateDriverProgress(data)
  }

  if (userRole === 'employer') {
    // For employers, we need different data sources
    // Using placeholder data for now - can be connected to employer store later
    const data: EmployerProgressData = {
      isWalletConnected,
      hasCompanyProfile: false, // TODO: connect to employer profile store
      companyProfileComplete: false,
      hasPostedJob: false, // TODO: connect to job posting store
      jobPostCount: 0,
      hasReviewedApplicants: false,
      applicantCount: 0,
      hasRequestedVerification: false,
    }
    return calculateEmployerProgress(data)
  }

  if (userRole === 'developer') {
    // For developers, we need different data sources
    const data: DeveloperProgressData = {
      isWalletConnected,
      hasPortfolioProjects: false, // TODO: connect to portfolio store
      portfolioProjectCount: 0,
      hasResume: hubStore.hasResume || hubStore.resumes.length > 0,
      hasConnectedGithub: false, // TODO: connect to github integration
      hasCareerScore: false,
      careerScore: 0,
      hasAppliedToJobs: hubStore.jobApplications.length > 0,
      jobApplicationCount: hubStore.jobApplications.length,
    }
    return calculateDeveloperProgress(data)
  }

  // No role selected yet
  return getEmptyProgress(userRole)
}

// Selector hooks
export const useIsGuideOpen = () => useJourneyStore((state) => state.isGuideOpen)
export const useHasSeenWelcome = () => useJourneyStore((state) => state.hasSeenWelcome)
