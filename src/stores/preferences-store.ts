import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Preferences Store - User-configurable settings
 * 
 * Persisted to localStorage. Can be synced to database in the future
 * for cross-device consistency.
 */

interface PreferencesState {
  // Journey modals - guided "what's next" prompts after key actions
  showJourneyModals: boolean
  
  // Track which "show once" steps have been shown (by step ID)
  completedJourneySteps: string[]

  /** Candidate hub — large panels (persisted so scroll preferences stick) */
  hubYourBlocksExpanded: boolean
}

interface PreferencesActions {
  setShowJourneyModals: (show: boolean) => void
  markJourneyStepComplete: (stepId: string) => void
  hasCompletedJourneyStep: (stepId: string) => boolean
  /** Remove one step id so that walkthrough / modal can show again (e.g. My Hub → Stormi Journey Guide). */
  clearJourneyStepCompletion: (stepId: string) => void
  resetCompletedJourneySteps: () => void
  setHubYourBlocksExpanded: (expanded: boolean) => void
}

const initialState: PreferencesState = {
  showJourneyModals: true, // Enabled by default - help new users
  completedJourneySteps: [],
  hubYourBlocksExpanded: true,
}

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setShowJourneyModals: (show) => set({ showJourneyModals: show }),

      markJourneyStepComplete: (stepId) =>
        set((state) => {
          if (state.completedJourneySteps.includes(stepId)) return state
          return {
            completedJourneySteps: [...state.completedJourneySteps, stepId],
          }
        }),

      hasCompletedJourneyStep: (stepId) => {
        return get().completedJourneySteps.includes(stepId)
      },

      clearJourneyStepCompletion: (stepId) =>
        set((state) => ({
          completedJourneySteps: state.completedJourneySteps.filter((id) => id !== stepId),
        })),

      resetCompletedJourneySteps: () => set({ completedJourneySteps: [] }),

      setHubYourBlocksExpanded: (expanded) => set({ hubYourBlocksExpanded: expanded }),
    }),
    {
      name: 'stormchain-preferences',
      partialize: (state) => ({
        showJourneyModals: state.showJourneyModals,
        completedJourneySteps: state.completedJourneySteps,
        hubYourBlocksExpanded: state.hubYourBlocksExpanded,
      }),
    }
  )
)

// Selector hooks
export const useShowJourneyModals = () => usePreferencesStore((state) => state.showJourneyModals)
