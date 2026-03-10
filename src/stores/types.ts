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
  | 'dotapp'
  | 'jobs'
  | 'applications'
  | 'mvr'
  | 'hub'
  | 'stormchain'
  | 'applicants'
  | 'find-drivers'
  | 'talent-search'
  | 'post-job'
  | 'company-profile'
  | 'reports'
  | 'portfolio'
  | 'github'
  | 'team'
  | 'company-setup'
  | 'career-card'
  | 'profile-setup'
  | null

export type UserRole = 'driver' | 'developer' | 'employer' | null

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
  verificationStatus: string
  blockchainTxHash: string | null
  createdAt: string
  fileSize: number | null
  resumeType: string
  isPaid: boolean
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
