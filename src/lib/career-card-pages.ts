import type { CareerCardSection } from '@/types/career-card'
import { CARD_PAGE_MAX } from '@/lib/hub-block-config'

/** Group sections by `cardPage` (1..CARD_PAGE_MAX). Pages sorted ascending; empty pages omitted. */
export function groupSectionsByCardPage(sections: CareerCardSection[]): CareerCardSection[][] {
  const map = new Map<number, CareerCardSection[]>()
  for (const s of sections) {
    const p = Math.min(CARD_PAGE_MAX, Math.max(1, s.cardPage ?? 1))
    if (!map.has(p)) map.set(p, [])
    map.get(p)!.push(s)
  }
  const keys = [...map.keys()].sort((a, b) => a - b)
  return keys.map((k) => map.get(k)!)
}

export function maxCardPageFromSections(sections: CareerCardSection[]): number {
  let m = 1
  for (const s of sections) {
    m = Math.max(m, Math.min(CARD_PAGE_MAX, Math.max(1, s.cardPage ?? 1)))
  }
  return m
}
