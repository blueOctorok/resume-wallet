/**
 * Which completed MVR should the Midnight worker prove next.
 * A driver with a predicate proof is done. A driver still cooling down
 * failed recently and is skipped until the timer lifts.
 */

export interface ProofQueueOrder {
  userId: string
  completedAt: string
  licenseClass: string | null
}

export function nextUnprovedDriver(
  orders: ProofQueueOrder[],
  alreadyProved: ReadonlySet<string>,
  coolingDown: ReadonlySet<string>,
): string | null {
  const seen = new Set<string>()
  const newestFirst = [...orders].sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  for (const order of newestFirst) {
    const userId = order.userId.trim()
    if (!userId || seen.has(userId)) continue
    seen.add(userId)
    if (!order.licenseClass?.trim()) continue
    if (alreadyProved.has(userId)) continue
    if (coolingDown.has(userId)) continue
    return userId
  }

  return null
}
