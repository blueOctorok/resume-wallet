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
}

interface PreferencesActions {
  setShowJourneyModals: (show: boolean) => void
  markJourneyStepComplete: (stepId: string) => void
  hasCompletedJourneyStep: (stepId: string) => boolean
  resetCompletedJourneySteps: () => void
}

const initialState: PreferencesState = {
  showJourneyModals: true, // Enabled by default - help new users
  completedJourneySteps: [],
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

      resetCompletedJourneySteps: () => set({ completedJourneySteps: [] }),
    }),
    {
      name: 'stormchain-preferences',
      partialize: (state) => ({
        showJourneyModals: state.showJourneyModals,
        completedJourneySteps: state.completedJourneySteps,
      }),
    }
  )
)

// Selector hooks
export const useShowJourneyModals = () => usePreferencesStore((state) => state.showJourneyModals)
