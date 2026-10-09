import { parseDateToNumber } from '@/lib/month-year'

export type HistoryGroup = 'employment' | 'drivingSchool' | 'unemployment' | 'military'

const GROUP_ORDER: HistoryGroup[] = ['employment', 'drivingSchool', 'unemployment', 'military']

type DatedEntry = {
  type?: string
  isUnemployment?: boolean
  fromDate?: string
  toDate?: string
}

/** Which Section 3 block an entry belongs in. Legacy rows with no type are employment. */
export function historyGroupOf(entry: DatedEntry): HistoryGroup {
  const type = entry.type || (entry.isUnemployment ? 'unemployment' : 'employment')
  if (type === 'school' || type === 'drivingSchool') return 'drivingSchool'
  if (type === 'unemployment' || type === 'military') return type
  return 'employment'
}

/**
 * Newest end date first. "Present" is this month, so a current job lands on top.
 * An entry with no parseable date sorts last — a blank card the driver just added
 * stays at the bottom until they pick a month. Equal dates keep the earlier entry
 * (Array.sort is stable).
 */
export function compareHistoryByRecency(a: DatedEntry, b: DatedEntry): number {
  const aEnd = parseDateToNumber(a.toDate || '') ?? parseDateToNumber(a.fromDate || '')
  const bEnd = parseDateToNumber(b.toDate || '') ?? parseDateToNumber(b.fromDate || '')
  if (aEnd == null && bEnd == null) return 0
  if (aEnd == null) return 1
  if (bEnd == null) return -1
  if (aEnd !== bEnd) return bEnd - aEnd
  const aStart = parseDateToNumber(a.fromDate || '') ?? 0
  const bStart = parseDateToNumber(b.fromDate || '') ?? 0
  return bStart - aStart
}

/**
 * Section order stays Employment → CDL/School → Unemployment → Military.
 * Within a section, entries run most-recent to oldest.
 */
export function orderHistoryEntries<T extends DatedEntry>(entries: T[]): T[] {
  const buckets = new Map<HistoryGroup, T[]>()
  for (const entry of entries) {
    const group = historyGroupOf(entry)
    const list = buckets.get(group)
    if (list) list.push(entry)
    else buckets.set(group, [entry])
  }

  const ordered: T[] = []
  for (const group of GROUP_ORDER) {
    const list = buckets.get(group)
    if (!list?.length) continue
    ordered.push(...[...list].sort(compareHistoryByRecency))
  }
  return ordered
}
