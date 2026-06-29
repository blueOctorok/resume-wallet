import { describe, expect, it } from 'vitest'
import {
  isEmployerScreeningConsentRequest,
  isPendingEmployerScreeningConsentRow,
} from '@/lib/pending-employer-screening'

describe('isEmployerScreeningConsentRequest', () => {
  it('accepts mvr_order and psp_order', () => {
    expect(isEmployerScreeningConsentRequest({ request_type: 'mvr_order', target_block_type: 'driver-screening-consent' })).toBe(true)
    expect(isEmployerScreeningConsentRequest({ request_type: 'psp_order', target_block_type: 'driver-screening-consent' })).toBe(true)
  })

  it('accepts block_request targeting screening blocks', () => {
    expect(isEmployerScreeningConsentRequest({ request_type: 'block_request', target_block_type: 'driver-screening-consent' })).toBe(true)
    expect(isEmployerScreeningConsentRequest({ request_type: 'block_request', target_block_type: 'driver-mvr' })).toBe(true)
  })

  it('rejects unrelated requests', () => {
    expect(isEmployerScreeningConsentRequest({ request_type: 'block_request', target_block_type: 'general-resume' })).toBe(false)
    expect(isEmployerScreeningConsentRequest({ request_type: 'document_request', target_block_type: null })).toBe(false)
  })
})

describe('isPendingEmployerScreeningConsentRow', () => {
  it('requires pending status', () => {
    expect(
      isPendingEmployerScreeningConsentRow({
        id: '1',
        request_type: 'mvr_order',
        target_block_type: 'driver-screening-consent',
        status: 'completed',
        created_at: new Date().toISOString(),
      }),
    ).toBe(false)
  })
})
