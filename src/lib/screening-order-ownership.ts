/**
 * Screening order ownership — who is the consumer of record on an Accio pull.
 *
 * Build assumption (DEC-2026-06-005, pending FCRA counsel):
 *   driver-owned  → ordered_by_company_id IS NULL (driver initiated; portable)
 *   employer-owned → ordered_by_company_id = company (private to that company)
 *
 * Pace (or any agency) may sponsor payment; ownership follows who clicks order.
 */

export type ScreeningOrderOwnership = 'driver' | 'employer'

export function isDriverOwnedScreeningOrder(order: {
  ordered_by_company_id?: string | null
}): boolean {
  return order.ordered_by_company_id == null
}

export interface ScreeningOrderOwnershipFields {
  ordered_by_company_id: string | null
  ordered_by_user_id: string | null
  ordered_by_employer: boolean
}

/** Map product ownership model to mvr_orders / psp_orders columns. */
export function resolveScreeningOrderOwnershipFields(
  ownership: ScreeningOrderOwnership,
  employer: { companyId: string; employerUserId: string | null },
): ScreeningOrderOwnershipFields {
  if (ownership === 'driver') {
    return {
      ordered_by_company_id: null,
      ordered_by_user_id: null,
      ordered_by_employer: false,
    }
  }

  return {
    ordered_by_company_id: employer.companyId,
    ordered_by_user_id: employer.employerUserId,
    ordered_by_employer: true,
  }
}
