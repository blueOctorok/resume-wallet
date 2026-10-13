import { create } from 'zustand'
import type {
  CandidateEmploymentRow,
  EvApplicantIdentity,
} from '@/lib/candidate-employment-verification'
import type { VerificationAttempt, VerificationRequest } from '@/types/employment-verification'

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

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

interface EmploymentVerificationBlockState {
  applicant: EvApplicantIdentity
  employments: CandidateEmploymentRow[]
  requests: VerificationRequest[]
  /** Outreach attempt timeline keyed by request id. */
  attemptsByRequest: Record<string, VerificationAttempt[]>
  /** Employer Step 6 share requests targeting this driver. */
  shareRequests: EvShareRequestItem[]
  isLoading: boolean
  /** Request id of the packet with an outreach action (resend / research / set-contact) in flight. */
  actingOnRequestId: string | null
  error: string | null
  fetch: () => Promise<void>
  fetchShareRequests: () => Promise<void>
  resend: (requestId: string) => Promise<ActionResult>
  researchContact: (requestId: string) => Promise<ActionResult>
  setContact: (requestId: string, contact: { email?: string; phone?: string }) => Promise<ActionResult>
}

export const useEmploymentVerificationBlockStore = create<EmploymentVerificationBlockState>(
  (set, get) => {
    // All three outreach actions are "POST, then refetch" — one helper keeps them identical.
    const postAndRefresh = async (requestId: string, url: string, body?: unknown): Promise<ActionResult> => {
      set({ actingOnRequestId: requestId })
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        })
        const json = (await res.json()) as { error?: string; message?: string }
        if (!res.ok) return { ok: false, error: json.error ?? 'Request failed' }
        await get().fetch()
        return { ok: true, message: json.message }
      } catch {
        return { ok: false, error: 'Request failed' }
      } finally {
        set({ actingOnRequestId: null })
      }
    }

    return {
      applicant: EMPTY_APPLICANT,
      employments: [],
      requests: [],
      attemptsByRequest: {},
      shareRequests: [],
      isLoading: false,
      actingOnRequestId: null,
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
            attemptsByRequest?: Record<string, VerificationAttempt[]>
            error?: string
          }
          if (!res.ok) throw new Error(json.error || 'Failed to load employment verification')
          set({
            applicant: json.applicant ?? EMPTY_APPLICANT,
            employments: json.employments ?? [],
            requests: json.requests ?? [],
            attemptsByRequest: json.attemptsByRequest ?? {},
            isLoading: false,
          })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to load employment verification',
            isLoading: false,
          })
        }
      },

      resend: (requestId) =>
        postAndRefresh(requestId, '/api/candidate/verification/resend', { requestId }),
      researchContact: (requestId) =>
        postAndRefresh(requestId, `/api/candidate/verification/${requestId}/research-contact`),
      setContact: (requestId, contact) =>
        postAndRefresh(requestId, `/api/candidate/verification/${requestId}/set-contact`, contact),
    }
  },
)
