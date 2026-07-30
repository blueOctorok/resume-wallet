/** WitnessContext.privateState — opaque; pass through unchanged for stateless witnesses. */
export type PreviousEmployerVerifiedPrivateState = unknown

export interface PreviousEmployerVerifiedWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: PreviousEmployerVerifiedPrivateState
  readonly contractAddress: unknown
}

export interface PreviousEmployerVerifiedCircuitWitness {
  employerVerified: (
    context: PreviousEmployerVerifiedWitnessContext,
  ) => [PreviousEmployerVerifiedPrivateState, boolean]
}

export function createPreviousEmployerVerifiedCircuitWitness(
  verified: boolean,
): PreviousEmployerVerifiedCircuitWitness {
  return {
    employerVerified: (context) => [context.privateState, verified],
  }
}

export function createEmptyPreviousEmployerVerifiedWitness(): PreviousEmployerVerifiedCircuitWitness {
  return createPreviousEmployerVerifiedCircuitWitness(false)
}
