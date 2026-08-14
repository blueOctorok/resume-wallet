/** WitnessContext.privateState — opaque; pass through unchanged for stateless witnesses. */
export type CdlClassPrivateState = unknown

export interface CdlClassWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: CdlClassPrivateState
  readonly contractAddress: unknown
}

export interface CdlClassCircuitWitness {
  licenseClassCode: (context: CdlClassWitnessContext) => [CdlClassPrivateState, bigint]
}

export function createCdlClassCircuitWitness(classCode: number): CdlClassCircuitWitness {
  const code = BigInt(classCode)
  return {
    licenseClassCode: (context) => [context.privateState, code],
  }
}

export function createEmptyCdlClassWitness(): CdlClassCircuitWitness {
  return createCdlClassCircuitWitness(0)
}
