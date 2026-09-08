import { create } from 'zustand'
import type {
  CandidateEmploymentRow,
  EvApplicantIdentity,
} from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'

const EMPTY_APPLICANT: EvApplicantIdentity = {
  driverName: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  ssnLastFour: '',
  email: '',
  phone: '',
  mailingAddress: '',
  cdlNumber: '',
  cdlState: '',
  licenseNumber: '',
  licenseState: '',
}

interface EmploymentVerificationBlockState {
  applicant: EvApplicantIdentity
  employments: CandidateEmploymentRow[]
  requests: VerificationRequest[]
  isLoading: boolean
  error: string | null
  fetch: () => Promise<void>
}

export const useEmploymentVerificationBlockStore = create<EmploymentVerificationBlockState>(
  (set, get) => ({
    applicant: EMPTY_APPLICANT,
    employments: [],
    requests: [],
    isLoading: false,
    error: null,

    fetch: async () => {
      if (get().isLoading) return
      set({ isLoading: true, error: null })
      try {
        const res = await fetch('/api/candidate/verification/status?initiatedBy=applicant')
        const json = (await res.json()) as {
          applicant?: EvApplicantIdentity
          employments?: CandidateEmploymentRow[]
          requests?: VerificationRequest[]
          error?: string
        }
        if (!res.ok) throw new Error(json.error || 'Failed to load employment verification')
        set({
          applicant: json.applicant ?? EMPTY_APPLICANT,
          employments: json.employments ?? [],
          requests: json.requests ?? [],
          isLoading: false,
        })
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to load employment verification',
          isLoading: false,
        })
      }
    },
  }),
)
