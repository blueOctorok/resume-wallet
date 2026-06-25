/** Fixed violation slot shape — must match `ViolationEntry` in mvr-clean-36.compact. */
export interface MvrCleanViolationSlot {
  dateYmd: number
  active: boolean
}

export const MVR_CLEAN_MAX_VIOLATION_SLOTS = 32

/** WitnessContext.privateState — opaque; pass through unchanged for stateless witnesses. */
export type MvrCleanPrivateState = unknown

export interface MvrCleanWitnessContext {
  readonly ledger: { readonly factCommitment: string }
  readonly privateState: MvrCleanPrivateState
  readonly contractAddress: unknown
}

export interface MvrCleanViolationEntry {
  dateYmd: bigint
  active: boolean
}

/**
 * Shape required by the compiled Compact contract — see
 * `managed/mvr-clean-36/contract/index.js` `_violationAt_0`.
 */
export interface MvrCleanCircuitWitness {
  violationAt: (
    context: MvrCleanWitnessContext,
    index: bigint,
  ) => [MvrCleanPrivateState, MvrCleanViolationEntry]
}

/** Build Compact witness callbacks from fixed violation slots. */
export function createMvrCleanCircuitWitness(
  slots: readonly MvrCleanViolationSlot[],
): MvrCleanCircuitWitness {
  if (slots.length !== MVR_CLEAN_MAX_VIOLATION_SLOTS) {
    throw new Error(
      `Expected ${MVR_CLEAN_MAX_VIOLATION_SLOTS} violation slots, got ${slots.length}`,
    )
  }

  return {
    violationAt: (context, index) => {
      const slot = slots[Number(index)]
      if (!slot) {
        throw new Error(`violationAt index out of range: ${index}`)
      }
      // Stateless witness — private state is unchanged; only the entry is new data.
      return [
        context.privateState,
        {
          dateYmd: BigInt(slot.dateYmd),
          active: slot.active,
        },
      ]
    },
  }
}
