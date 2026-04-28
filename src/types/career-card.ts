/**
 * Career Card Projection Types
 *
 * The career card is a read-only projection of the candidate's hub blocks.
 * Each installed block with `appearsOnCareerCard: true` maps to a
 * CareerCardSection with block-specific data fetched from the DB.
 */

// ── Section data shapes ──────────────────────────────────────────────────────
// Each block type has a known payload shape. Using a discriminated union
// so section renderers can narrow on `blockType` and get typed `data`.

export interface ResumeData {
  id: string
  title: string
  filename: string
  ipfsHash: string
  verificationStatus: string
  /** Base Sepolia tx when resume registered on-chain */
  blockchainTxHash?: string | null
  structuredData: Record<string, unknown> | null
  createdAt: string
}

export interface DotAppData {
  id: string
  status: string
  isComplete: boolean
  createdAt: string
  /** Row last update — closer to on-chain confirmation time than createdAt */
  updatedAt?: string | null
  /** Base Sepolia tx when DOT app hash was submitted on-chain */
  blockchainTxHash?: string | null
}

export interface MvrData {
  orderId: string
  orderStatus: string
  licenseState: string
  orderedAt: string
  completedAt: string | null
  results: {
    licenseStatus: string
    licenseClass: string
    totalPoints: number
    violationCount: number
  } | null
}

export interface CdlData {
  cdlClass: string | null
  cdlState: string | null
  cdlNumber: string | null
  cdlExpiration: string | null
  endorsements: string[]
  restrictions: string[]
}

export interface PortfolioData {
  portfolioUrl: string | null
}

export interface GitHubData {
  username: string | null
  avatarUrl: string | null
  bio: string | null
  publicRepos: number
  followers: number
  languages: Record<string, number>
  topRepos: Array<{
    name: string
    description: string | null
    stars: number
    language: string | null
    url: string
  }>
}

export interface ProjectsData {
  projects: Array<{
    id: string
    title: string
    description: string | null
    techStack: string[]
    liveUrl: string | null
    repoUrl: string | null
    isFeatured: boolean
  }>
}

export interface SkillsData {
  skills: Array<{ name: string; category?: string }>
}

export interface WorkHistoryData {
  entries: Array<{
    companyName: string
    position: string
    startDate: string
    endDate: string | null
    isCurrent: boolean
  }>
  verifiedCount: number
}

// ── Section union ────────────────────────────────────────────────────────────

export type SectionDataMap = {
  'storm-resume': ResumeData
  'driver-resume': ResumeData
  'developer-resume': ResumeData
  'general-resume': ResumeData
  'driver-dot-application': DotAppData
  'driver-mvr': MvrData
  'driver-cdl-credentials': CdlData
  'developer-portfolio': PortfolioData
  'developer-github': GitHubData
  'developer-projects': ProjectsData
}

export type SectionBlockType = keyof SectionDataMap

export interface CareerCardSection<T extends SectionBlockType = SectionBlockType> {
  blockType: T
  label: string
  icon: string
  data: SectionDataMap[T]
  /** `hub_blocks.id` — present for candidate-owned cards from projection; used for reorder + config. */
  hubBlockId?: string
  /** Career card flip page (1-based). From `hub_blocks.config.cardPage`, default 1. */
  cardPage?: number
}

/** One row in the career card “on-chain credentials” trust strip */
export interface OnChainCredential {
  blockType: SectionBlockType
  label: string
  txHash: string
  /** ISO timestamp — resume uses created_at; DOT prefers updated_at when set */
  verifiedAt: string
}

/** One row in the career card “employers confirmed employment” trust strip */
export interface EmployerConfirmation {
  companyName: string
  position: string
  startDate: string
  endDate: string | null
  verifiedAt: string
}

// ── Projected card ───────────────────────────────────────────────────────────

export interface ProjectedCareerCard {
  userId: string
  name: string
  avatarUrl: string | null
  occupation: string | null
  professionalSummary: string | null
  location: string | null
  memberSince: string
  shareToken: string | null
  /** Only sections for installed blocks with appearsOnCareerCard: true */
  sections: CareerCardSection[]
  settings: {
    showContact: boolean
    allowConnect: boolean
  }
  contact?: {
    email: string | null
    phone: string | null
  }
  /** Populated only on public view */
  viewCount?: number
  /** Past employers who responded on-file (VERIFIED or PARTIALLY_VERIFIED) */
  employerConfirmedEmploymentCount: number
  /** Itemized confirmations behind employerConfirmedEmploymentCount */
  employerConfirmations: EmployerConfirmation[]
  /** Resume + DOT (and similar) credentials with an on-chain tx hash */
  onChainCredentialCount: number
  /** Itemized on-chain proofs behind onChainCredentialCount */
  onChainCredentials: OnChainCredential[]
  /** 0–100 strength meter: sections + employer confirmations + on-chain proofs */
  careerCardScore: number
  /**
   * Employer talent view only — this company's paid MVR (FCRA).
   * Omitted for self/public; never shown to the candidate or other employers.
   */
  employerCompanyMvr?: MvrData | null
  /**
   * The lens used to project this card. Always present in self/public views;
   * the default "Full profile" lens is returned when no specific one is
   * requested. Employer views omit this so the consumer stays framing-neutral.
   */
  activeLens?: {
    id: string
    name: string
    isDefault: boolean
  }
}

/** Props mode for the career card component (`construct` = hub workshop with inline block controls) */
export type CareerCardMode = 'self' | 'construct' | 'public' | 'employer'

/** Self + Construct — candidate can edit; public/employer are read-only projections. */
export function isCareerCardOwnerMode(mode: CareerCardMode): boolean {
  return mode === 'self' || mode === 'construct'
}
