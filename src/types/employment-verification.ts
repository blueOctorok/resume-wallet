/**
 * Employment Verification Types
 * 
 * This system allows future employers to verify a driver's employment history
 * with their previous employers. The process involves:
 * 
 * 1. Driver submits employment history (self-reported)
 * 2. Future employer initiates verification
 * 3. System contacts previous employer (up to 3 attempts)
 * 4. Previous employer answers 6 FMCSA questions
 * 5. Results stored and displayed to future employer
 */

// ===== VERIFICATION STATUS =====

export type VerificationStatus =
  | 'SELF_REPORTED'           // Driver's claim, not verified
  | 'VERIFICATION_REQUESTED'  // Future employer initiated, pending first attempt
  | 'VERIFICATION_IN_PROGRESS' // Attempts being made (1-3)
  | 'VERIFIED'                // Previous employer confirmed all details
  | 'PARTIALLY_VERIFIED'      // Some details confirmed, others disputed
  | 'VERIFICATION_DENIED'     // Previous employer says details are false
  | 'ATTEMPTS_EXHAUSTED'      // 3 attempts made, no response
  | 'VERIFICATION_DECLINED'   // Previous employer declined to verify

// ===== FMCSA VERIFICATION QUESTIONS =====

export type YesNoPartial = 'yes' | 'no' | 'partial'
export type YesNo = 'yes' | 'no'
export type YesNoDiscuss = 'yes' | 'no' | 'discuss'
export type YesNoNA = 'yes' | 'no' | 'na'

export interface VerificationAnswers {
  // Q1: Were the employment dates correct?
  datesCorrect: YesNoPartial | null
  correctedStartDate?: string
  correctedEndDate?: string
  
  // Q2: Were they terminated?
  wasTerminated: YesNo | null
  terminationReason?: string
  
  // Q3: Are they eligible to return?
  eligibleToReturn: YesNoDiscuss | null
  returnNotes?: string
  
  // Q4: Were they ever in an accident?
  hadAccident: YesNo | null
  accidentDetails?: string
  
  // Q5: Did they fail FMCSA Clearinghouse post-accident test?
  failedClearinghouseTest: YesNoNA | null
  clearinghouseNotes?: string
  
  // Q6: Were they part of random drug test pull or refused a drug test?
  randomDrugTestOrRefused: YesNoNA | null
  drugTestDetails?: string
  
  // Additional notes from previous employer
  additionalNotes?: string
}

// ===== INITIATOR TYPE =====

export type InitiatedBy = 'applicant' | 'employer'
export type ApplicantType = 'driver' | 'developer' | 'general'

// ===== VERIFICATION REQUEST =====

export interface VerificationRequest {
  id: string
  driverId: string // Also used for developers (legacy name)
  employmentId: string // ID from employment_history array
  
  // Who initiated and what type of applicant
  initiatedBy: InitiatedBy
  applicantType: ApplicantType
  
  // Requesting company (future employer) - null for self-initiated
  requestingCompanyId: string | null
  requestingCompanyName?: string // Populated from join, or "Self-Initiated"
  
  // Previous employer info
  previousEmployerName: string
  previousEmployerEmail: string | null
  previousEmployerPhone: string | null
  previousEmployerAddress: string | null
  
  // Driver's claimed employment details (snapshot)
  claimedPosition: string
  claimedStartDate: string
  claimedEndDate: string | null
  claimedReasonForLeaving: string | null
  
  // Status
  status: VerificationStatus
  
  // Attempt tracking
  attemptCount: number
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  
  // Verification results
  verifiedAt: string | null
  verifiedByEmail: string | null
  verifiedByName: string | null
  verifiedByTitle: string | null
  verificationMethod: 'email' | 'phone' | 'portal' | 'fax' | 'mail' | null
  
  // The 6 FMCSA answers
  answers: VerificationAnswers | null
  
  // Token for previous employer (not exposed to frontend except in portal)
  verificationToken?: string
  tokenExpiresAt?: string
  
