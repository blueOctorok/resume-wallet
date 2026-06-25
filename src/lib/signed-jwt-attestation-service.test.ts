import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import type { AttestationInput } from '@/lib/attestation-service'
import { createSignedJwtAttestationService } from '@/lib/signed-jwt-attestation-service'

const TEST_SECRET = 'test-attestation-secret-min-32-chars!!'
const TEST_ISSUER = 'storm-test'
const CANDIDATE_ID = '11111111-1111-1111-1111-111111111111'

function makeSupabaseMock() {
  const priorRows: { id: string }[] = []
  const insertedRows: Record<string, unknown>[] = []
  const queryCounts = new Map<string, number>()

  const buildSelectChain = () => {
    const chain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        return { data: { query_count: queryCounts.get('row') ?? 0 }, error: null }
      }),
      single: vi.fn().mockImplementation(async () => {
        const last = insertedRows[insertedRows.length - 1]
        return { data: last, error: null }
      }),
      then: undefined as unknown,
    }

    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      resolve({ data: priorRows, error: null })
      return Promise.resolve({ data: priorRows, error: null })
    }) as unknown as typeof chain.then

    return chain
  }

  const from = vi.fn((table: string) => {
    if (table === 'disclosure_preferences') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      }
    }
    if (table !== 'attestations') {
      throw new Error(`Unexpected table: ${table}`)
    }

    return {
      select: vi.fn(() => buildSelectChain()),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn((row: Record<string, unknown>) => ({
        select: vi.fn(() => ({
          single: vi.fn().mockImplementation(async () => {
            const stored = {
              id: row.id,
              fact_type: row.fact_type,
              fact_summary: row.fact_summary,
              disclosed_fields: row.disclosed_fields,
              issued_at: row.issued_at,
              expires_at: row.expires_at,
              proof_artifact: row.proof_artifact,
            }
            insertedRows.push(stored)
            queryCounts.set(String(row.id), 0)
            return { data: stored, error: null }
          }),
        })),
      })),
    }
  })

  return {
    client: { from } as unknown as SupabaseClient,
    insertedRows,
    priorRows,
    queryCounts,
  }
}

const sampleInput: AttestationInput = {
  candidateUserId: CANDIDATE_ID,
  factType: 'mvr_clean_36_months',
  audienceId: '22222222-2222-2222-2222-222222222222',
}

describe('createSignedJwtAttestationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prove → verify round-trip succeeds', async () => {
    const { client } = makeSupabaseMock()
    const service = createSignedJwtAttestationService({
      jwtSecret: TEST_SECRET,
      issuer: TEST_ISSUER,
      getSupabase: async () => client,
      resolveFact: async () => ({
        factSummary: 'Clean MVR — no moving violations in 36 months',
        disclosedFields: {
          verificationWindowStart: '2023-06-01',
          verificationWindowEnd: '2026-06-01',
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        sourceCra: 'accio',
        sourcePullId: 'order-123',
      }),
    })

    const attestation = await service.proveFact(sampleInput)
    expect(attestation.proof.kind).toBe('signed_jwt')
    expect(attestation.proof.issuer).toBe(TEST_ISSUER)

    const result = await service.verifyAttestation(attestation)
    expect(result.valid).toBe(true)
    expect(result.disclosedFields).toMatchObject({
      verificationWindowStart: '2023-06-01',
      verificationWindowEnd: '2026-06-01',
    })
    expect(result.issuer).toBe(TEST_ISSUER)
  })

  it('rejects a tampered JWT', async () => {
    const { client } = makeSupabaseMock()
    const service = createSignedJwtAttestationService({
      jwtSecret: TEST_SECRET,
      issuer: TEST_ISSUER,
      getSupabase: async () => client,
      resolveFact: async () => ({
        factSummary: 'CDL Class A',
        disclosedFields: { class: 'A' },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    })

    const attestation = await service.proveFact({
      candidateUserId: CANDIDATE_ID,
      factType: 'cdl_class_a',
    })

    const tampered = {
      ...attestation,
      proof: {
        ...attestation.proof,
        jwt: `${attestation.proof.jwt}x`,
      },
    }

    const result = await service.verifyAttestation(tampered)
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('rejects an expired JWT', async () => {
    const secretBytes = new TextEncoder().encode(TEST_SECRET)
    const attestationId = '33333333-3333-3333-3333-333333333333'
    const issuedAt = new Date(Date.now() - 7200000).toISOString()

    const expiredJwt = await new SignJWT({
      attId: attestationId,
      candidateUserId: CANDIDATE_ID,
      factType: 'cdl_class_a',
      factSummary: 'CDL Class A',
      disclosedFields: { class: 'A' },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(TEST_ISSUER)
      .setSubject(CANDIDATE_ID)
      .setJti(attestationId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secretBytes)

    const { client } = makeSupabaseMock()
    const service = createSignedJwtAttestationService({
      jwtSecret: TEST_SECRET,
      issuer: TEST_ISSUER,
      getSupabase: async () => client,
      resolveFact: async () => ({
        factSummary: 'unused',
        disclosedFields: {},
      }),
    })

    const result = await service.verifyAttestation({
      id: attestationId,
      factType: 'cdl_class_a',
      factSummary: 'CDL Class A',
      disclosedFields: { class: 'A' },
      issuedAt,
      proof: { kind: 'signed_jwt', jwt: expiredJwt, issuer: TEST_ISSUER },
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/exp/i)
  })

  it('rejects prove when disclosure toggled off for audience', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'disclosure_preferences') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { allowed: false }, error: null }),
          })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const service = createSignedJwtAttestationService({
      jwtSecret: TEST_SECRET,
      issuer: TEST_ISSUER,
      getSupabase: async () => ({ from }) as unknown as SupabaseClient,
      resolveFact: async () => ({
        factSummary: 'unused',
        disclosedFields: {},
      }),
    })

    await expect(service.proveFact(sampleInput)).rejects.toThrow(/not shared/)
  })
})
