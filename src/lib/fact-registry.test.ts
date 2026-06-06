import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AttestationError } from '@/lib/attestation-service'
import {
  enforceProvenanceGate,
  normalizeAccioCdlClass,
  resolveAttestationFact,
  type FactDefinition,
} from '@/lib/fact-registry'
import type { MvrAttestationContext } from '@/lib/block-data'
import type { MvrRow } from '@/lib/block-data'

vi.mock('@/utils/supabase/admin', () => ({
  getAdminSupabaseClient: vi.fn(async () => ({}) as SupabaseClient),
}))

const getMvrAttestationContext = vi.fn()
const getEmploymentVerificationForAttestation = vi.fn()

vi.mock('@/lib/block-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/block-data')>()
  return {
    ...actual,
    getMvrAttestationContext: (...args: unknown[]) => getMvrAttestationContext(...args),
    getEmploymentVerificationForAttestation: (...args: unknown[]) =>
      getEmploymentVerificationForAttestation(...args),
  }
})

const CANDIDATE_ID = '11111111-1111-1111-1111-111111111111'
const ACCIO_ORDER = 'ACCIO-ORDER-42'

const PII_KEYS = [
  'license_number',
  'licenseNumber',
  'cdl_number',
  'ssn',
  'dateOfBirth',
  'dob',
  'violations',
  'accidents',
  'parsed_data',
  'previous_employer_email',
  'previous_employer_phone',
]

function assertNoPii(disclosed: Record<string, unknown>) {
  for (const key of Object.keys(disclosed)) {
    expect(PII_KEYS).not.toContain(key)
  }
  const serialized = JSON.stringify(disclosed).toLowerCase()
  expect(serialized).not.toMatch(/\d{3}-\d{2}-\d{4}/)
}

function baseMvr(overrides?: Partial<MvrRow>): MvrRow {
  return {
    id: 'mvr-1',
    user_id: CANDIDATE_ID,
    order_id: 'order-1',
    result_id: 'result-1',
    expires_at: '2027-01-01T00:00:00.000Z',
    license_status: 'valid',
    total_points: 0,
    violation_count: 0,
    violations: [],
    accidents: [],
    last_ordered_at: '2026-06-01T00:00:00.000Z',
    last_updated: '2026-06-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function completedMvrCtx(overrides?: Partial<MvrAttestationContext>): MvrAttestationContext {
  return {
    mvr: baseMvr(),
    orderId: 'order-1',
    accioOrderNumber: ACCIO_ORDER,
    orderStatus: 'completed',
    completedAt: '2026-06-01T12:00:00.000Z',
    licenseClass: 'A - CDL COMBINATION',
    ...overrides,
  }
}

describe('fact-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enforceProvenanceGate', () => {
    it('rejects self_reported facts', () => {
      const def: Pick<FactDefinition, 'source' | 'factType'> = {
        factType: 'dot_application_complete',
        source: 'self_reported',
      }
      expect(() => enforceProvenanceGate(def)).toThrow(AttestationError)
      expect(() => enforceProvenanceGate(def)).toThrow(/Provenance gate/)
    })
  })

  describe('normalizeAccioCdlClass', () => {
    it('parses leading class letter from Accio text', () => {
      expect(normalizeAccioCdlClass('A - CDL COMBINATION')).toBe('A')
      expect(normalizeAccioCdlClass('CLASS B')).toBe('B')
    })
  })

  describe('mvr_clean_36_months', () => {
    it('attests when no violations fall in the 36-month window', async () => {
      getMvrAttestationContext.mockResolvedValue(
        completedMvrCtx({
          mvr: baseMvr({
            violations: [{ date: '2020-01-15', violation: 'speeding', state: 'OH' }],
          }),
        }),
      )

      const resolved = await resolveAttestationFact({
        candidateUserId: CANDIDATE_ID,
        factType: 'mvr_clean_36_months',
      })

      expect(resolved.factSummary).toMatch(/clean mvr/i)
      expect(resolved.disclosedFields).toHaveProperty('verificationWindowStart')
      expect(resolved.disclosedFields).toHaveProperty('verificationWindowEnd')
      expect(resolved.disclosedFields).not.toHaveProperty('violations')
      assertNoPii(resolved.disclosedFields)
      expect(resolved.sourceCra).toBe('accio')
      expect(resolved.sourcePullId).toBe(ACCIO_ORDER)
    })

    it('throws when a violation falls inside the window', async () => {
      getMvrAttestationContext.mockResolvedValue(
        completedMvrCtx({
          mvr: baseMvr({
            violations: [{ date: '2026-01-15', violation: 'speeding', state: 'OH' }],
          }),
        }),
      )

      await expect(
        resolveAttestationFact({
          candidateUserId: CANDIDATE_ID,
          factType: 'mvr_clean_36_months',
        }),
      ).rejects.toThrow(/moving violations/i)
    })
  })

  describe('cdl_class_a', () => {
    it('attests Class A from DMV MVR license_class', async () => {
      getMvrAttestationContext.mockResolvedValue(completedMvrCtx())

      const resolved = await resolveAttestationFact({
        candidateUserId: CANDIDATE_ID,
        factType: 'cdl_class_a',
      })

      expect(resolved.disclosedFields).toEqual({ class: 'A' })
      assertNoPii(resolved.disclosedFields)
      expect(resolved.sourceCra).toBe('accio')
      expect(resolved.sourcePullId).toBe(ACCIO_ORDER)
    })

    it('throws when MVR license_class is not Class A', async () => {
      getMvrAttestationContext.mockResolvedValue(
        completedMvrCtx({ licenseClass: 'B - CDL SINGLE' }),
      )

      await expect(
        resolveAttestationFact({
          candidateUserId: CANDIDATE_ID,
          factType: 'cdl_class_a',
        }),
      ).rejects.toThrow(/Class A/i)
    })
  })

  describe('previous_employer_verified', () => {
    it('attests with minimal employer disclosure fields', async () => {
      getEmploymentVerificationForAttestation.mockResolvedValue({
        id: 'evr-99',
        employment_id: 'emp-1',
        previous_employer_name: 'Acme Trucking',
        claimed_position: 'OTR Driver',
        claimed_start_date: '2022-03-01',
        claimed_end_date: '2024-08-15',
        verified_at: '2026-05-20T14:00:00.000Z',
        status: 'VERIFIED',
      })

      const resolved = await resolveAttestationFact({
        candidateUserId: CANDIDATE_ID,
        factType: 'previous_employer_verified',
        parameters: { employmentId: 'emp-1' },
      })

      expect(resolved.disclosedFields).toEqual({
        employerName: 'Acme Trucking',
        dateRange: '2022-03-01 – 2024-08-15',
        responseDate: '2026-05-20',
      })
      assertNoPii(resolved.disclosedFields)
      expect(resolved.sourceCra).toBe('prior_employer')
      expect(resolved.sourcePullId).toBe('evr-99')
    })

    it('throws when no verified employment row exists', async () => {
      getEmploymentVerificationForAttestation.mockResolvedValue(null)

      await expect(
        resolveAttestationFact({
          candidateUserId: CANDIDATE_ID,
          factType: 'previous_employer_verified',
          parameters: { employmentId: 'emp-missing' },
        }),
      ).rejects.toThrow(/verified prior-employer/i)
    })
  })
})
