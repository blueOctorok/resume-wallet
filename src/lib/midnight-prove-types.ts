import type { MvrCleanViolationSlot } from '@/lib/mvr-clean-predicate'
import type { ShippedFactType } from '@/lib/fact-registry'

export interface MidnightOnChainProveBase {
  candidateUserId: string
  factType: ShippedFactType
  sourceCra: string
  sourcePullId: string
  asOfDateYmd: number
  disclosedFields: Record<string, unknown>
}

export interface MidnightMvrOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'mvr_clean_36_months'
  windowStartYmd: number
  windowEndYmd: number
  violationSlots: MvrCleanViolationSlot[]
}

export interface MidnightCdlClassAOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'cdl_class_a'
  holdsClassA: boolean
}

export interface MidnightCdlClassOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'cdl_class'
  classCode: number
}

export interface MidnightCdlMaskOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'cdl_endorsements' | 'cdl_restrictions'
  mask: number
}

export interface MidnightMedCertOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'med_cert_valid'
  expirationYmd: number
}

export interface MidnightEmployerVerifiedOnChainProveInput extends MidnightOnChainProveBase {
  factType: 'previous_employer_verified'
  employerVerified: boolean
}

export type MidnightOnChainProveInput =
  | MidnightMvrOnChainProveInput
  | MidnightCdlClassAOnChainProveInput
  | MidnightCdlClassOnChainProveInput
  | MidnightCdlMaskOnChainProveInput
  | MidnightMedCertOnChainProveInput
  | MidnightEmployerVerifiedOnChainProveInput

export interface MidnightOnChainProveResult {
  txHash: string
  proofId: string
  commitment: string
  contractAddress: string
  predicateVersion?: string
  pullNullifier?: string
  asOfDateYmd?: number
  /** True when Compact enforces this fact's predicate (not a dummy boolean). */
  predicateEnforced?: boolean
  paidFees?: string
  estimatedFees?: string
}
