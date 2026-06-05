import { create } from 'zustand'
import type { PageType } from './types'
import type { DriverJourneyState, JourneyStatus, ResumeUploadEvent } from '@/types/assistant'
import { useAuthStore } from './auth-store'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'

/**
 * UI Store - Manages UI state and navigation
 * 
 * This store handles:
 * - Current page/view navigation
 * - Modal states
 * - Loading indicators
 * - Tab states
 * - Component-specific UI state
 * - Driver journey state (for Stormi Journey Guide progress tracking)
 * 
 * This state is NOT persisted - it resets on page refresh.
 */

const createInitialJourneyState = (): DriverJourneyState => {
  const ts = new Date().toISOString()
  return {
    wallet: { status: 'pending', updatedAt: ts },
    resume: { status: 'pending', updatedAt: ts },
    forms: { status: 'pending', updatedAt: ts },
    submission: { status: 'pending', updatedAt: ts },
    currentFormStep: null,
    lastCompletedForm: null,
  }
}

type JourneyStageKey = 'wallet' | 'resume' | 'forms' | 'submission'

/** Initial tab when opening STORM Resume from My Files or notifications */
export type StormResumePanel = 'upload' | 'general' | 'driver' | 'developer'

/** Shown next to Employer Hub in `Navigation` — populated by `EmployerHub` when hub data loads */
export type EmployerNavSnapshot = {
  companyName: string
  userRole: string | null
  verified: boolean
  /** Location · DOT (optional) */
  subtitle: string | null
  memberSinceLabel: string | null
}

interface UIState {
  // Navigation
  currentPage: PageType
  showDashboard: boolean
  
  // Driver journey state (session-only, used by Stormi Journey Guide)
  driverJourneyState: DriverJourneyState
  
  // Journey modal state - guided "what's next" prompts
  activeJourneyStep: string | null
  showJourneyModal: boolean
  
  // Modals
  isModalOpen: boolean
  modalType: string | null
  
  // Resume section
  resumeTab: 'upload' | 'create'
  editingResumeId: string | undefined
  stormResumeInitialPanel: StormResumePanel | null

  // Employment verification
  showEmploymentVerification: boolean
  
  // Global loading
  isGlobalLoading: boolean
  globalLoadingMessage: string | null
  
  // Mount state (for hydration)
  isMounted: boolean
  
  // Resume upload events (for cross-component communication)
  latestResumeIpfsHash: string | null
  resumeUploadEvent: ResumeUploadEvent | null

  // Messaging — thread to open when navigating to the messages page
  initialThreadId: string | null

  /** Incremented by nav "Refresh hub" — CandidateHub reacts to refetch blocks + My Files */
  hubRefreshNonce: number

  /** True while the employer hub is running a manual refresh cycle */
  employerHubRefreshing: boolean

  /**
   * Employer hub: company + role shown in global nav (EmployerHub writes; cleared when no company).
   * Persists while on employer sub-pages (Applicants, etc.) so the bar stays informative.
   */
  employerNavSnapshot: EmployerNavSnapshot | null
}

interface UIActions {
  // Navigation actions
  setCurrentPage: (page: PageType) => void
  /** Prefer over setCurrentPage(null) when leaving a block view — pairs with history sync for candidates */
  navigateToHub: () => void
  setShowDashboard: (show: boolean) => void
  
  // Driver journey actions
  updateJourneyStep: (step: JourneyStageKey, status: JourneyStatus) => void
  setDriverJourneyState: (state: DriverJourneyState) => void
  resetDriverJourneyState: () => void
  navigateToDotApp: () => void
  navigateToResume: () => void
  navigateToJobs: () => void
  navigateToMvr: () => void
  
  // Journey modal actions - guided "what's next" prompts
  triggerJourneyStep: (stepId: string) => void
  dismissJourneyModal: () => void
  
  // Modal actions
  openModal: (type?: string) => void
  closeModal: () => void
  setIsModalOpen: (open: boolean) => void
  
  // Resume section actions
  setResumeTab: (tab: 'upload' | 'create') => void
  setEditingResumeId: (id: string | undefined) => void
  setStormResumeInitialPanel: (panel: StormResumePanel | null) => void

  // Employment verification
  setShowEmploymentVerification: (show: boolean) => void
  
  // Global loading
  setGlobalLoading: (loading: boolean, message?: string) => void
  
  // Mount state
  setIsMounted: (mounted: boolean) => void
  
  // Resume upload events
  setLatestResumeIpfsHash: (hash: string | null) => void
  setResumeUploadEvent: (event: ResumeUploadEvent | null) => void
  handleResumeUploadEvent: (event: ResumeUploadEvent) => void

  // Messaging
  navigateToMessages: (threadId?: string | null) => void

  /** Nav refresh control — bumps nonce so CandidateHub runs the same refresh as the old title-card button */
  requestHubRefresh: () => void
  setEmployerHubRefreshing: (v: boolean) => void

  setEmployerNavSnapshot: (snapshot: EmployerNavSnapshot | null) => void

  // Reset
  resetUI: () => void
}

