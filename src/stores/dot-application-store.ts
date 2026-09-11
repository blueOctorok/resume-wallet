import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { 
  DotForm1Data, 
  DotForm2Data, 
  DotForm3Data, 
  DotApplicationData,
  BlockchainData,
  ProfileConflict,
} from './types'

/**
 * DOT Application Store - Manages the multi-step DOT application form
 * 
 * This store handles:
 * - Form data for all 3 DOT forms
 * - Current step/form navigation
 * - Submission state and blockchain data
 * - Dirty state tracking (unsaved changes)
 * - Profile conflict resolution
 * - Application completion status
 * 
 * The store persists form data to localStorage so users can resume
 * their application across sessions.
 */

interface DotApplicationState {
  // Form data
  form1Data: DotForm1Data | null
  form2Data: DotForm2Data | null
  form3Data: DotForm3Data | null
  
  // Navigation
  currentForm: number // 1, 2, or 3
  
  // Submission state
  isSubmitting: boolean
  submissionError: string | null
  isApplicationCompleted: boolean
  /** DB `is_complete` — submitted at least once. Independent of the success screen. */
  hasSubmittedApplication: boolean
  blockchainData: BlockchainData | null
  
  // Dirty state tracking
  hasUnsavedChanges: boolean
  lastSavedData: DotApplicationData | null
  
  // Profile prefill state
  profileDataLoaded: boolean
  profileSource: string | null
  hasPrefilled: boolean
  showPrefillUpload: boolean
  
  // Profile conflict resolution
  showProfileConflictModal: boolean
  profileConflict: ProfileConflict | null
  
  // Form reset key (increment to force re-render)
  formResetKey: number
  
  // Database sync
  applicationId: string | null
  lastSyncedAt: string | null
  /** Which session owns this persist blob. Mismatch → wipe (test data / other account). */
  ownerUserId: string | null
}

interface DotApplicationActions {
  // Form data actions
  setForm1Data: (data: DotForm1Data | null) => void
  setForm2Data: (data: DotForm2Data | null) => void
  setForm3Data: (data: DotForm3Data | null) => void
  updateForm1Field: <K extends keyof DotForm1Data>(field: K, value: DotForm1Data[K]) => void
  
  // Navigation actions
  setCurrentForm: (form: number) => void
  nextForm: () => void
  prevForm: () => void
  
  // Submission actions
  setIsSubmitting: (submitting: boolean) => void
  setSubmissionError: (error: string | null) => void
  setBlockchainData: (data: BlockchainData | null) => void
  completeApplication: (blockchainData?: BlockchainData) => void
  setIsApplicationCompleted: (completed: boolean) => void
  setHasSubmittedApplication: (submitted: boolean) => void
  
  // Dirty state actions
  markDirty: () => void
  markClean: () => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  updateLastSavedData: () => void
  
  // Profile prefill actions
  setProfileDataLoaded: (loaded: boolean) => void
  setProfileSource: (source: string | null) => void
  setHasPrefilled: (prefilled: boolean) => void
  setShowPrefillUpload: (show: boolean) => void
  
  // Profile conflict actions
  setShowProfileConflictModal: (show: boolean) => void
  setProfileConflict: (conflict: ProfileConflict | null) => void
  
  // Database sync actions
  setApplicationId: (id: string | null) => void
  setLastSyncedAt: (timestamp: string | null) => void
  
  // Compound actions
  resetApplication: () => void
  /** Drop leftover persist when the signed-in user is not the blob owner. */
  bindToUser: (userId: string | null) => void
  loadFromDatabase: (data: {
    applicationId: string
    form1?: DotForm1Data
    form2?: DotForm2Data
    form3?: DotForm3Data
    currentStep: number
    isComplete: boolean
  }) => void
  getApplicationData: () => DotApplicationData
  
  // Form reset
  incrementFormResetKey: () => void
}

const initialState: DotApplicationState = {
  form1Data: null,
  form2Data: null,
  form3Data: null,
  currentForm: 1,
  isSubmitting: false,
  submissionError: null,
  isApplicationCompleted: false,
  hasSubmittedApplication: false,
  blockchainData: null,
  hasUnsavedChanges: false,
  lastSavedData: null,
  profileDataLoaded: false,
  profileSource: null,
  hasPrefilled: false,
  showPrefillUpload: false,
  showProfileConflictModal: false,
  profileConflict: null,
  formResetKey: 0,
  applicationId: null,
  lastSyncedAt: null,
  ownerUserId: null,
}

