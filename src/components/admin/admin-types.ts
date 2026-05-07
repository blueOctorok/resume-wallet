import { ReactNode } from 'react'

export type TabId =
  | 'companies'
  | 'accessRequests'
  | 'jobs'
  | 'applications'
  | 'outreach'
  | 'users'
  | 'candidates'
  | 'dotApps'
  | 'resumes'
  | 'mvr'
  | 'psp'
  | 'bgcheckRequests'
  | 'devProjects'
  | 'verifications'
  | 'tools'

/** Who placed a screening order (MVR / PSP). Drives FCRA isolation in the UI. */
export type ScreeningOrderedBy =
  | { type: 'self' }
  | { type: 'employer'; companyId: string; companyName: string | null }

export interface AdminTabProps {
  theme: 'light' | 'dark'
  walletAddress: string
  searchQuery: string
  currentPage: number
  pageSize: number
  setTotalCount: (count: number) => void
  onDelete: (target: DeleteTarget) => void
}

export interface DeleteTarget {
  type: string
  id: string
  name: string
}

export interface SidebarTab {
  id: TabId
  label: string
  icon: ReactNode
}

export interface SidebarSection {
  id: string
  label: string
  tabs: SidebarTab[]
}

export interface User {
  id: string
  wallet_address: string
  email: string | null
  displayName: string | null
  displayEmail: string | null
  role: string | null
  is_active: boolean
  created_at: string
  hasProfile: boolean
  hasDevProfile: boolean
  resumeCount: number
  dotAppCount: number
  devProjectCount: number
  isAdmin: boolean
  installedBlocks: string[]
  blockCategories: string[]
}

export interface DevProfile {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  full_name: string | null
  headline: string | null
  github_username: string | null
  skills: Array<{ name: string; category?: string }> | null
  available_for_work: boolean
  created_at: string
  updated_at: string
  walletAddress: string
  projectCount: number
  skillCount: number
}

export interface DevProject {
  id: string
  user_id: string
  developer_profile_id: string | null
  title: string
  description: string | null
  tech_stack: string[] | null
  live_url: string | null
  repo_url: string | null
  is_featured: boolean
  is_public: boolean
  role: string | null
  created_at: string
  updated_at: string
  walletAddress: string
  ownerName: string
  techCount: number
}

export interface AdminCompany {
  id: string
  name: string
  dotNumber: string | null
  mcNumber: string | null
  status: 'pending' | 'active' | 'suspended'
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  companySize: string | null
  verified: boolean
  designatedOwnerEmail: string | null
  onboardingCompleted: boolean
  adminNotes: string | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  ownerEmail: string | null
  teamMemberCount: number
  approvedAt: string | null
  suspendedAt: string | null
  suspensionReason: string | null
  createdAt: string
}

export interface AdminJob {
  id: string
  title: string
  description: string | null
  targetRole: string | null
  locationCity: string | null
  locationState: string | null
  salaryMin: number | null
  salaryMax: number | null
  jobType: string | null
  isActive: boolean
  isExternal: boolean
  externalSource: string | null
  createdAt: string
  updatedAt: string
  companyId: string
  companyName: string
  companyDotNumber: string | null
  applicationCount: number
}

export interface AdminApplication {
  id: string
  status: string
  coverLetter: string | null
  createdAt: string
  updatedAt: string
  jobId: string
  jobTitle: string
  companyName: string
  applicantId: string
  applicantWallet: string | null
  applicantEmail: string | null
  applicantName: string | null
  resumeId: string | null
  resumeTitle: string | null
  dotApplicationId: string | null
  dotApplicationComplete: boolean
  dotApplicationStatus: string | null
}

export interface AdminOutreach {
  id: string
  token: string
  type: string
  status: string
  candidateEmail: string | null
  candidateName: string | null
  welcomeMessage: string | null
  createdAt: string
  expiresAt: string | null
  emailSentAt: string | null
  companyId: string
  companyName: string
  jobId: string | null
  jobTitle: string | null
  createdByWallet: string | null
  createdByEmail: string | null
}

export interface UserDetail {
  user: User
  profile: Profile | null
  devProfile: DevProfile | null
  devProjects: DevProject[]
  resumes: Resume[]
  dotApps: DotApp[]
}

export interface DotApp {
  id: string
  user_id: string
  is_complete: boolean
  current_step: number
  verification_status: string
  created_at: string
  walletAddress: string
  applicantName: string
}

export interface MvrRow {
  id: string
  driverUserId: string
  walletAddress: string
  driverName: string
  status: string
  dlState: string | null
  orderedAt: string | null
  createdAt: string
  accioOrderNumber: string | null
  orderedBy: ScreeningOrderedBy
  licenseStatus: string | null
  totalPoints: number | null
  violationCount: number | null
  resultStatus: string | null
}

export interface PspRow {
  id: string
  driverUserId: string
  walletAddress: string
  driverName: string
  status: string
  dlState: string | null
  orderedAt: string | null
  createdAt: string
  accioOrderNumber: string | null
  orderedBy: ScreeningOrderedBy
  resultStatus: string | null
  resultReceivedAt: string | null
}

export interface BgcheckRequest {
  id: string
  companyId: string
  companyName: string
  candidateUserId: string
  driverName: string
  driverEmail: string | null
  driverWallet: string | null
  status: string
  requestedAt: string
  expiresAt: string | null
  hasSigned: boolean
  signedAt: string | null
  signedName: string | null
  consentId: string | null
}

export interface VerificationRow {
  id: string
  driverId: string
  applicantWallet: string | null
  employmentId: string
  initiatedBy: string
  applicantType: string
  previousEmployerName: string
  previousEmployerEmail: string | null
  claimedPosition: string
  claimedStartDate: string | null
  claimedEndDate: string | null
  status: string
  attemptCount: number
  createdAt: string
}

export interface Profile {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  cdl_number: string | null
  cdl_state: string | null
  last_updated_from: string | null
  updated_at: string
  walletAddress: string
  fullName: string
}

export interface CompanyMember {
  id: string
  userId: string | null
  role: string
  isActive: boolean
  isPending: boolean
  invitedAt: string
  acceptedAt: string | null
  inviteEmail: string | null
  name: string | null
  email: string | null
  walletAddress: string | null
}

export interface Resume {
  id: string
  user_id: string
  title: string | null
  filename: string | null
  verification_status: string
  resume_type: string
  created_at: string
  walletAddress: string
  ownerName: string
}

export interface AccessRequest {
  id: string
  wallet_address: string
  email: string | null
  name: string
  company_name: string
  description: string | null
  status: string
  ai_decision: string | null
  ai_reason: string | null
  ai_confidence: number | null
  created_at: string
}

export interface AccessRequestsStats {
  pending: number
  approved: number
  rejected: number
  flagged: number
  auto_approved: number
  blocked: number
  total: number
}
