import { describe, expect, it, vi } from 'vitest'
import { AttestationError } from '@/lib/attestation-service'
import { accioXmlHasMvrRecord } from '@/lib/accio-get-order-results'
import { isPermanentFactFailure, proveCompletedMvrFacts } from '@/lib/prove-mvr-facts'

describe('accioXmlHasMvrRecord', () => {
  it('rejects a filled status that has no driving record', () => {
    const shell = `<subOrder type="MVR" filledStatus="filled" filledCode="hits" held_for_review="Y"></subOrder>`
    expect(accioXmlHasMvrRecord(shell)).toBe(false)
  })

  it('accepts a license block or the narrative text', () => {
    expect(accioXmlHasMvrRecord('<mvr_license><license_class>D</license_class></mvr_license>')).toBe(
      true,
    )
    expect(accioXmlHasMvrRecord('<text>License Class: D</text>')).toBe(true)
  })
})

describe('proveCompletedMvrFacts', () => {
  it('proves the facts the report can support and skips the rest', async () => {
    const prove = vi.fn(async () => ({ id: 'row' }))
    const resolve = vi.fn(async (input: { factType: string }) => {
      if (input.factType === 'cdl_endorsements' || input.factType === 'med_cert_valid') {
        throw new AttestationError('not on this report')
      }
      return { ok: true }
    })

    const result = await proveCompletedMvrFacts('user-1', { resolve, prove })

    expect(result.proven).toEqual(['cdl_class', 'cdl_restrictions'])
    expect(result.skipped).toEqual(['cdl_endorsements', 'med_cert_valid'])
    expect(result.failed).toEqual([])
    expect(prove).toHaveBeenCalledTimes(2)
  })

  it('does not redo a fact that already settled, and retries a node failure', async () => {
    const prove = vi.fn(async () => {
      throw new Error('The node did not finalize the transaction')
    })
    const resolve = vi.fn(async () => ({ ok: true }))

    const result = await proveCompletedMvrFacts('user-1', {
      resolve,
      prove,
      alreadySettled: ['cdl_class', 'cdl_endorsements', 'cdl_restrictions'],
    })

    expect(result.proven).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.failed).toEqual(['med_cert_valid'])
    expect(prove).toHaveBeenCalledTimes(1)
  })

  it('keeps an on-chain proof with no database row retryable', () => {
    expect(isPermanentFactFailure(new Error("failed assert: pull already proven"))).toBe(false)
    expect(isPermanentFactFailure(new AttestationError('not on this report'))).toBe(true)
    expect(isPermanentFactFailure(new Error('Restriction code "A" is not in the circuit table'))).toBe(true)
  })
})
