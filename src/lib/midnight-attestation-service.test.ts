import { describe, expect, it, vi } from 'vitest'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'

describe('midnight-attestation-service', () => {
  it('rejects non-mvr facts in P3.3 slice', async () => {
    const service = createMidnightAttestationService({
      proveOnChain: vi.fn(),
      getSupabase: async () => ({}) as never,
    })

    await expect(
      service.proveFact({
        candidateUserId: 'user-1',
        factType: 'cdl_class_a',
      }),
    ).rejects.toThrow(/only supports mvr_clean_36_months/)
  })

  it('verifyAttestation accepts midnight_zk with txHash', async () => {
    const service = createMidnightAttestationService()
    const result = await service.verifyAttestation({
      id: 'a1',
      factType: 'mvr_clean_36_months',
      factSummary: 'Clean MVR',
      disclosedFields: {},
      issuedAt: new Date().toISOString(),
      proof: { kind: 'midnight_zk', txHash: 'tx-abc', proofId: 'tx-abc' },
    })

    expect(result.valid).toBe(true)
    expect(result.issuer).toBe('storm-midnight')
  })
})