export const useDotApplicationStore = create<DotApplicationState & DotApplicationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Form data actions
      setForm1Data: (data) =>
        set((state) => {
          // Avoid no-op identity churn that can ping-pong with Form1 sync (React #185)
          try {
            if (
              data != null &&
              state.form1Data != null &&
              JSON.stringify(data) === JSON.stringify(state.form1Data)
            ) {
              return state
            }
          } catch {
            /* fall through */
          }
          return { form1Data: data, hasUnsavedChanges: true }
        }),
      setForm2Data: (data) =>
        set((state) => {
          try {
            if (
              data != null &&
              state.form2Data != null &&
              JSON.stringify(data) === JSON.stringify(state.form2Data)
            ) {
              return state
            }
          } catch {
            /* fall through */
          }
          return { form2Data: data, hasUnsavedChanges: true }
        }),
      setForm3Data: (data) => set({ form3Data: data, hasUnsavedChanges: true }),
      
      updateForm1Field: (field, value) => set((state) => ({
        form1Data: { ...state.form1Data, [field]: value },
        hasUnsavedChanges: true,
      })),

      // Navigation actions
      setCurrentForm: (form) => set({ currentForm: Math.max(1, Math.min(3, form)) }),
      nextForm: () => set((state) => ({ 
        currentForm: Math.min(3, state.currentForm + 1) 
      })),
      prevForm: () => set((state) => ({ 
        currentForm: Math.max(1, state.currentForm - 1) 
      })),

      // Submission actions
      setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),
      setSubmissionError: (error) => set({ submissionError: error }),
      setBlockchainData: (data) => set({ blockchainData: data }),
      
      completeApplication: (blockchainData) => set({
        isApplicationCompleted: true,
        hasSubmittedApplication: true,
        blockchainData: blockchainData ?? null,
        hasUnsavedChanges: false,
        isSubmitting: false,
      }),
      
      // Success-screen toggle only — does not change hasSubmittedApplication
      setIsApplicationCompleted: (completed) => set({ isApplicationCompleted: completed }),
      setHasSubmittedApplication: (submitted) => set({ hasSubmittedApplication: submitted }),

      // Dirty state actions
      markDirty: () => set({ hasUnsavedChanges: true }),
      markClean: () => set({ hasUnsavedChanges: false }),
      setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
      
      updateLastSavedData: () => set((state) => ({
        lastSavedData: {
          form1: state.form1Data,
          form2: state.form2Data,
          form3: state.form3Data,
        },
        hasUnsavedChanges: false,
        lastSyncedAt: new Date().toISOString(),
      })),

      // Profile prefill actions
      setProfileDataLoaded: (loaded) => set({ profileDataLoaded: loaded }),
      setProfileSource: (source) => set({ profileSource: source }),
      setHasPrefilled: (prefilled) => set({ hasPrefilled: prefilled }),
      setShowPrefillUpload: (show) => set({ showPrefillUpload: show }),

      // Profile conflict actions
      setShowProfileConflictModal: (show) => set({ showProfileConflictModal: show }),
      setProfileConflict: (conflict) => set({ profileConflict: conflict }),

      // Database sync actions
      setApplicationId: (id) => set({ applicationId: id }),
      setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),

      // Compound actions
      resetApplication: () => set({
        ...initialState,
        ownerUserId: get().ownerUserId,
        formResetKey: get().formResetKey + 1,
      }),

      bindToUser: (userId) => {
        const state = get()
        if (!userId) return
        if (state.ownerUserId === userId) return
        set({
          ...initialState,
          ownerUserId: userId,
          formResetKey: state.formResetKey + 1,
        })
      },

      loadFromDatabase: (data) => set({
        applicationId: data.applicationId,
        form1Data: data.form1 ?? null,
        form2Data: data.form2 ?? null,
        form3Data: data.form3 ?? null,
        currentForm: data.currentStep >= 1 && data.currentStep <= 3 ? data.currentStep : 3,
        // Reopen the wizard so a submitted app can be edited. Success screen
        // is only shown right after submit (completeApplication), not on load.
        isApplicationCompleted: false,
        hasSubmittedApplication: data.isComplete,
        hasUnsavedChanges: false,
        lastSavedData: {
          form1: data.form1 ?? null,
          form2: data.form2 ?? null,
          form3: data.form3 ?? null,
        },
      }),

      getApplicationData: () => ({
        form1: get().form1Data,
        form2: get().form2Data,
        form3: get().form3Data,
      }),

      incrementFormResetKey: () => set((state) => ({ 
        formResetKey: state.formResetKey + 1 
      })),
    }),
    {
      name: 'dot-application',
      storage: createJSONStorage(() => localStorage),
      // Persist form data and progress, not UI state
      partialize: (state) => ({
        form1Data: state.form1Data,
        form2Data: state.form2Data,
        form3Data: state.form3Data,
        currentForm: state.currentForm,
        hasSubmittedApplication: state.hasSubmittedApplication,
        applicationId: state.applicationId,
        ownerUserId: state.ownerUserId,
        hasPrefilled: state.hasPrefilled,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)

// Selector hooks for common patterns
export const useCurrentForm = () => useDotApplicationStore((state) => state.currentForm)
export const useFormData = () => useDotApplicationStore((state) => ({
  form1: state.form1Data,
  form2: state.form2Data,
  form3: state.form3Data,
}))
export const useHasUnsavedChanges = () => useDotApplicationStore((state) => state.hasUnsavedChanges)
export const useIsSubmitting = () => useDotApplicationStore((state) => state.isSubmitting)
