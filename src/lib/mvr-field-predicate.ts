/**
 * Circuit encodings for dedicated MVR-field Compact contracts.
 * Bit tables and class codes must stay in lockstep with compact/*.compact.
 */

import { dateToYmdInt, parseViolationDate } from '@/lib/mvr-clean-predicate'

/** LSB=0 … Compact `cdl-endorsements.compact`. */
export const CDL_ENDORSEMENT_BITS: Readonly<Record<string, number>> = {
  H: 0,
  N: 1,
  T: 2,
  P: 3,
  S: 4,
  X: 5,
  W: 6,
  M: 7,
}

/** LSB=0 … Compact `cdl-restrictions.compact`. */
export const CDL_RESTRICTION_BITS: Readonly<Record<string, number>> = {
  B: 0,
  C: 1,
  D: 2,
  E: 3,
  F: 4,
  G: 5,
  K: 6,
  L: 7,
  M: 8,
  N: 9,
  O: 10,
  P: 11,
  V: 12,
  X: 13,
  Z: 14,
}

const ENDORSEMENT_WORDS: Array<[RegExp, string]> = [
  [/HAZMAT|HAZARDOUS/, 'H'],
  [/TANK.*HAZ|HAZ.*TANK/, 'X'],
  [/TANK/, 'N'],
  [/SCHOOL/, 'S'],
  [/DOUBLE|TRIPLE/, 'T'],
  [/PASSENGER/, 'P'],
]

export function classLetterToCode(letter: string): number {
  const ch = letter.trim().toUpperCase()
  if (!/^[A-Z]$/.test(ch)) {
    throw new Error(`License class "${letter}" is not a single A–Z letter`)
  }
  return ch.charCodeAt(0)
}

export function normalizeEndorsementLetter(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  if (!t) return null
  if (/^[A-Z]$/.test(t)) return t
  for (const [re, letter] of ENDORSEMENT_WORDS) {
    if (re.test(t)) return letter
  }
  const isolated = t.match(/\b([A-Z])\b/)
  return isolated ? isolated[1] : null
}

export function normalizeRestrictionLetter(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  if (!t) return null
  if (/^[A-Z]$/.test(t)) return t
  const isolated = t.match(/\b([A-Z])\b/)
  return isolated ? isolated[1] : null
}

function maskFromLetters(
  values: string[],
  bits: Readonly<Record<string, number>>,
  normalize: (raw: string) => string | null,
  kind: string,
): number {
  let mask = 0
  for (const raw of values) {
    const letter = normalize(raw)
    if (!letter) {
      throw new Error(`${kind} code "${raw}" is not in the circuit table`)
    }
    const bit = bits[letter]
    if (bit === undefined) {
      throw new Error(`${kind} code "${letter}" is not in the circuit table`)
    }
    mask |= 1 << bit
  }
  return mask
}

export function endorsementMaskFromCodes(codes: string[]): number {
  const mask = maskFromLetters(codes, CDL_ENDORSEMENT_BITS, normalizeEndorsementLetter, 'Endorsement')
  if (mask === 0) {
    throw new Error('Endorsement mask is empty — cannot prove cdl_endorsements')
  }
  return mask
}

/** Empty list → 0 (circuit allows "none"). */
export function restrictionMaskFromCodes(codes: string[]): number {
  if (codes.length === 0) return 0
  return maskFromLetters(codes, CDL_RESTRICTION_BITS, normalizeRestrictionLetter, 'Restriction')
}

export function expirationToYmd(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  const parsed = parseViolationDate(raw)
  if (!parsed) return null
  return dateToYmdInt(parsed)
}
