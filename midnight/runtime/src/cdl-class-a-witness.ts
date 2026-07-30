/** WitnessContext.privateState — opaque; pass through unchanged for stateless witnesses. */
export type CdlClassAPrivateState = unknown

export interface CdlClassAWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: CdlClassAPrivateState
  readonly contractAddress: unknown
}

export interface CdlClassACircuitWitness {
  holdsClassA: (context: CdlClassAWitnessContext) => [CdlClassAPrivateState, boolean]
}

export function createCdlClassACircuitWitness(holdsClassA: boolean): CdlClassACircuitWitness {
  return {
    holdsClassA: (context) => [context.privateState, holdsClassA],
  }
}

export function createEmptyCdlClassAWitness(): CdlClassACircuitWitness {
  return createCdlClassACircuitWitness(false)
}