const initialState: UIState = {
  currentPage: null,
  showDashboard: false,
  driverJourneyState: createInitialJourneyState(),
  activeJourneyStep: null,
  showJourneyModal: false,
  isModalOpen: false,
  modalType: null,
  resumeTab: 'upload',
  editingResumeId: undefined,
  stormResumeInitialPanel: null,
  showEmploymentVerification: false,
  isGlobalLoading: false,
  globalLoadingMessage: null,
  isMounted: false,
  latestResumeIpfsHash: null,
  resumeUploadEvent: null,
  initialThreadId: null,
  hubRefreshNonce: 0,
  employerHubRefreshing: false,
  employerNavSnapshot: null,
}

export const useUIStore = create<UIState & UIActions>()(
  (set) => ({
    ...initialState,

    // Navigation actions
    setCurrentPage: (page) => set({ currentPage: page }),
    navigateToHub: () => {
      if (typeof window !== 'undefined') {
        const sc = (window.history.state as { sc?: { page: PageType } } | null)?.sc
        if (sc?.page != null) {
          window.history.back()
          return
        }
      }
      set({ currentPage: null, showDashboard: false, stormResumeInitialPanel: null })
    },
    setShowDashboard: (show) => set({ showDashboard: show }),
    
    // Driver journey actions
    updateJourneyStep: (step, status) =>
      set((state) => {
        if (state.driverJourneyState[step].status === status) return state
        return {
          driverJourneyState: {
            ...state.driverJourneyState,
            [step]: { status, updatedAt: new Date().toISOString() },
          },
        }
      }),
    setDriverJourneyState: (journeyState) => set({ driverJourneyState: journeyState }),
    resetDriverJourneyState: () => set({ driverJourneyState: createInitialJourneyState() }),

    navigateToDotApp: () => set({ 
      currentPage: 'dotapp',
      showDashboard: false,
    }),
    
    navigateToResume: () => set({ 
      currentPage: 'resume',
      showDashboard: false,
    }),
    
    navigateToJobs: () => set({ 
      currentPage: 'jobs',
      showDashboard: false,
    }),
    
    navigateToMvr: () => set({ 
      currentPage: 'mvr',
      showDashboard: false,
    }),
    
    // Journey modal actions - show guided "what's next" prompts
    triggerJourneyStep: (stepId) => set({
      activeJourneyStep: stepId,
      showJourneyModal: true,
    }),
    
    dismissJourneyModal: () => set({
      activeJourneyStep: null,
      showJourneyModal: false,
    }),

    // Modal actions
    openModal: (type) => set({ 
      isModalOpen: true, 
      modalType: type ?? null,
    }),
    
    closeModal: () => set({ 
      isModalOpen: false, 
      modalType: null,
    }),
    
    setIsModalOpen: (open) => set({ 
      isModalOpen: open,
      modalType: open ? null : null, // Clear type when closing
    }),

    // Resume section actions
    setResumeTab: (tab) => set({ resumeTab: tab }),
    setEditingResumeId: (id) => set({ editingResumeId: id }),
    setStormResumeInitialPanel: (panel) => set({ stormResumeInitialPanel: panel }),

    // Employment verification
    setShowEmploymentVerification: (show) => set({ showEmploymentVerification: show }),

    // Global loading
    setGlobalLoading: (loading, message) => set({ 
      isGlobalLoading: loading,
      globalLoadingMessage: message ?? null,
    }),

    // Mount state
    setIsMounted: (mounted) => set({ isMounted: mounted }),

    // Resume upload events
    setLatestResumeIpfsHash: (hash) => set({ latestResumeIpfsHash: hash }),
    setResumeUploadEvent: (event) => set({ resumeUploadEvent: event }),
    handleResumeUploadEvent: (event) => {
      set({ resumeUploadEvent: event })
      if (event.type === 'analysis_ready' && event.data?.ipfsHash) {
        set({ latestResumeIpfsHash: event.data.ipfsHash })
      }
      // Stormi journey reads driver-hub-store — refresh after upload pipeline milestones
      if (event.type === 'upload_complete' || event.type === 'blockchain_complete') {
        const wa = useAuthStore.getState().sessionUserId
        if (wa) void syncDriverHubFromApi(wa)
      }
      // Auto-clear event after brief delay (for event-driven consumers)
      setTimeout(() => set({ resumeUploadEvent: null }), 100)
    },

    // Messaging
    navigateToMessages: (threadId) => set({
      currentPage: 'messages',
      initialThreadId: threadId ?? null,
    }),

    requestHubRefresh: () =>
      set((s) => ({ hubRefreshNonce: s.hubRefreshNonce + 1 })),

    setEmployerHubRefreshing: (v) => set({ employerHubRefreshing: v }),

    setEmployerNavSnapshot: (snapshot) => set({ employerNavSnapshot: snapshot }),

    // Reset
    resetUI: () => set(initialState),
  })
)

// Selector hooks for common patterns
export const useCurrentPage = () => useUIStore((state) => state.currentPage)
export const useIsModalOpen = () => useUIStore((state) => state.isModalOpen)
export const useIsMounted = () => useUIStore((state) => state.isMounted)
export const useDriverJourneyState = () => useUIStore((state) => state.driverJourneyState)
export const useActiveJourneyStep = () => useUIStore((state) => state.activeJourneyStep)
export const useShowJourneyModal = () => useUIStore((state) => state.showJourneyModal)

// Re-export for use in components
export { type DriverJourneyState, type JourneyStatus }
export { createInitialJourneyState }
