import {
  normalizeEndorsementLetter,
  normalizeRestrictionLetter,
} from '@/lib/mvr-field-predicate'

const ENDORSEMENT_SHORT: Record<string, string> = {
  H: 'Hazmat',
  N: 'Tanker',
  T: 'Doubles',
  P: 'Passenger',
  S: 'School bus',
  X: 'Hazmat + Tank',
  W: 'Tanker',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Compact circuit ran for this fact — the shipping Midnight claim (DEC-2026-08-004). */
export function isMidnightPredicateProof(proof: unknown): boolean {
  if (!proof || typeof proof !== 'object') return false
  const row = proof as { kind?: unknown; predicateEnforced?: unknown }
  return row.kind === 'midnight_zk' && row.predicateEnforced === true
}

function endorsementHeadline(raw: string): string {
  const parts = raw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const names: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const letter = normalizeEndorsementLetter(part)
    if (!letter || seen.has(letter)) continue
    seen.add(letter)
    names.push(ENDORSEMENT_SHORT[letter] ?? letter)
  }
  if (names.length === 0) return raw.trim() || 'Endorsements'
  if (names.length <= 2) return names.join(' · ')
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
}

function medHeadline(expiration: string): string {
  const d = new Date(expiration)
  if (Number.isNaN(d.getTime())) return 'Med card current'
  const when = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `Med · ${when}`
}

/** Fact-first label for the career card seal and resume chips. */
export function formatCardFactLabel(
  factType: string,
  disclosed: unknown,
  fallback: string,
): string {
  const fields = asRecord(disclosed)

  if (factType === 'cdl_class' || factType === 'cdl_class_a') {
    const letter = String(fields.class ?? '').trim().toUpperCase()
    return letter ? `Class ${letter}` : fallback || 'License class'
  }

  if (factType === 'cdl_endorsements') {
    const raw = String(fields.endorsements ?? '').trim()
    return endorsementHeadline(raw)
  }

  if (factType === 'cdl_restrictions') {
    const raw = String(fields.restrictions ?? '').trim().toLowerCase()
    if (!raw || raw === 'none') return 'No restrictions'
    const letters = raw
      .split(/[,|]/)
      .map((s) => normalizeRestrictionLetter(s.trim()))
      .filter((l): l is string => Boolean(l))
    return letters.length > 0 ? `Restricted (${letters.join('')})` : 'Restricted'
  }

  if (factType === 'med_cert_valid') {
    const expiration = String(fields.expiration ?? '').trim()
    return expiration ? medHeadline(expiration) : 'Med card current'
  }

  if (factType === 'previous_employer_verified') {
    const name = String(fields.employerName ?? '').trim()
    return name || fallback || 'Employer confirmed'
  }

  return fallback
}
