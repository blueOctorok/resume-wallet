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

export interface EvShareRequestItem {
  id: string
  companyId: string
  companyName: string
  applicationContext: string
  payloadType: 'proof' | 'full'
  status: 'pending' | 'authorized' | 'declined' | 'revoked' | 'expired'
  certifiedAt: string
  createdAt: string
  /** Active (non-revoked) Step 6 grant id — needed for revocation. */
  grantId: string | null
}

interface EmploymentVerificationBlockState {
  applicant: EvApplicantIdentity
  employments: CandidateEmploymentRow[]
  requests: VerificationRequest[]
  /** Employer Step 6 share requests targeting this driver. */
  shareRequests: EvShareRequestItem[]
  isLoading: boolean
  error: string | null
  fetch: () => Promise<void>
  fetchShareRequests: () => Promise<void>
}

export const useEmploymentVerificationBlockStore = create<EmploymentVerificationBlockState>(
  (set, get) => ({
    applicant: EMPTY_APPLICANT,
    employments: [],
    requests: [],
    shareRequests: [],
    isLoading: false,
    error: null,

    fetchShareRequests: async () => {
      try {
        const res = await fetch('/api/candidate/verification/share-requests')
        if (!res.ok) return
        const json = (await res.json()) as { shareRequests?: EvShareRequestItem[] }
        set({ shareRequests: json.shareRequests ?? [] })
      } catch {
        // Non-fatal: the Step 6 panel just shows nothing until the next fetch.
      }
    },

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
