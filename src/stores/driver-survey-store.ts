import { create } from 'zustand'
import {
  EMPTY_DRIVER_SURVEY,
  type DriverSurveyAnswers,
} from '@/lib/driver-survey'

interface DriverSurveyState {
  /** Last saved answers. Empty until the driver submits. */
  answers: DriverSurveyAnswers
  /** In-progress edits. Copied from `answers` when the form opens. */
  draft: DriverSurveyAnswers
  submittedAt: string | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  isOpen: boolean
  load: () => Promise<void>
  open: () => void
  close: () => void
  setDraft: (draft: DriverSurveyAnswers) => void
  save: () => Promise<boolean>
}

export const useDriverSurveyStore = create<DriverSurveyState>((set) => ({
  answers: EMPTY_DRIVER_SURVEY,
  draft: EMPTY_DRIVER_SURVEY,
  submittedAt: null,
  isLoading: false,
  isSaving: false,
  error: null,
  isOpen: false,

  load: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/driver/survey')
      const body = (await response.json()) as {
        error?: string
        survey?: { answers: DriverSurveyAnswers; submittedAt: string } | null
      }
      if (!response.ok) throw new Error(body.error || 'Could not load the survey')
      set({
        answers: body.survey?.answers ?? EMPTY_DRIVER_SURVEY,
        submittedAt: body.survey?.submittedAt ?? null,
        isLoading: false,
      })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Could not load the survey',
      })
    }
  },

  open: () => set((state) => ({ isOpen: true, error: null, draft: state.answers })),
  close: () => set({ isOpen: false }),
  setDraft: (draft) => set({ draft }),

  save: async () => {
    const answers = useDriverSurveyStore.getState().draft
    set({ isSaving: true, error: null })
    try {
      const response = await fetch('/api/driver/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const body = (await response.json()) as {
        error?: string
        survey?: { answers: DriverSurveyAnswers; submittedAt: string }
      }
      if (!response.ok || !body.survey) {
        throw new Error(body.error || 'Could not save the survey')
      }
      set({
        answers: body.survey.answers,
        submittedAt: body.survey.submittedAt,
        isSaving: false,
        isOpen: false,
      })
      return true
    } catch (err) {
      set({
        isSaving: false,
        error: err instanceof Error ? err.message : 'Could not save the survey',
      })
      return false
    }
  },
}))
