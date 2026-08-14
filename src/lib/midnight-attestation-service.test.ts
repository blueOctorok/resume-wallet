import { describe, expect, it, vi } from 'vitest'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'

describe('midnight-attestation-service', () => {
  it('rejects unknown fact types', async () => {
    const service = createMidnightAttestationService({
      proveOnChain: vi.fn(),
      getSupabase: async () => ({}) as never,
    })

    await expect(
      service.proveFact({
        candidateUserId: 'user-1',
        factType: 'mvr_no_dui_ever',
      }),
    ).rejects.toThrow(/does not support/)
  })

  it('rejects example facts that are no longer Midnight-shipped', async () => {
    const service = createMidnightAttestationService({
      proveOnChain: vi.fn(),
      getSupabase: async () => ({}) as never,
    })

    await expect(
      service.proveFact({
        candidateUserId: 'user-1',
        factType: 'mvr_clean_36_months',
      }),
    ).rejects.toThrow(/does not support/)
  })

  it('verifyAttestation accepts midnight_zk with txHash', async () => {
    const service = createMidnightAttestationService()
    const result = await service.verifyAttestation({
      id: 'a1',
      factType: 'cdl_class',
      factSummary: 'License class A',
      disclosedFields: {},
      issuedAt: new Date().toISOString(),
      proof: {
        kind: 'midnight_zk',
        txHash: 'tx-abc',
        proofId: 'tx-abc',
        provenanceTier: 'metadata',
      },
    })

    expect(result.valid).toBe(true)
    expect(result.issuer).toBe('storm-midnight')
  })
})
