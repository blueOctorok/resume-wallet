export type MedCertPrivateState = unknown

export interface MedCertWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: MedCertPrivateState
  readonly contractAddress: unknown
}

export interface MedCertCircuitWitness {
  medCertExpirationYmd: (context: MedCertWitnessContext) => [MedCertPrivateState, bigint]
}

export function createMedCertCircuitWitness(expirationYmd: number): MedCertCircuitWitness {
  const ymd = BigInt(expirationYmd)
  return {
    medCertExpirationYmd: (context) => [context.privateState, ymd],
  }
}

export function createEmptyMedCertWitness(): MedCertCircuitWitness {
  return createMedCertCircuitWitness(0)
}
