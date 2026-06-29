import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { AttestationInput, FactType, ResolvedAttestationFact } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import {
  getMvrAttestationContext,
  getEmploymentVerificationForAttestation,
  type MvrAttestationContext,
} from '@/lib/block-data'
import type { MvrViolation } from '@/types/driver-profile'

const ACCIO_CRA = 'accio'
const PRIOR_EMPLOYER_CRA = 'prior_employer'
const MVR_ATTESTATION_TTL_MS = 365 * 24 * 60 * 60 * 1000
const EMPLOYMENT_ATTESTATION_TTL_MS = 90 * 24 * 60 * 60 * 1000
const MONTHS_36 = 36

/** Facts shipped in P2.3 — all third-party provenance. */
export type ShippedFactType =
  | 'mvr_clean_36_months'
  | 'cdl_class_a'
  | 'previous_employer_verified'

export interface ProveContext {
  candidateUserId: string
  factType: FactType
  parameters?: Record<string, unknown>
  audienceId?: string
  supabase: SupabaseClient
}

export interface FactResult {
  factSummary: string
  disclosedFields: Record<string, unknown>
  expiresAt?: string
  validUntil?: string
  sourceCra: string
  sourcePullId: string
}

export interface FactDefinition {
  factType: FactType
  label: string
  description: string
  category: 'driving' | 'license' | 'employment' | 'compliance'
  source: 'self_reported' | 'third_party'
  proveImpl: (ctx: ProveContext) => Promise<FactResult>
}

export function enforceProvenanceGate(def: Pick<FactDefinition, 'source' | 'factType'>): void {
  if (def.source === 'self_reported') {
    throw new AttestationError(
      `Provenance gate: fact "${def.factType}" is self-reported and cannot be attested`
    )
  }
}

function attestationExpiresAt(ttlMs: number): string {
  return new Date(Date.now() + ttlMs).toISOString()
}

