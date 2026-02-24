import { create } from 'zustand'
import type { PageType } from './types'

/**
 * UI Store - Manages UI state and navigation
 * 
 * This store handles:
 * - Current page/view navigation
 * - Modal states
 * - Loading indicators
 * - Tab states
 * - Component-specific UI state
 * 
 * This state is NOT persisted - it resets on page refresh.
 */

interface UIState {
  // Navigation
  currentPage: PageType
  showDashboard: boolean
  
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
}

interface UIActions {
  // Navigation actions
  setCurrentPage: (page: PageType) => void
  setShowDashboard: (show: boolean) => void
  navigateToHub: () => void
  navigateToDotApp: () => void
  navigateToResume: () => void
  navigateToJobs: () => void
  navigateToMvr: () => void
  
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
  
  // Reset
  resetUI: () => void
}

const initialState: UIState = {
  currentPage: null,
  showDashboard: false,
  isModalOpen: false,
  modalType: null,
  resumeTab: 'upload',
  editingResumeId: undefined,
  showEmploymentVerification: false,
  isGlobalLoading: false,
  globalLoadingMessage: null,
  isMounted: false,
}

export const useUIStore = create<UIState & UIActions>()(
  (set) => ({
    ...initialState,

    // Navigation actions
    setCurrentPage: (page) => set({ currentPage: page }),
    setShowDashboard: (show) => set({ showDashboard: show }),
    
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

    // Reset
    resetUI: () => set(initialState),
  })
)

// Selector hooks for common patterns
export const useCurrentPage = () => useUIStore((state) => state.currentPage)
export const useIsModalOpen = () => useUIStore((state) => state.isModalOpen)
export const useIsMounted = () => useUIStore((state) => state.isMounted)
