/**
 * One reading of the CDL date on file. The resume and the keep-current
 * notices both use this, so a packet and a text cannot disagree about
 * whether the license is current.
 */

export interface CdlFreshness {
  /** "A", "B", or "C" when the stored class is recognizable. */
  classLetter: string | null
  /** "Class A" */
  classLabel: string | null
  /** YYYY-MM-DD from the stored expiration, or null when it is not a date. */
  expirationDay: string | null
  /** "January 15, 2026" */
  expirationLabel: string | null
  expired: boolean
  /** "hazmat and tanker" — these ride on the CDL, they do not have their own date. */
  endorsementPhrase: string | null
}

function todayInUs(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
}

export function cdlClassLetter(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const cleaned = raw.trim().toUpperCase().replace(/^CLASS\s+/, '').replace(/^CDL[-\s]*/, '')
  const letter = cleaned.match(/[ABC]/)?.[0]
  return letter ?? null
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function longDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function endorsementPhrase(raw: string[] | null | undefined): string | null {
  let hazmat = false
  let tanker = false
  for (const item of raw ?? []) {
    const lower = item.trim().toLowerCase()
    if (!lower) continue
    if (lower === 'h' || lower.includes('hazmat') || lower.includes('hazardous')) hazmat = true
    if (lower === 'n' || lower.includes('tanker') || lower.includes('tank')) tanker = true
  }
  if (hazmat && tanker) return 'hazmat and tanker'
  if (hazmat) return 'hazmat'
  if (tanker) return 'tanker'
  return null
}

export function readCdlFreshness(
  input: {
    cdlClass?: string | null
    expiration?: string | null
    endorsements?: string[] | null
  },
  now: Date = new Date(),
): CdlFreshness {
  const classLetter = cdlClassLetter(input.cdlClass)
  const expirationDay = dateOnly(input.expiration)
  const today = todayInUs(now)
  return {
    classLetter,
    classLabel: classLetter ? `Class ${classLetter}` : null,
    expirationDay,
    expirationLabel: expirationDay ? longDate(expirationDay) : null,
    expired: Boolean(expirationDay && expirationDay < today),
    endorsementPhrase: endorsementPhrase(input.endorsements),
  }
}

/** Sentence for the resume banner and the "come update this" note. */
export function cdlStaleSentence(freshness: CdlFreshness): string | null {
  if (!freshness.expired || !freshness.expirationLabel) return null
  const license = freshness.classLabel ? `${freshness.classLabel} CDL` : 'CDL'
  const endorsements = freshness.endorsementPhrase
    ? ` ${freshness.endorsementPhrase.charAt(0).toUpperCase()}${freshness.endorsementPhrase.slice(1)} sit on that license.`
    : ''
  return `The ${license} date on this resume is ${freshness.expirationLabel}.${endorsements} Update it so employers see a current license.`
}
