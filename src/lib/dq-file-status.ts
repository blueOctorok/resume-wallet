/**
 * DQ file status resolver — company lens + driver lens.
 *
 * Pure functions over already-fetched rows. API routes gather data;
 * this module never touches Supabase.
 *
 * Teaching note: employer-paid MVR/PSP stay company-scoped (FCRA). The company
 * lens only counts orders for that companyId. The driver lens shows driver-owned
 * artifacts + pending requests — never another company's private reports.
 */

import {
  DQ_ITEM_DEFINITIONS,
  dqSourceChipLabel,
  getLiveDqItems,
  type DqItemDefinition,
  type DqItemId,
} from '@/lib/dq-file-registry'

// ── Status vocabulary ──────────────────────────────────────────────────────

export type DqItemStatus =
  | 'complete'
  | 'processing'
  | 'in_progress'
  | 'requested'
  | 'missing'
  | 'failed'
  | 'needs_driver'
  | 'needs_key'
  | 'needs_gov'
  | 'needs_employer'
  | 'coming_soon'

export type DqOverallStatus = 'not_started' | 'started' | 'in_progress' | 'complete'

export interface DqItemStatusResult {
  id: DqItemId
  label: string
  description: string
  source: DqItemDefinition['source']
  cfrNote?: string
  status: DqItemStatus
  /** True when this item counts toward overall completion. */
  blocksOverallCompletion: boolean
  updatedAt: string | null
  artifactRef: { kind: string; id: string } | null
  emptyHint: string
  sourceChip: string | null
  /** Hire-clock helper for employment verification (company lens). */
  hireClock?: {
    hireDate: string
    dueDate: string
    daysRemaining: number | null
    overdue: boolean
  } | null
}

export interface DqFileSnapshot {
  items: DqItemStatusResult[]
  overall: DqOverallStatus
  completedCount: number
  totalLiveCount: number
  lastActivityAt: string | null
}

// ── Input shapes (minimal — avoid coupling to full DB row types) ────────────

export interface DqScreeningOrderInput {
  id: string
  status: string
  completedAt?: string | null
  processedAt?: string | null
  orderedAt?: string | null
  createdAt?: string | null
}

export interface DqConsentBundleInput {
  id: string
  status: string
  cdlisSignedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
}

export interface DqDotApplicationInput {
  id: string
  isComplete: boolean
  currentStep?: number | null
  updatedAt?: string | null
  createdAt?: string | null
}

export interface DqEmploymentVerificationInput {
  id: string
  status: string
  finalizedAt?: string | null
  updatedAt?: string | null
  createdAt?: string | null
}

export interface DqPendingRequestInput {
  id: string
  targetBlockType?: string | null
  requestType?: string | null
  status: string
  updatedAt?: string | null
  createdAt?: string | null
}

export interface ResolveCompanyDqInput {
  mvrOrders: DqScreeningOrderInput[]
  pspOrders: DqScreeningOrderInput[]
  consentBundles: DqConsentBundleInput[]
  dotApplications: DqDotApplicationInput[]
  employmentVerifications: DqEmploymentVerificationInput[]
  /** ISO date when the company hired this driver — enables 30-day EV clock. */
  hireDate?: string | null
}

