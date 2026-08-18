import { describe, expect, it } from 'vitest'
import { deriveVerifiedFacts } from '@/components/career-card/VerifiedFactsStrip'
import type { ProjectedCareerCard } from '@/types/career-card'

function baseCard(over: Partial<ProjectedCareerCard> = {}): ProjectedCareerCard {
  return {
    userId: 'u1',
    name: 'Test',
    avatarUrl: null,
    occupation: null,
    professionalSummary: null,
    location: null,
    memberSince: '2026-01-01',
    shareToken: null,
    sections: [],
    settings: { showContact: false, allowConnect: false },
    employerConfirmedEmploymentCount: 0,
    employerConfirmations: [],
    onChainCredentialCount: 0,
    onChainCredentials: [],
    careerCardScore: 0,
    ...over,
  }
}

describe('deriveVerifiedFacts', () => {
  it('keeps Midnight tiles and still shows PSP', () => {
    const facts = deriveVerifiedFacts(
      baseCard({
        attestedFacts: [
          {
            id: 'a1',
            factType: 'cdl_class',
            label: 'Class A',
            provenance: 'Derived from Accio',
            provenOnMidnight: true,
          },
        ],
        sections: [
          {
            blockType: 'driver-psp',
            blockId: 'b1',
            data: {
              orderStatus: 'completed',
              resultOutcome: 'clear',
              completedAt: '2026-08-01T00:00:00.000Z',
            },
          } as ProjectedCareerCard['sections'][number],
        ],
      }),
    )
    expect(facts.some((f) => f.provenOnMidnight && f.label === 'Class A')).toBe(true)
    expect(facts.some((f) => f.id === 'psp')).toBe(true)
  })
})
