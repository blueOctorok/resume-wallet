import type { PageType } from '@/stores/types'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'

/** Artifact row for hub block management (formerly “Block files”). */
export interface HubDocument {
  id: string
  type: 'resume' | 'dotapp' | 'mvr' | 'portfolio' | 'github' | 'employment_verifications'
  title: string
  subtitle?: string
  createdAt?: string
  status: 'complete' | 'in-progress' | 'processing' | 'empty'
  verified: boolean
  txHash: string | null
  canVerify: boolean
  canDelete: boolean
  editPage: PageType | null
  ipfsHash?: string | null
  structuredData?: unknown | null
  resumeSourceRole?: 'driver' | 'developer' | 'general'
  portfolioUrl?: string | null
  githubUsername?: string | null
  stormResumeInitialPanel?: 'upload' | 'general' | 'driver' | 'developer'
}

/** Primary My Files row for a career-card block section (best-effort for legacy resume types). */
export function pickHubDocForCareerBlock(documents: HubDocument[], blockType: string): HubDocument | null {
  if (blockType === 'storm-resume') {
    const storm = documents.find((d) => d.type === 'resume' && d.editPage === 'storm-resume')
    if (storm) return storm
    return documents.find((d) => d.type === 'resume') ?? null
  }
  if (blockType === 'driver-resume') {
    return documents.find((d) => d.type === 'resume' && d.resumeSourceRole === 'driver') ?? null
  }
  if (blockType === 'developer-resume') {
    return documents.find((d) => d.type === 'resume' && d.resumeSourceRole === 'developer') ?? null
  }
  if (blockType === 'general-resume') {
    return documents.find((d) => d.type === 'resume' && d.resumeSourceRole === 'general') ?? null
  }
  if (blockType === 'driver-dot-application') {
    return documents.find((d) => d.type === 'dotapp') ?? null
  }
  if (blockType === 'driver-mvr') {
    return documents.find((d) => d.type === 'mvr') ?? null
  }
  if (blockType === 'developer-portfolio') {
    return documents.find((d) => d.type === 'portfolio') ?? null
  }
  if (blockType === 'developer-github') {
    return documents.find((d) => d.type === 'github') ?? null
  }
  if (blockType === 'general-employment-verification') {
    return documents.find((d) => d.type === 'employment_verifications') ?? null
  }
  return null
}

export function myFilesResumeCanView(doc: {
  type: string
  ipfsHash?: string | null
  structuredData?: unknown | null
}): boolean {
  if (doc.type !== 'resume') return false
  const ipfs = isLiveResumeIpfsHash(doc.ipfsHash ?? undefined)
  const sd = doc.structuredData
  const built = sd != null && typeof sd === 'object' && Object.keys(sd as object).length > 0
  return ipfs || built
}
