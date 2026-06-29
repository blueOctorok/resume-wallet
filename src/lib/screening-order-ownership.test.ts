import { describe, expect, it } from 'vitest'
import {
  isDriverOwnedScreeningOrder,
  resolveScreeningOrderOwnershipFields,
} from '@/lib/screening-order-ownership'

describe('screening-order-ownership', () => {
  it('treats NULL ordered_by_company_id as driver-owned', () => {
    expect(isDriverOwnedScreeningOrder({ ordered_by_company_id: null })).toBe(true)
    expect(isDriverOwnedScreeningOrder({})).toBe(true)
  })

  it('treats company-scoped orders as employer-owned', () => {
    expect(isDriverOwnedScreeningOrder({ ordered_by_company_id: 'company-1' })).toBe(false)
  })

  it('maps driver ownership to NULL company columns', () => {
    expect(
      resolveScreeningOrderOwnershipFields('driver', {
        companyId: 'pace-id',
        employerUserId: 'employer-1',
      }),
    ).toEqual({
      ordered_by_company_id: null,
      ordered_by_user_id: null,
      ordered_by_employer: false,
    })
  })

  it('maps employer ownership to company-scoped columns', () => {
    expect(
      resolveScreeningOrderOwnershipFields('employer', {
        companyId: 'pace-id',
        employerUserId: 'employer-1',
      }),
    ).toEqual({
      ordered_by_company_id: 'pace-id',
      ordered_by_user_id: 'employer-1',
      ordered_by_employer: true,
    })
  })
})
