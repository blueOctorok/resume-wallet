/**
 * Shared type definitions for Zustand stores
 * Keep types here to avoid circular dependencies between stores
 * 
 * NOTE: For form data types, we use `any` to maintain compatibility
 * with existing code during migration. These will be properly typed
 * once the migration is complete.
 */

// Page navigation types - includes all possible pages across all roles
export type PageType =
  | 'signin'
  | 'resume'
  | 'storm-resume'
  | 'general-resume'
  | 'developer-resume'
  | 'dotapp'
  | 'jobs'
  | 'hunt-desk'
  | 'applications'
  | 'mvr'
  | 'psp'
  | 'hub'
  | 'applicants'
  | 'talent-search'
  | 'post-job'
  | 'company-profile'
  | 'portfolio'
  | 'github'
  | 'team'
  | 'company-setup'
  | 'career-card'
  | 'profile-setup'
  | 'messages'
  | 'employment-verification'
  | 'screening-consent'
  | null

// Candidate encompasses all non-employer roles (driver, developer, pilot, etc.)
// 'driver' and 'developer' remain valid for existing users — new users get 'candidate'
// until the composable hub refactor is complete.
export type UserRole = 'driver' | 'developer' | 'employer' | 'candidate' | null

// DOT Application types - using `any` for now to maintain compatibility
// with existing form components during migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DotForm1Data = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DotForm2Data = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DotForm3Data = any

export interface DotApplicationData {
  form1: DotForm1Data | null
  form2: DotForm2Data | null
  form3: DotForm3Data | null
}

// Blockchain data from submission
export interface BlockchainData {
  transactionHash: string
  blockNumber: number
  applicationId: number | null
}

// Driver Hub data types
export interface ResumeData {
  id: string
  title: string
  filename: string
  ipfsHash: string | null
  storagePath?: string | null
  documentUrl?: string | null
  verificationStatus: string
  blockchainTxHash: string | null
  createdAt: string
  fileSize: number | null
  resumeType: string
  isPaid: boolean
  sourceRole?: 'driver' | 'developer' | 'general'
}

export interface DotApplicationRecord {
  id: string
  createdAt: string
  verificationStatus: string
  blockchainTxHash: string | null
  blockchainApplicationId: string | null
  isComplete: boolean
  currentStep: number
  applicantName: string | null
  isInProgress: boolean
}

export interface MvrRecord {
  id: string
  orderStatus: string
  licenseState: string
  createdAt: string
  completedAt: string | null
  feeAmount: number | null
  feeCurrency: string | null
  licenseStatus: string | null
  totalPoints: number | null
  violationCount: number | null
  /** Present when hub API merged an MVR result row */
  hasResult?: boolean
}

export interface PspRecord {
  id: string
  orderStatus: string
  licenseState: string
  createdAt: string
  completedAt: string | null
  feeAmount: number | null
  feeCurrency: string | null
  orderedAt: string | null
  hasResult?: boolean
  resultId?: string | null
  resultStatus?: string | null
}

export interface JobApplication {
  id: string
  status: string
  appliedAt: string
  viewCount: number
  jobTitle: string
  companyName: string
}

export interface DriverHubStats {
  profileCompleteness: number
  totalResumes: number
  verifiedResumes: number
  totalDotApps: number
  verifiedDotApps: number
  completedDotApps: number
  inProgressDotApps: number
  totalMvrRecords: number
  validMvrRecords: number
  totalJobApplications: number
  pendingApplications: number
  totalSpentUSDC: number
  /** Employer opens of this candidate's card (talent search / pipeline), last 7 days */
  careerCardViewsThisWeek: number
  /** All-time employer opens (talent search / pipeline) — Stormi context */
  careerCardViewsTotal?: number
  /** At least one complete screening_consent_bundles row (any company) */
  hasScreeningConsentBundle?: boolean
  /** Unsuperseded attestations rows (Verified by Storm credentials) */
  attestationCount?: number
}

// Profile conflict resolution
export interface ProfileConflict {
  conflicts: string[]
  existing: {
    name: string
    cdlNumber?: string
    email?: string
    lastUpdatedFrom?: string
  }
  incoming: {
    name: string
    cdlNumber?: string
    email?: string
    source?: string
  }
  profileData: DotForm1Data | null
}

// Note: ResumeUploadEvent is defined in @/types/assistant
// Import it from there to avoid type conflicts
