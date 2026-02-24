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
} from './ui-store'

// Types
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