function subtractMonths(anchor: Date, months: number): Date {
  const d = new Date(anchor)
  d.setMonth(d.getMonth() - months)
  return d
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseViolationDate(raw: string): Date | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

function movingViolationsInWindow(
  violations: MvrViolation[],
  windowStart: Date,
  windowEnd: Date,
): boolean {
  return violations.some((v) => {
    const d = parseViolationDate(v.date)
    return d !== null && d >= windowStart && d <= windowEnd
  })
}

function requireCompletedMvr(ctx: MvrAttestationContext): void {
  if (ctx.orderStatus !== 'completed') {
    throw new AttestationError('MVR order is not completed — cannot attest DMV-sourced facts')
  }
}

/** Extract single-letter CDL class from Accio license_class text (e.g. "A - CDL COMBINATION"). */
export function normalizeAccioCdlClass(licenseClass: string | null): string | null {
  if (!licenseClass?.trim()) return null
  const upper = licenseClass.trim().toUpperCase()
  const letterMatch = upper.match(/^([ABC])\b/)
  if (letterMatch) return letterMatch[1]
  const classMatch = upper.match(/\bCLASS\s*([ABC])\b/)
  return classMatch ? classMatch[1] : null
}

async function proveMvrClean36Months(ctx: ProveContext): Promise<FactResult> {
  const mvrCtx = await getMvrAttestationContext(ctx.supabase, ctx.candidateUserId)
  if (!mvrCtx) {
    throw new AttestationError(
      'No driver-owned completed MVR on file — cannot attest clean driving record',
    )
  }
  requireCompletedMvr(mvrCtx)

  const anchor = mvrCtx.completedAt
    ? new Date(mvrCtx.completedAt)
    : mvrCtx.mvr.last_ordered_at
      ? new Date(mvrCtx.mvr.last_ordered_at)
      : new Date()

  const windowEnd = anchor
  const windowStart = subtractMonths(anchor, MONTHS_36)

  const violations = mvrCtx.mvr.violations ?? []
  const hasRecentViolation = movingViolationsInWindow(violations, windowStart, windowEnd)

  if (hasRecentViolation) {
    throw new AttestationError(
      'Moving violations found within the 36-month verification window — cannot attest clean MVR'
    )
  }

  return {
    factSummary: 'Clean MVR — no moving violations in the last 36 months',
    disclosedFields: {
      verificationWindowStart: formatDateOnly(windowStart),
      verificationWindowEnd: formatDateOnly(windowEnd),
    },
    expiresAt: attestationExpiresAt(MVR_ATTESTATION_TTL_MS),
    validUntil: mvrCtx.mvr.expires_at ?? undefined,
    sourceCra: ACCIO_CRA,
    sourcePullId: mvrCtx.accioOrderNumber,
  }
}

async function proveCdlClassA(ctx: ProveContext): Promise<FactResult> {
  const mvrCtx = await getMvrAttestationContext(ctx.supabase, ctx.candidateUserId)
  if (!mvrCtx) {
    throw new AttestationError('No MVR on file — cannot attest CDL class from DMV')
  }
  requireCompletedMvr(mvrCtx)

  const normalized = normalizeAccioCdlClass(mvrCtx.licenseClass)
  if (normalized !== 'A') {
    throw new AttestationError('DMV MVR does not show Class A CDL — cannot attest')
  }

  const expiresAt =
    mvrCtx.mvr.expires_at ?? attestationExpiresAt(MVR_ATTESTATION_TTL_MS)

  return {
    factSummary: 'Holds Class A CDL (DMV via Accio MVR)',
    disclosedFields: { class: 'A' },
    expiresAt,
    validUntil: mvrCtx.mvr.expires_at ?? undefined,
    sourceCra: ACCIO_CRA,
    sourcePullId: mvrCtx.accioOrderNumber,
  }
}

async function provePreviousEmployerVerified(ctx: ProveContext): Promise<FactResult> {
  const employmentId =
    typeof ctx.parameters?.employmentId === 'string' ? ctx.parameters.employmentId : undefined
  const verificationRequestId =
    typeof ctx.parameters?.verificationRequestId === 'string'
      ? ctx.parameters.verificationRequestId
      : undefined

  if (!employmentId && !verificationRequestId) {
    throw new AttestationError(
      'previous_employer_verified requires parameters.employmentId or parameters.verificationRequestId'
    )
  }

  const row = await getEmploymentVerificationForAttestation(
    ctx.supabase,
    ctx.candidateUserId,
    { employmentId, verificationRequestId },
  )

  if (!row?.verified_at) {
    throw new AttestationError('No verified prior-employer response on file')
  }

  const endLabel = row.claimed_end_date ?? 'present'
  const dateRange = `${row.claimed_start_date} – ${endLabel}`

  return {
    factSummary: `Prior employment verified — ${row.previous_employer_name}`,
    disclosedFields: {
      employerName: row.previous_employer_name,
      dateRange,
      responseDate: row.verified_at.slice(0, 10),
    },
    expiresAt: attestationExpiresAt(EMPLOYMENT_ATTESTATION_TTL_MS),
    sourceCra: PRIOR_EMPLOYER_CRA,
    sourcePullId: row.id,
  }
}

const SHIPPED_FACTS: Record<ShippedFactType, FactDefinition> = {
  mvr_clean_36_months: {
    factType: 'mvr_clean_36_months',
    label: 'Clean MVR (36 months)',
    description: 'No moving violations in the last 36 months per Accio MVR',
    category: 'driving',
    source: 'third_party',
    proveImpl: proveMvrClean36Months,
  },
  cdl_class_a: {
    factType: 'cdl_class_a',
    label: 'Class A CDL',
    description: 'Holds a Class A commercial driver license per DMV MVR',
    category: 'license',
    source: 'third_party',
    proveImpl: proveCdlClassA,
  },
  previous_employer_verified: {
    factType: 'previous_employer_verified',
    label: 'Prior employer verified',
    description: 'A previous employer confirmed employment dates and role',
    category: 'employment',
    source: 'third_party',
    proveImpl: provePreviousEmployerVerified,
  },
}

export const FACT_REGISTRY: Record<ShippedFactType, FactDefinition> = SHIPPED_FACTS

export function getFactDefinition(factType: FactType): FactDefinition | undefined {
  return FACT_REGISTRY[factType as ShippedFactType]
}

export function listShippedFacts(): FactDefinition[] {
  return Object.values(FACT_REGISTRY)
}

/**
 * Resolve fact material for signing — called by signed-jwt-attestation-service.
 * Enforces provenance gate before running proveImpl.
 */
export async function resolveAttestationFact(
  input: AttestationInput,
): Promise<ResolvedAttestationFact> {
  const def = getFactDefinition(input.factType)
  if (!def) {
    throw new AttestationError(`Unknown or unsupported fact type: ${input.factType}`)
  }

  enforceProvenanceGate(def)

  const supabase = await getAdminSupabaseClient()
  const result = await def.proveImpl({
    candidateUserId: input.candidateUserId,
    factType: input.factType,
    parameters: input.parameters,
    audienceId: input.audienceId,
    supabase,
  })

  return {
    factSummary: result.factSummary,
    disclosedFields: result.disclosedFields,
    expiresAt: result.expiresAt,
    validUntil: result.validUntil,
    sourceCra: result.sourceCra,
    sourcePullId: result.sourcePullId,
  }
}
