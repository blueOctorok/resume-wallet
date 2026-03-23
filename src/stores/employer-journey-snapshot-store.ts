import { create } from 'zustand'
import type { EmployerProgressData } from '@/lib/journey-progress'

/**
 * `EmployerHub` pushes hiring context here so:
 * - `useJourneyProgress()` (employer) matches the loaded hub
 * - `EmployerPathSidebar` / `AvaJourneyGuide` drawer can show the same numbers without prop drilling
 */
export interface EmployerHiringPathPayload {
  snapshot: EmployerProgressData
  companyName: string | null
  activeJobs: number
  totalApplicants: number
  pendingReview: number
}

interface EmployerHiringPathState {
  hiring: EmployerHiringPathPayload | null
  setEmployerHiringPath: (payload: EmployerHiringPathPayload | null) => void
}

export const useEmployerHiringPathStore = create<EmployerHiringPathState>((set) => ({
  hiring: null,
  setEmployerHiringPath: (hiring) => set({ hiring }),
}))
