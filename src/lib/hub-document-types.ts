import type { PageType } from '@/stores/types'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'

/** Employer screening not yet fulfilled — hub + career card use this instead of self-pay “Order” copy. */
export interface HubPendingEmployerScreening {
  requestId: string
  companyName: string
  /**
   * When the employer requested PSP+MVR (`driver-psp`), the MVR hub row should
   * deep-link to the PSP wizard (`pageRoute` `psp`), not the self-order MVR page.
   */
  bundledWithBlockType?: 'driver-psp'
}

/**
 * Maps `mvr_orders.status` / `psp_orders.status` to the coarse My Files / construct-chip status.
 * Pending vs processing: pending = ordered, waiting on vendor queue; processing = vendor actively running.
 */
export function hubDocStatusFromScreeningOrder(orderStatus: string | null | undefined): HubDocument['status'] {
  const s = String(orderStatus ?? '').toLowerCase()
  if (s === 'completed' || s === 'needs_review') return 'complete'
  if (s === 'failed' || s === 'cancelled' || s === 'expired') return 'failed'
  if (s === 'processing') return 'processing'
  if (s === 'pending') return 'in-progress'
  return 'in-progress'
}

/** Short label for the inline construct vault row (MVR / PSP). */
export function hubScreeningStatusLabel(status: HubDocument['status']): string {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'processing':
      return 'Processing'
    case 'in-progress':
      return 'Pending'
    case 'failed':
      return 'Unsuccessful'
    case 'empty':
      return 'Not started'
  }
}

function latestHubDocByType(documents: HubDocument[], type: HubDocument['type']): HubDocument | null {
  const rows = documents.filter(
    (d) => d.type === type && !String(d.id).endsWith('-hub-placeholder') && d.status !== 'empty',
  )
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })[0] ?? null
}

/** Artifact row for hub block management (formerly “Block files”). */
export interface HubDocument {
  id: string
  type: 'resume' | 'dotapp' | 'mvr' | 'psp' | 'portfolio' | 'github' | 'employment_verifications'
  title: string
  subtitle?: string
  createdAt?: string
  status: 'complete' | 'in-progress' | 'processing' | 'empty' | 'failed'
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
  /** Company-paid screening — candidate sees progress only; full report opens for the employer purchaser. */
  employerPaidScreening?: boolean
  /** Set while `candidate_requests` is pending/viewed — before an order row exists. */
  pendingEmployerRequest?: HubPendingEmployerScreening
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
    return latestHubDocByType(documents, 'mvr') ?? documents.find((d) => d.type === 'mvr') ?? null
  }
  if (blockType === 'driver-psp') {
    return latestHubDocByType(documents, 'psp') ?? documents.find((d) => d.type === 'psp') ?? null
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
