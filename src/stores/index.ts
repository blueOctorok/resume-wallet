/**
 * Zustand Store Exports
 * 
 * Central export for all application stores.
 * Import from '@/stores' for convenience.
 * 
 * Architecture:
 * - useAuthStore: User authentication, wallet, role
 * - useDotApplicationStore: DOT form data, submission state
 * - useDriverHubStore: Hub dashboard data (resumes, MVR, jobs)
 * - useUIStore: Navigation, modals, UI state
 * - usePreferencesStore: User preferences (persisted)
 */

// Auth Store
export { 
  useAuthStore,
  useWalletAddress,
  useUserRole,
  useIsAuthenticated,
} from './auth-store'

// DOT Application Store
export { 
  useDotApplicationStore,
  useCurrentForm,
  useFormData,
  useHasUnsavedChanges,
  useIsSubmitting,
} from './dot-application-store'

// Driver Hub Store
export { 
  useDriverHubStore,
  useDotApplications,
  useResumes,
  useHubStats,
  useHubIsLoading,
} from './driver-hub-store'

// UI Store
export { 
  useUIStore,
  useCurrentPage,
  useIsModalOpen,
  useIsMounted,
  useDriverJourneyState,
  useActiveJourneyStep,
  useShowJourneyModal,
  createInitialJourneyState,
} from './ui-store'

// Preferences Store
export {
  usePreferencesStore,
  useShowJourneyModals,
} from './preferences-store'

// Journey Store
export {
  useJourneyStore,
  useJourneyProgress,
  useIsGuideOpen,
  useHasSeenWelcome,
} from './journey-store'

export {
  useEmployerHiringPathStore,
  type EmployerHiringPathPayload,
} from './employer-journey-snapshot-store'

// Hub Blocks Store (composable hub)
export {
  useHubBlocksStore,
  useInstalledBlocks,
  useIsPickerOpen,
  useNeedsOnboarding,
  useHubOnboarding,
  useAvailableBlocks,
} from './hub-blocks-store'

// Types
export type {
  InstalledBlock,
  HubOnboarding,
} from './hub-blocks-store'

export type {
  PageType,
  UserRole,
  DotForm1Data,
  DotForm2Data,
  DotForm3Data,
  DotApplicationData,
  BlockchainData,
  ResumeData,
  DotApplicationRecord,
  MvrRecord,
  JobApplication,
  DriverHubStats,
  ProfileConflict,
} from './types'
