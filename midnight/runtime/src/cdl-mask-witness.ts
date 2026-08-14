/** Shared witness for endorsement / restriction bitmask circuits. */
export type CdlMaskPrivateState = unknown

export interface CdlMaskWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: CdlMaskPrivateState
  readonly contractAddress: unknown
}

export interface CdlEndorsementCircuitWitness {
  endorsementMask: (context: CdlMaskWitnessContext) => [CdlMaskPrivateState, bigint]
}

export interface CdlRestrictionCircuitWitness {
  restrictionMask: (context: CdlMaskWitnessContext) => [CdlMaskPrivateState, bigint]
}

export function createCdlEndorsementCircuitWitness(mask: number): CdlEndorsementCircuitWitness {
  const value = BigInt(mask)
  return {
    endorsementMask: (context) => [context.privateState, value],
  }
}

export function createCdlRestrictionCircuitWitness(mask: number): CdlRestrictionCircuitWitness {
  const value = BigInt(mask)
  return {
    restrictionMask: (context) => [context.privateState, value],
  }
}

export function createEmptyCdlEndorsementWitness(): CdlEndorsementCircuitWitness {
  return createCdlEndorsementCircuitWitness(0)
}

export function createEmptyCdlRestrictionWitness(): CdlRestrictionCircuitWitness {
  return createCdlRestrictionCircuitWitness(0)
}
