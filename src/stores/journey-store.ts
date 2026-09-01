import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './auth-store'
import { useDriverHubStore } from './driver-hub-store'
import { useHubBlocksStore } from './hub-blocks-store'
import { useDotApplicationStore } from './dot-application-store'
import type { MvrRecord, PspRecord, ResumeData } from './types'
import {
  type JourneyProgress,
  type BlockProgressData,
  type EmployerProgressData,
  calculateBlockJourney,
  calculateEmployerProgress,
} from '@/lib/journey-progress'
import { useEmployerHiringPathStore } from '@/stores/employer-journey-snapshot-store'
import { useEmploymentVerificationBlockStore } from '@/stores/employment-verification-block-store'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'

/**
 * Journey Store - Manages Stormi Journey Guide state
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
  /** Ephemeral: My Hub → Stormi Journey Guide re-opens the hub welcome modal even if it was completed. */
  requestWalkthroughReplay: boolean
  /** Increments on every `requestWalkthrough()` so the hub can remount + refetch AI even if replay was already true. */
  walkthroughRequestNonce: number
}

interface JourneyActions {
  openGuide: () => void
  closeGuide: () => void
  toggleGuide: () => void
  setHasSeenWelcome: (seen: boolean) => void
  /** Bump replay nonce so CandidateHub remounts the walkthrough (e.g. My Hub → Stormi Journey Guide) */
  requestWalkthrough: () => void
  clearWalkthroughRequest: () => void
}

const initialState: JourneyState = {
  isGuideOpen: false,
  hasSeenWelcome: false,
  lastDismissedAt: null,
  requestWalkthroughReplay: false,
  walkthroughRequestNonce: 0,
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

      requestWalkthrough: () =>
        set((s) => ({
          requestWalkthroughReplay: true,
          walkthroughRequestNonce: s.walkthroughRequestNonce + 1,
        })),

      clearWalkthroughRequest: () => set({ requestWalkthroughReplay: false }),
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
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const hubStore = useDriverHubStore()
  const { isApplicationCompleted, currentForm } = useDotApplicationStore()
  const evRequests = useEmploymentVerificationBlockStore((s) => s.requests)

  const employerHiring = useEmployerHiringPathStore((s) => s.hiring)

  // Employer journey — fed by `EmployerHub` via `useEmployerHiringPathStore`
  if (userRole === 'employer') {
    const data: EmployerProgressData = employerHiring?.snapshot
      ? { ...employerHiring.snapshot, isWalletConnected }
      : {
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

  // DEC-2026-07-001: journey completion uses isComplete only (not legacy VERIFIED / Base tx)
  const dotCompleteFromHub =
    hubStore.dotApplications.some((app) => app.isComplete) ||
    (hubStore.stats?.completedDotApps ?? 0) > 0
  const dotDone = dotCompleteFromHub || isApplicationCompleted

  const mvrTerminal = (m: MvrRecord) =>
    m.orderStatus === 'completed' ||
    m.orderStatus === 'needs_review' ||
    Boolean(m.hasResult)

  const pspTerminal = (p: PspRecord) =>
    p.orderStatus === 'completed' ||
    p.orderStatus === 'needs_review' ||
    Boolean(p.hasResult)

  const resumes = hubStore.resumes as ResumeData[]
  const hasDriverResume = resumes.some((r) => r.sourceRole === 'driver')
  const hasDeveloperResume = resumes.some((r) => r.sourceRole === 'developer')
  const hasGeneralResume = resumes.some((r) => r.sourceRole === 'general')

  // Prefer hub-blocks identity (always loaded for candidates); fall back to
  // driver-hub profile which may still be snake_case from the API.
  const driverProfile = hubStore.profile as Record<string, unknown> | null
  const identityProfile = {
    firstName:
      userProfile?.firstName ||
      (typeof driverProfile?.firstName === 'string' ? driverProfile.firstName : null) ||
      (typeof driverProfile?.first_name === 'string' ? driverProfile.first_name : null),
    lastName:
      userProfile?.lastName ||
      (typeof driverProfile?.lastName === 'string' ? driverProfile.lastName : null) ||
      (typeof driverProfile?.last_name === 'string' ? driverProfile.last_name : null),
    email:
      userProfile?.email ||
      (typeof driverProfile?.email === 'string' ? driverProfile.email : null),
    phone:
      userProfile?.phone ||
      (typeof driverProfile?.phone === 'string' ? driverProfile.phone : null),
    city:
      userProfile?.city ||
      (typeof driverProfile?.city === 'string' ? driverProfile.city : null),
    state:
      userProfile?.state ||
      (typeof driverProfile?.state === 'string' ? driverProfile.state : null),
  }

  const data: BlockProgressData = {
    isWalletConnected,
    profileCompleteness: hubStore.stats?.profileCompleteness ?? 0,
    identityProfile,
    hasResume: resumes.length > 0,
    hasDriverResume,
    hasDeveloperResume,
    hasGeneralResume,
    resumeCount: resumes.length,
    dotAppComplete: dotDone,
    // DEC-2026-07-001: whole-app VERIFIED / Base tx is not issuer verification
    dotAppVerified: false,
    dotAppInProgress:
      !dotDone &&
      (hubStore.dotApplications.some((app) => app.isInProgress) ||
        (hubStore.stats?.inProgressDotApps ?? 0) > 0 ||
        currentForm > 1),
    mvrComplete: hubStore.mvrRecords.some(mvrTerminal),
    hasMvrOrder: hubStore.mvrRecords.length > 0,
    pspComplete: hubStore.pspRecords.some(pspTerminal),
    hasPspOrder: hubStore.pspRecords.length > 0,
    hasAppliedToJobs: hubStore.jobApplications.length > 0,
    jobApplicationCount: hubStore.jobApplications.length,
    hasPortfolioUrl: Boolean(hubStore.portfolio?.portfolioUrl?.trim()),
    hasPortfolioProjects: false,
    portfolioProjectCount: 0,
    hasConnectedGithub: Boolean(hubStore.github?.username?.trim()),
    hasScreeningConsentBundle: hubStore.stats?.hasScreeningConsentBundle === true,
    hasVerifiedAttestation: (hubStore.stats?.attestationCount ?? 0) > 0,
    employmentVerificationVerified: evRequests.some((r) => isDkimVerifiedRequest(r)),
    employmentVerificationPending: evRequests.some(
      (r) => r.status === 'VERIFICATION_REQUESTED' || r.status === 'VERIFICATION_IN_PROGRESS',
    ),
  }

  const blockTypes = installedBlocks.map((b) => b.blockType)
  return calculateBlockJourney(blockTypes, data)
}

// Selector hooks
export const useIsGuideOpen = () => useJourneyStore((state) => state.isGuideOpen)
export const useHasSeenWelcome = () => useJourneyStore((state) => state.hasSeenWelcome)
