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

/**
 * Federal wording Accio stores under a state code. The letter is the circuit
 * bit, not the state prefix: "A-CORRECTIVE LENS" is federal B.
 * Longer phrases are listed first only where a shorter one would also match.
 */
const RESTRICTION_PHRASES: Array<[RegExp, string]> = [
  [/NO\s+FULL\s+AIR\s*BRAKES?/, 'Z'],
  [/NO\s+AIR\s*BRAKES?/, 'L'],
  [/NO\s+CLASS\s+A\s+AND\s+B\s+PASS(?:ENGER)?\.?/, 'N'],
  [/NO\s+CLASS\s+A\s+PASS(?:ENGER)?\.?/, 'M'],
  [
    /NO\s+MANUAL\s+TRANS(?:MISSION)?(?:\s+EQUIPPED)?(?:\s+(?:CMV|COMMERCIAL\s+VEHICLE))?|AUTO(?:MATIC)?\s+TRANS(?:MISSION)?(?:\s+(?:CMV|ONLY|COMMERCIAL\s+VEHICLE))?/,
    'E',
  ],
  [/CORR(?:ECTIVE)?\s+LENS(?:ES)?/, 'B'],
  [/INTRASTATE\s+ONLY/, 'K'],
  [/OUTSIDE\s+(?:REAR\s+)?MIRROR/, 'F'],
  [/DAYLIGHT/, 'G'],
  [/MECHANICAL\s+AID/, 'C'],
  [/PROSTHETIC/, 'D'],
  [/TRACTOR-?\s*TRAILER|NO\s+TRACTOR/, 'O'],
  [/MEDICAL\s+VARIANCE/, 'V'],
]

/** Words left over after a phrase that are not another restriction. */
const RESTRICTION_FILLER = new Set([
  'CDL',
  'ONLY',
  'REQUIRED',
  'CMV',
  'EQUIPPED',
  'COMMERCIAL',
  'VEHICLE',
  'VEH',
  'GLASSES',
  'CONTACTS',
  'BUS',
  'WITH',
  'FOR',
  'THE',
])

function restrictionPieces(raw: string): string[] {
  return raw
    .split(/[|;\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * One Accio piece → the federal letters it states.
 * `[]` means this piece is "none". `null` means the circuit cannot say it.
 */
function lettersFromRestrictionPiece(piece: string): string[] | null {
  const original = piece.trim().toUpperCase().replace(/\s+/g, ' ')
  if (!original) return []
  if (/^[A-Z]$/.test(original)) {
    return CDL_RESTRICTION_BITS[original] !== undefined ? [original] : null
  }
  if (/^(?:[A-Z0-9]{1,8}\s*[-:]\s*)?NONE$/.test(original) || original === 'NO RESTRICTIONS' || original === 'UNRESTRICTED') {
    return []
  }

  let rest = original.replace(/^[A-Z0-9]{1,8}\s*[-:]\s*/, '')
  const found: string[] = []
  for (const [pattern, letter] of RESTRICTION_PHRASES) {
    if (!pattern.test(rest) || found.includes(letter)) continue
    found.push(letter)
    rest = rest.replace(pattern, ' ')
  }
  if (found.length === 0) return null

  const leftovers = rest
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !RESTRICTION_FILLER.has(word))
  return leftovers.length === 0 ? found : null
}

/** Federal letters in an Accio restriction field, or null if any piece cannot be proved. */
export function tryRestrictionLetters(raw: string): string[] | null {
  const letters: string[] = []
  for (const piece of restrictionPieces(raw)) {
    const found = lettersFromRestrictionPiece(piece)
    if (!found) return null
    for (const letter of found) {
      if (!letters.includes(letter)) letters.push(letter)
    }
  }
  return letters
}

export function normalizeRestrictionLetter(raw: string): string | null {
  const letters = tryRestrictionLetters(raw)
  return letters?.length === 1 ? letters[0] : null
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

/** Empty list, or a report that says none → 0 (the circuit allows "none"). */
export function restrictionMaskFromCodes(codes: string[]): number {
  if (codes.length === 0) return 0
  let mask = 0
  for (const raw of codes) {
    const letters = tryRestrictionLetters(raw)
    if (!letters) {
      throw new Error(`Restriction code "${raw}" is not in the circuit table`)
    }
    for (const letter of letters) {
      mask |= 1 << CDL_RESTRICTION_BITS[letter]
    }
  }
  return mask
}

export function expirationToYmd(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  const parsed = parseViolationDate(raw)
  if (!parsed) return null
  return dateToYmdInt(parsed)
}
