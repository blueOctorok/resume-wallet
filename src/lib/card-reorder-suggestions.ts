import type { CareerCardSection, SectionBlockType } from '@/types/career-card'
import type { JobFitResult } from '@/lib/job-fit'

const BURIED_INDEX = 2 /** 0-based — sections at index 3+ are "buried" for job-first scan */

export interface ReorderSuggestion {
  /** Human-readable reason for Stormi copy */
  reason: string
  /** Block types in suggested hub order (first = top of card after resume). */
  suggestedBlockTypes: string[]
}

/**
 * Deterministic: if the job clearly cares about blocks that are installed but
 * sit on page 2+ or deep in the list, suggest pulling them up for this role.
 */
export function computeReorderSuggestion(
  sections: CareerCardSection[],
  fit: JobFitResult,
): ReorderSuggestion | null {
  if (sections.length < 3) return null

  const byType = new Map(sections.map((s) => [s.blockType, s]))
  const order = sections.map((s) => s.blockType)

  const buriedMatched: { blockId: string; label: string; depth: number }[] = []

  for (const m of fit.matchedRequirements) {
    if (m.kind !== 'block' || !m.blockId) continue
    if (m.blockId === 'storm-resume') continue
    const idx = order.indexOf(m.blockId as SectionBlockType)
    if (idx < 0) continue
    const sec = byType.get(m.blockId as SectionBlockType)
    const page = sec?.cardPage ?? 1
    const buried = page > 1 || idx > BURIED_INDEX
    if (buried) {
      buriedMatched.push({ blockId: m.blockId, label: m.label, depth: idx + page * 10 })
    }
  }

  if (buriedMatched.length === 0) return null

  buriedMatched.sort((a, b) => b.depth - a.depth)

  const pullUp = buriedMatched.map((b) => b.blockId)
  const primary = pullUp[0]
  const primaryLabel = buriedMatched.find((b) => b.blockId === primary)?.label ?? 'this credential'

  const rest = order.filter((t) => t !== 'storm-resume' && !pullUp.includes(t))
  const suggestedBlockTypes = ['storm-resume', ...pullUp, ...rest]

  return {
    reason: `This job cares about ${primaryLabel.toLowerCase()} — it’s easier for recruiters if it’s near the top of page 1.`,
    suggestedBlockTypes,
  }
}
