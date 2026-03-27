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
  structuredData: Record<string, unknown> | null
  createdAt: string
}

export interface DotAppData {
  id: string
  status: string
  isComplete: boolean
  createdAt: string
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
}

/** Props mode for the career card component */
export type CareerCardMode = 'self' | 'public' | 'employer'
