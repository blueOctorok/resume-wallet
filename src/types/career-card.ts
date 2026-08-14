/**
 * Career Card Projection Types
 *
 * The career card is a read-only projection of the candidate's hub blocks.
 * Each installed block with `appearsOnCareerCard: true` maps to a
 * CareerCardSection with block-specific data fetched from the DB.
 */

import type { HubPendingEmployerScreening } from '@/lib/hub-document-types'

// ── Section data shapes ──────────────────────────────────────────────────────
// Each block type has a known payload shape. Using a discriminated union
// so section renderers can narrow on `blockType` and get typed `data`.

export interface ResumeData {
  id: string
  title: string
  filename: string
  ipfsHash: string
  storagePath?: string | null
  documentUrl?: string | null
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
  /** @deprecated Legacy Base hash-seal — never treat as issuer verification (DEC-2026-07-001) */
  blockchainTxHash?: string | null
  /** P3.7 — issuer-backed risk fields ÷ filled risk-bearing denominator */
  verifiedPercent?: number
  verifiedCount?: number
  verifiedTotalCount?: number
  /** True when verifiedCount is a strict majority of verifiedTotalCount */
  majorityVerified?: boolean
}

export interface MvrData {
  orderId: string
  orderStatus: string
  /**
   * High-level Accio outcome derived from filledCode. Drives the colored
   * badge in MvrSection / MvrViewModal / employer Files vault.
   * See `src/lib/accio-result-status.ts` (`ScreeningOutcome`) for the union.
   */
  resultOutcome?: 'clear' | 'no_hits' | 'hits' | 'discrepancy' | 'pass' | 'fail' | 'unknown' | null
  licenseState: string
  orderedAt: string
  completedAt: string | null
  results: {
    licenseStatus: string
    licenseClass: string
    totalPoints: number
    violationCount: number
  } | null
  /**
   * True when a company paid for this order (`ordered_by_company_id` set).
   * Candidate hub shows status only; full MVR opens for the purchasing employer.
   */
  employerPaidScreening?: boolean
  /** Present before an order exists — employer asked for screening; hub uses for CTA copy. */
  pendingEmployerRequest?: HubPendingEmployerScreening
}

/** FMCSA PSP / crash-inspection — summary until Accio result XML is parsed. */
export interface PspData {
  orderId: string
  orderStatus: string
  /** Same semantics as {@link MvrData.resultOutcome}. */
  resultOutcome?: 'clear' | 'no_hits' | 'hits' | 'discrepancy' | 'pass' | 'fail' | 'unknown' | null
  licenseState: string
  orderedAt: string
  completedAt: string | null
  resultSummary: { resultStatus: string | null } | null
  /** Same semantics as {@link MvrData.employerPaidScreening}. */
  employerPaidScreening?: boolean
  pendingEmployerRequest?: HubPendingEmployerScreening
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

/** Per-employer screening consent bundle (FCRA + FMCSA + CDLIS) — self card only */
export interface ScreeningConsentData {
  bundles: Array<{
    id: string
    companyName: string | null
    status: string
    completedAt: string | null
  }>
}

// ── Section union ────────────────────────────────────────────────────────────

export type SectionDataMap = {
  'storm-resume': ResumeData
  'driver-resume': ResumeData
  'developer-resume': ResumeData
  'general-resume': ResumeData
  'driver-dot-application': DotAppData
  'driver-screening-consent': ScreeningConsentData
  'driver-mvr': MvrData
  'driver-psp': PspData
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
  /** True when the block is installed but has no real data yet (using EMPTY_SECTION_DATA fallback). */
  needsSetup?: boolean
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

/** Attestation row projected onto the career card Verified strip */
export interface CardAttestedFact {
  id: string
  factType: string
  label: string
  provenance: string
}

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
   * Employer talent view only — this company's paid PSP (FCRA).
   * Omitted for self/public; never merged into candidate-owned projection.
   */
  employerCompanyPsp?: PspData | null
  /** Attestations for the Verified strip — from `attestations`, not block_*. */
  attestedFacts?: CardAttestedFact[]
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
