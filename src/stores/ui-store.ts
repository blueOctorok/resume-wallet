import { create } from 'zustand'
import type { PageType } from './types'
import type { DriverJourneyState, JourneyStatus, ResumeUploadEvent } from '@/types/assistant'

/**
 * UI Store - Manages UI state and navigation
 * 
 * This store handles:
 * - Current page/view navigation
 * - Modal states
 * - Loading indicators
 * - Tab states
 * - Component-specific UI state
 * - Driver journey state (for AvA Journey Guide progress tracking)
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

interface UIState {
  // Navigation
  currentPage: PageType
  showDashboard: boolean
  
  // Driver journey state (session-only, used by AvA Journey Guide)
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
}

interface UIActions {
  // Navigation actions
  setCurrentPage: (page: PageType) => void
  setShowDashboard: (show: boolean) => void
  
  // Driver journey actions
  updateJourneyStep: (step: JourneyStageKey, status: JourneyStatus) => void
  setDriverJourneyState: (state: DriverJourneyState) => void
  resetDriverJourneyState: () => void
  navigateToHub: () => void
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
  showEmploymentVerification: false,
  isGlobalLoading: false,
  globalLoadingMessage: null,
  isMounted: false,
  latestResumeIpfsHash: null,
  resumeUploadEvent: null,
}

export const useUIStore = create<UIState & UIActions>()(
  (set) => ({
    ...initialState,

    // Navigation actions
    setCurrentPage: (page) => set({ currentPage: page }),
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
    
    navigateToHub: () => set({ 
      currentPage: 'hub', 
      showDashboard: false,
    }),
    
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
      // Auto-clear event after brief delay (for event-driven consumers)
      setTimeout(() => set({ resumeUploadEvent: null }), 100)
    },

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
