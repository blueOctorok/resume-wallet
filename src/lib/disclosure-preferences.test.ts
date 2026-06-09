import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttestationInput } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import {
  assertDisclosureAllowsProve,
  isFactDisclosedToAudience,
  loadDisclosureDenylistForAudience,
} from '@/lib/disclosure-preferences'

const CANDIDATE_ID = '11111111-1111-1111-1111-111111111111'
const AUDIENCE_ID = '22222222-2222-2222-2222-222222222222'

function makePrefsMock(prefs: { allowed: boolean } | null) {
  const from = vi.fn((table: string) => {
    if (table !== 'disclosure_preferences') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: prefs, error: null }),
      })),
    }
  })
  return { from } as unknown as SupabaseClient
}

describe('disclosure-preferences', () => {
  it('defaults to allowed when no preference row exists', async () => {
    const supabase = makePrefsMock(null)
    await expect(
      isFactDisclosedToAudience(supabase, CANDIDATE_ID, AUDIENCE_ID, 'cdl_class_a'),
    ).resolves.toBe(true)
  })

  it('returns false when allowed=false row exists', async () => {
    const supabase = makePrefsMock({ allowed: false })
    await expect(
      isFactDisclosedToAudience(supabase, CANDIDATE_ID, AUDIENCE_ID, 'cdl_class_a'),
    ).resolves.toBe(false)
  })

  it('assertDisclosureAllowsProve throws when toggled off for audience', async () => {
    const supabase = makePrefsMock({ allowed: false })
    const input: AttestationInput = {
      candidateUserId: CANDIDATE_ID,
      factType: 'mvr_clean_36_months',
      audienceId: AUDIENCE_ID,
    }

    await expect(assertDisclosureAllowsProve(supabase, input)).rejects.toBeInstanceOf(
      AttestationError,
    )
  })

  it('assertDisclosureAllowsProve skips check when audienceId omitted', async () => {
    const supabase = makePrefsMock({ allowed: false })
    const input: AttestationInput = {
      candidateUserId: CANDIDATE_ID,
      factType: 'mvr_clean_36_months',
    }

    await expect(assertDisclosureAllowsProve(supabase, input)).resolves.toBeUndefined()
  })

  it('loadDisclosureDenylistForAudience returns fact types with allowed=false', async () => {
    const eqMock = vi.fn()
    eqMock.mockReturnValueOnce({ eq: eqMock })
    eqMock.mockReturnValueOnce({ eq: eqMock })
    eqMock.mockResolvedValueOnce({
      data: [{ fact_type: 'cdl_class_a' }, { fact_type: 'mvr_clean_36_months' }],
      error: null,
    })

    const from = vi.fn((table: string) => {
      if (table !== 'disclosure_preferences') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select: vi.fn(() => ({
          eq: eqMock,
        })),
      }
    })

    const supabase = { from } as unknown as SupabaseClient
    const denylist = await loadDisclosureDenylistForAudience(
      supabase,
      CANDIDATE_ID,
      AUDIENCE_ID,
    )
    expect(denylist.has('cdl_class_a')).toBe(true)
    expect(denylist.has('mvr_clean_36_months')).toBe(true)
    expect(denylist.has('previous_employer_verified')).toBe(false)
  })
})