  // Blockchain
  blockchainHash: string | null
  blockchainTxHash: string | null
  
  // Timestamps
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

// ===== VERIFICATION ATTEMPT =====

export interface VerificationAttempt {
  id: string
  verificationRequestId: string
  attemptNumber: number // 1, 2, or 3
  method: 'email' | 'phone' | 'portal' | 'fax' | 'mail'
  
  // Contact details used
  contactEmail: string | null
  contactPhone: string | null
  contactPerson: string | null
  
  // Timing
  sentAt: string
  
  // Response tracking
  responseReceived: boolean
  respondedAt: string | null
  responseNotes: string | null
  
  // Automated tracking
  emailOpenedAt: string | null
  linkClickedAt: string | null
  
  createdAt: string
}

// ===== DATABASE ROW TYPES =====

export interface VerificationRequestRow {
  id: string
  driver_id: string
  employment_id: string
  initiated_by: InitiatedBy
  applicant_type: ApplicantType
  requesting_company_id: string | null
  previous_employer_name: string
  previous_employer_email: string | null
  previous_employer_phone: string | null
  previous_employer_address: string | null
  claimed_position: string
  claimed_start_date: string
  claimed_end_date: string | null
  claimed_reason_for_leaving: string | null
  status: VerificationStatus
  attempt_count: number
  last_attempt_at: string | null
  next_attempt_at: string | null
  verified_at: string | null
  verified_by_email: string | null
  verified_by_name: string | null
  verified_by_title: string | null
  dates_correct: YesNoPartial | null
  corrected_start_date: string | null
  corrected_end_date: string | null
  was_terminated: YesNo | null
  termination_reason: string | null
  eligible_to_return: YesNoDiscuss | null
  return_notes: string | null
  had_accident: YesNo | null
  accident_details: string | null
  failed_clearinghouse_test: YesNoNA | null
  clearinghouse_notes: string | null
  random_drug_test_or_refused: YesNoNA | null
  drug_test_details: string | null
  additional_notes: string | null
  verification_method: string | null
  verification_token: string
  token_expires_at: string
  blockchain_hash: string | null
  blockchain_tx_hash: string | null
  created_at: string
  updated_at: string
  finalized_at: string | null
}

export interface VerificationAttemptRow {
  id: string
  verification_request_id: string
  attempt_number: number
  method: string
  contact_email: string | null
  contact_phone: string | null
  contact_person: string | null
  sent_at: string
  response_received: boolean
  responded_at: string | null
  response_notes: string | null
  email_opened_at: string | null
  link_clicked_at: string | null
  created_at: string
}

// ===== CONVERSION HELPERS =====

export function rowToVerificationRequest(
  row: VerificationRequestRow,
  companyName?: string
): VerificationRequest {
  return {
    id: row.id,
    driverId: row.driver_id,
    employmentId: row.employment_id,
    initiatedBy: row.initiated_by || 'employer',
    applicantType: row.applicant_type || 'driver',
    requestingCompanyId: row.requesting_company_id,
    requestingCompanyName: companyName || (row.initiated_by === 'applicant' ? 'Self-Initiated' : undefined),
    previousEmployerName: row.previous_employer_name,
    previousEmployerEmail: row.previous_employer_email,
    previousEmployerPhone: row.previous_employer_phone,
    previousEmployerAddress: row.previous_employer_address,
    claimedPosition: row.claimed_position,
    claimedStartDate: row.claimed_start_date,
    claimedEndDate: row.claimed_end_date,
    claimedReasonForLeaving: row.claimed_reason_for_leaving,
    status: row.status,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    nextAttemptAt: row.next_attempt_at,
    verifiedAt: row.verified_at,
    verifiedByEmail: row.verified_by_email,
    verifiedByName: row.verified_by_name,
    verifiedByTitle: row.verified_by_title,
    verificationMethod: row.verification_method as VerificationRequest['verificationMethod'],
    answers: row.dates_correct ? {
      datesCorrect: row.dates_correct,
      correctedStartDate: row.corrected_start_date || undefined,
      correctedEndDate: row.corrected_end_date || undefined,
      wasTerminated: row.was_terminated,
      terminationReason: row.termination_reason || undefined,
      eligibleToReturn: row.eligible_to_return,
      returnNotes: row.return_notes || undefined,
      hadAccident: row.had_accident,
      accidentDetails: row.accident_details || undefined,
      failedClearinghouseTest: row.failed_clearinghouse_test,
      clearinghouseNotes: row.clearinghouse_notes || undefined,
      randomDrugTestOrRefused: row.random_drug_test_or_refused,
      drugTestDetails: row.drug_test_details || undefined,
      additionalNotes: row.additional_notes || undefined,
    } : null,
    blockchainHash: row.blockchain_hash,
    blockchainTxHash: row.blockchain_tx_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
  }
}

export function rowToVerificationAttempt(row: VerificationAttemptRow): VerificationAttempt {
  return {
    id: row.id,
    verificationRequestId: row.verification_request_id,
    attemptNumber: row.attempt_number,
    method: row.method as VerificationAttempt['method'],
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactPerson: row.contact_person,
    sentAt: row.sent_at,
    responseReceived: row.response_received,
    respondedAt: row.responded_at,
    responseNotes: row.response_notes,
    emailOpenedAt: row.email_opened_at,
    linkClickedAt: row.link_clicked_at,
    createdAt: row.created_at,
  }
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface InitiateVerificationRequest {
  driverId: string
  employmentId: string
  previousEmployerEmail?: string
  previousEmployerPhone?: string
}

export interface SubmitVerificationResponseRequest {
  token: string
  verifierEmail: string
  verifierName: string
  verifierTitle: string
  action: 'verify' | 'deny' | 'decline'
  answers: VerificationAnswers
}

// ===== UI DISPLAY HELPERS =====

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  SELF_REPORTED: 'Self-Reported',
  VERIFICATION_REQUESTED: 'Verification Pending',
  VERIFICATION_IN_PROGRESS: 'Verification In Progress',
  VERIFIED: 'Verified',
  PARTIALLY_VERIFIED: 'Partially Verified',
  VERIFICATION_DENIED: 'Verification Denied',
  ATTEMPTS_EXHAUSTED: 'No Response',
  VERIFICATION_DECLINED: 'Declined to Verify',
}

export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, { bg: string; text: string; border: string }> = {
  SELF_REPORTED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
  VERIFICATION_REQUESTED: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-600' },
  VERIFICATION_IN_PROGRESS: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-600' },
  VERIFIED: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-600' },
  PARTIALLY_VERIFIED: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-600' },
  VERIFICATION_DENIED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-600' },
  ATTEMPTS_EXHAUSTED: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-600' },
  VERIFICATION_DECLINED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
}

export function getVerificationStatusIcon(status: VerificationStatus): string {
  switch (status) {
    case 'SELF_REPORTED': return '📝'
    case 'VERIFICATION_REQUESTED': return '📨'
    case 'VERIFICATION_IN_PROGRESS': return '⏳'
    case 'VERIFIED': return '✅'
    case 'PARTIALLY_VERIFIED': return '⚠️'
    case 'VERIFICATION_DENIED': return '❌'
    case 'ATTEMPTS_EXHAUSTED': return '⚠️'
    case 'VERIFICATION_DECLINED': return '🚫'
  }
}

// ===== SUMMARY TYPES FOR HUBS =====

export interface DriverVerificationSummary {
  totalEmployments: number
  selfReported: number
  pendingVerification: number
  verified: number
  partiallyVerified: number
  denied: number
  attemptsExhausted: number
  // Active verifications happening right now
  activeVerifications: {
    employmentId: string
    employerName: string
    requestingCompanyName: string
    status: VerificationStatus
    attemptCount: number
  }[]
}

export interface EmployerVerificationSummary {
  totalRequested: number
  pendingResponse: number
  verified: number
  denied: number
  attemptsExhausted: number
  // Requests this employer initiated
  requests: VerificationRequest[]
}