export interface ResolveDriverDqInput {
  /** Driver-owned (or any visible-to-driver) MVR orders. */
  mvrOrders: DqScreeningOrderInput[]
  pspOrders: DqScreeningOrderInput[]
  /** Any consent bundles the driver has started/completed (any company). */
  consentBundles: DqConsentBundleInput[]
  dotApplications: DqDotApplicationInput[]
  employmentVerifications: DqEmploymentVerificationInput[]
  pendingRequests: DqPendingRequestInput[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TERMINAL_COMPLETE_ORDER = new Set(['completed', 'needs_review'])
const PROCESSING_ORDER = new Set(['pending', 'processing'])
const FAILED_ORDER = new Set(['failed', 'cancelled', 'expired', 'superseded'])

const EV_COMPLETE = new Set(['VERIFIED', 'PARTIALLY_VERIFIED'])
const EV_IN_PROGRESS = new Set([
  'VERIFICATION_REQUESTED',
  'VERIFICATION_IN_PROGRESS',
  'SELF_REPORTED',
])
const EV_FAILED = new Set([
  'VERIFICATION_DENIED',
  'ATTEMPTS_EXHAUSTED',
  'VERIFICATION_DECLINED',
])

function pickNewestOrder(orders: DqScreeningOrderInput[]): DqScreeningOrderInput | null {
  if (orders.length === 0) return null
  return [...orders].sort((a, b) => {
    const at = Date.parse(a.createdAt || a.orderedAt || '') || 0
    const bt = Date.parse(b.createdAt || b.orderedAt || '') || 0
    return bt - at
  })[0]
}

function orderTimestamp(o: DqScreeningOrderInput): string | null {
  return o.completedAt || o.processedAt || o.orderedAt || o.createdAt || null
}

function mapOrderStatus(order: DqScreeningOrderInput | null): {
  status: DqItemStatus
  updatedAt: string | null
  artifactRef: DqItemStatusResult['artifactRef']
} {
  if (!order) {
    return { status: 'missing', updatedAt: null, artifactRef: null }
  }
  const s = (order.status || '').toLowerCase()
  if (TERMINAL_COMPLETE_ORDER.has(s)) {
    return {
      status: 'complete',
      updatedAt: orderTimestamp(order),
      artifactRef: { kind: 'order', id: order.id },
    }
  }
  if (PROCESSING_ORDER.has(s)) {
    return {
      status: 'processing',
      updatedAt: orderTimestamp(order),
      artifactRef: { kind: 'order', id: order.id },
    }
  }
  if (FAILED_ORDER.has(s)) {
    return {
      status: 'failed',
      updatedAt: orderTimestamp(order),
      artifactRef: { kind: 'order', id: order.id },
    }
  }
  return {
    status: 'in_progress',
    updatedAt: orderTimestamp(order),
    artifactRef: { kind: 'order', id: order.id },
  }
}

function placeholderStatus(def: DqItemDefinition): DqItemStatus {
  switch (def.source) {
    case 'driver_upload':
      return 'needs_driver'
    case 'key':
      return 'needs_key'
    case 'gov':
      return 'needs_gov'
    case 'employer_action':
      return 'needs_employer'
    default:
      return 'coming_soon'
  }
}

function buildHireClock(hireDate: string): DqItemStatusResult['hireClock'] {
  const hire = new Date(hireDate)
  if (Number.isNaN(hire.getTime())) return null
  const due = new Date(hire)
  due.setUTCDate(due.getUTCDate() + 30)
  const now = Date.now()
  const msLeft = due.getTime() - now
  const daysRemaining = Math.ceil(msLeft / (24 * 60 * 60 * 1000))
  return {
    hireDate: hire.toISOString(),
    dueDate: due.toISOString(),
    daysRemaining,
    overdue: msLeft < 0,
  }
}

function resolveEmploymentVerification(
  rows: DqEmploymentVerificationInput[],
  hireDate: string | null | undefined,
  emptyHint: string,
): Pick<DqItemStatusResult, 'status' | 'updatedAt' | 'artifactRef' | 'hireClock' | 'emptyHint'> {
  const hireClock = hireDate ? buildHireClock(hireDate) : null

  if (rows.length === 0) {
    return {
      status: 'missing',
      updatedAt: null,
      artifactRef: null,
      hireClock,
      emptyHint,
    }
  }

  // Prefer any verified row; else newest in-progress; else newest overall.
  const verified = rows.find((r) => EV_COMPLETE.has(r.status))
  if (verified) {
    return {
      status: 'complete',
      updatedAt: verified.finalizedAt || verified.updatedAt || verified.createdAt || null,
      artifactRef: { kind: 'employment_verification', id: verified.id },
      hireClock,
      emptyHint,
    }
  }

  const inFlight = rows.find((r) => EV_IN_PROGRESS.has(r.status))
  if (inFlight) {
    return {
      status: 'in_progress',
      updatedAt: inFlight.updatedAt || inFlight.createdAt || null,
      artifactRef: { kind: 'employment_verification', id: inFlight.id },
      hireClock,
      emptyHint,
    }
  }

  const failed = rows.find((r) => EV_FAILED.has(r.status))
  if (failed) {
    return {
      status: 'failed',
      updatedAt: failed.updatedAt || failed.createdAt || null,
      artifactRef: { kind: 'employment_verification', id: failed.id },
      hireClock,
      emptyHint,
    }
  }

  const newest = rows[0]
  return {
    status: 'in_progress',
    updatedAt: newest.updatedAt || newest.createdAt || null,
    artifactRef: { kind: 'employment_verification', id: newest.id },
    hireClock,
    emptyHint,
  }
}

function hasPendingRequest(
  pending: DqPendingRequestInput[],
  match: (r: DqPendingRequestInput) => boolean,
): DqPendingRequestInput | null {
  const open = pending.filter(
    (r) => r.status === 'pending' || r.status === 'viewed',
  )
  return open.find(match) ?? null
}

function rollup(items: DqItemStatusResult[]): Omit<DqFileSnapshot, 'items'> {
  const live = items.filter((i) => i.blocksOverallCompletion)
  const totalLiveCount = live.length
  const completedCount = live.filter((i) => i.status === 'complete').length

  const activityTimes = items
    .map((i) => (i.updatedAt ? Date.parse(i.updatedAt) : NaN))
    .filter((t) => !Number.isNaN(t))
  const lastActivityAt =
    activityTimes.length > 0
      ? new Date(Math.max(...activityTimes)).toISOString()
      : null

  if (completedCount === 0) {
    const anyStarted = live.some((i) =>
      ['processing', 'in_progress', 'requested', 'failed'].includes(i.status),
    )
    return {
      overall: anyStarted ? 'started' : 'not_started',
      completedCount,
      totalLiveCount,
      lastActivityAt,
    }
  }

  if (completedCount === totalLiveCount) {
    return {
      overall: 'complete',
      completedCount,
      totalLiveCount,
      lastActivityAt,
    }
  }

  return {
    overall: 'in_progress',
    completedCount,
    totalLiveCount,
    lastActivityAt,
  }
}

function baseItem(
  def: DqItemDefinition,
  partial: Pick<
    DqItemStatusResult,
    'status' | 'updatedAt' | 'artifactRef' | 'hireClock' | 'emptyHint'
  > & { sourceChip?: string | null },
): DqItemStatusResult {
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    source: def.source,
    cfrNote: def.cfrNote,
    blocksOverallCompletion: def.blocksOverallCompletion,
    status: partial.status,
    updatedAt: partial.updatedAt,
    artifactRef: partial.artifactRef,
    emptyHint: partial.emptyHint,
    sourceChip: partial.sourceChip ?? null,
    hireClock: partial.hireClock ?? null,
  }
}

// ── Public resolvers ───────────────────────────────────────────────────────

export function resolveCompanyDqFile(input: ResolveCompanyDqInput): DqFileSnapshot {
  const items: DqItemStatusResult[] = []

  for (const def of DQ_ITEM_DEFINITIONS) {
    const emptyHint = def.employerEmptyHint

    if (!def.blocksOverallCompletion) {
      const status = placeholderStatus(def)
      items.push(
        baseItem(def, {
          status,
          updatedAt: null,
          artifactRef: null,
          emptyHint,
          sourceChip: dqSourceChipLabel(def.source),
        }),
      )
      continue
    }

    switch (def.id) {
      case 'mvr': {
        const mapped = mapOrderStatus(pickNewestOrder(input.mvrOrders))
        items.push(
          baseItem(def, {
            ...mapped,
            emptyHint,
            sourceChip: mapped.status === 'missing' ? dqSourceChipLabel(def.source) : null,
          }),
        )
        break
      }
      case 'psp': {
        const mapped = mapOrderStatus(pickNewestOrder(input.pspOrders))
        items.push(
          baseItem(def, {
            ...mapped,
            emptyHint,
            sourceChip: mapped.status === 'missing' ? dqSourceChipLabel(def.source) : null,
          }),
        )
        break
      }
      case 'dot_application': {
        const apps = [...input.dotApplications].sort((a, b) => {
          const at = Date.parse(a.updatedAt || a.createdAt || '') || 0
          const bt = Date.parse(b.updatedAt || b.createdAt || '') || 0
          return bt - at
        })
        const complete = apps.find((a) => a.isComplete)
        if (complete) {
          items.push(
            baseItem(def, {
              status: 'complete',
              updatedAt: complete.updatedAt || complete.createdAt || null,
              artifactRef: { kind: 'dot_application', id: complete.id },
              emptyHint,
            }),
          )
        } else if (apps.length > 0) {
          const app = apps[0]
          items.push(
            baseItem(def, {
              status: 'in_progress',
              updatedAt: app.updatedAt || app.createdAt || null,
              artifactRef: { kind: 'dot_application', id: app.id },
              emptyHint,
            }),
          )
        } else {
          items.push(
            baseItem(def, {
              status: 'missing',
              updatedAt: null,
              artifactRef: null,
              emptyHint,
              sourceChip: 'Needs driver',
            }),
          )
        }
        break
      }
      case 'cdlis_consent': {
        // Consent complete when bundle.status === 'complete' (includes CDLIS signature).
        const bundles = [...input.consentBundles].sort((a, b) => {
          const at = Date.parse(a.completedAt || a.createdAt || '') || 0
          const bt = Date.parse(b.completedAt || b.createdAt || '') || 0
          return bt - at
        })
        const complete = bundles.find(
          (b) => b.status === 'complete' || Boolean(b.cdlisSignedAt),
        )
        if (complete) {
          items.push(
            baseItem(def, {
              status: 'complete',
              updatedAt: complete.cdlisSignedAt || complete.completedAt || complete.createdAt || null,
              artifactRef: { kind: 'consent_bundle', id: complete.id },
              emptyHint,
            }),
          )
        } else if (bundles.length > 0) {
          const b = bundles[0]
          items.push(
            baseItem(def, {
              status: 'in_progress',
              updatedAt: b.createdAt || null,
              artifactRef: { kind: 'consent_bundle', id: b.id },
              emptyHint,
            }),
          )
        } else {
          items.push(
            baseItem(def, {
              status: 'missing',
              updatedAt: null,
              artifactRef: null,
              emptyHint,
              sourceChip: dqSourceChipLabel(def.source),
            }),
          )
        }
        break
      }
      case 'employment_verification': {
        const ev = resolveEmploymentVerification(
          input.employmentVerifications,
          input.hireDate,
          emptyHint,
        )
        items.push(
          baseItem(def, {
            ...ev,
            sourceChip: ev.status === 'missing' ? dqSourceChipLabel(def.source) : null,
          }),
        )
        break
      }
      default:
        items.push(
          baseItem(def, {
            status: 'coming_soon',
            updatedAt: null,
            artifactRef: null,
            emptyHint,
            sourceChip: dqSourceChipLabel(def.source),
          }),
        )
    }
  }

  return { items, ...rollup(items) }
}

export function resolveDriverDqFile(input: ResolveDriverDqInput): DqFileSnapshot {
  const items: DqItemStatusResult[] = []

  for (const def of DQ_ITEM_DEFINITIONS) {
    const emptyHint = def.driverEmptyHint

    if (!def.blocksOverallCompletion) {
      const status = placeholderStatus(def)
      items.push(
        baseItem(def, {
          status,
          updatedAt: null,
          artifactRef: null,
          emptyHint,
          sourceChip: dqSourceChipLabel(def.source),
        }),
      )
      continue
    }

    switch (def.id) {
      case 'mvr': {
        const mapped = mapOrderStatus(pickNewestOrder(input.mvrOrders))
        if (mapped.status === 'missing') {
          const req = hasPendingRequest(
            input.pendingRequests,
            (r) =>
              r.targetBlockType === 'driver-mvr' ||
              r.requestType === 'mvr_order',
          )
          if (req) {
            items.push(
              baseItem(def, {
                status: 'requested',
                updatedAt: req.updatedAt || req.createdAt || null,
                artifactRef: { kind: 'candidate_request', id: req.id },
                emptyHint,
                sourceChip: 'Employer requested',
              }),
            )
            break
          }
        }
        items.push(
          baseItem(def, {
            ...mapped,
            emptyHint,
            sourceChip: mapped.status === 'missing' ? 'Employer may order' : null,
          }),
        )
        break
      }
      case 'psp': {
        const mapped = mapOrderStatus(pickNewestOrder(input.pspOrders))
        if (mapped.status === 'missing') {
          const req = hasPendingRequest(
            input.pendingRequests,
            (r) =>
              r.targetBlockType === 'driver-psp' ||
              r.requestType === 'psp_order',
          )
          if (req) {
            items.push(
              baseItem(def, {
                status: 'requested',
                updatedAt: req.updatedAt || req.createdAt || null,
                artifactRef: { kind: 'candidate_request', id: req.id },
                emptyHint,
                sourceChip: 'Employer requested',
              }),
            )
            break
          }
        }
        items.push(
          baseItem(def, {
            ...mapped,
            emptyHint,
            sourceChip: mapped.status === 'missing' ? 'Employer may order' : null,
          }),
        )
        break
      }
      case 'dot_application': {
        const apps = [...input.dotApplications].sort((a, b) => {
          const at = Date.parse(a.updatedAt || a.createdAt || '') || 0
          const bt = Date.parse(b.updatedAt || b.createdAt || '') || 0
          return bt - at
        })
        const complete = apps.find((a) => a.isComplete)
        if (complete) {
          items.push(
            baseItem(def, {
              status: 'complete',
              updatedAt: complete.updatedAt || complete.createdAt || null,
              artifactRef: { kind: 'dot_application', id: complete.id },
              emptyHint,
            }),
          )
        } else if (apps.length > 0) {
          const app = apps[0]
          items.push(
            baseItem(def, {
              status: 'in_progress',
              updatedAt: app.updatedAt || app.createdAt || null,
              artifactRef: { kind: 'dot_application', id: app.id },
              emptyHint,
            }),
          )
        } else {
          const req = hasPendingRequest(
            input.pendingRequests,
            (r) => r.targetBlockType === 'driver-dot-application',
          )
          items.push(
            baseItem(def, {
              status: req ? 'requested' : 'missing',
              updatedAt: req?.updatedAt || req?.createdAt || null,
              artifactRef: req ? { kind: 'candidate_request', id: req.id } : null,
              emptyHint,
              sourceChip: req ? 'Employer requested' : null,
            }),
          )
        }
        break
      }
      case 'cdlis_consent': {
        const bundles = [...input.consentBundles].sort((a, b) => {
          const at = Date.parse(a.completedAt || a.createdAt || '') || 0
          const bt = Date.parse(b.completedAt || b.createdAt || '') || 0
          return bt - at
        })
        const complete = bundles.find(
          (b) => b.status === 'complete' || Boolean(b.cdlisSignedAt),
        )
        if (complete) {
          items.push(
            baseItem(def, {
              status: 'complete',
              updatedAt: complete.cdlisSignedAt || complete.completedAt || complete.createdAt || null,
              artifactRef: { kind: 'consent_bundle', id: complete.id },
              emptyHint,
            }),
          )
        } else if (bundles.length > 0) {
          const b = bundles[0]
          items.push(
            baseItem(def, {
              status: 'in_progress',
              updatedAt: b.createdAt || null,
              artifactRef: { kind: 'consent_bundle', id: b.id },
              emptyHint,
            }),
          )
        } else {
          const req = hasPendingRequest(
            input.pendingRequests,
            (r) => r.targetBlockType === 'driver-screening-consent',
          )
          items.push(
            baseItem(def, {
              status: req ? 'requested' : 'missing',
              updatedAt: req?.updatedAt || req?.createdAt || null,
              artifactRef: req ? { kind: 'candidate_request', id: req.id } : null,
              emptyHint,
              sourceChip: req ? 'Employer requested' : null,
            }),
          )
        }
        break
      }
      case 'employment_verification': {
        const ev = resolveEmploymentVerification(
          input.employmentVerifications,
          null,
          emptyHint,
        )
        items.push(
          baseItem(def, {
            ...ev,
            sourceChip:
              ev.status === 'missing' ? 'Employer-led' : null,
          }),
        )
        break
      }
      default:
        items.push(
          baseItem(def, {
            status: 'coming_soon',
            updatedAt: null,
            artifactRef: null,
            emptyHint,
            sourceChip: dqSourceChipLabel(def.source),
          }),
        )
    }
  }

  return { items, ...rollup(items) }
}

export function dqOverallLabel(overall: DqOverallStatus): string {
  switch (overall) {
    case 'not_started':
      return 'Not started'
    case 'started':
      return 'Started'
    case 'in_progress':
      return 'In progress'
    case 'complete':
      return 'Complete'
  }
}

/** Exported for tests / API list summaries without re-resolving placeholders. */
export function getLiveItemCount(): number {
  return getLiveDqItems().length
}
