import { personNameParts, personNamesConflict } from '@/lib/dq-coach-compare'

/**
 * The name a DOT signature has to match.
 *
 * A completed MVR is the state record, so it wins when both are on file.
 * The license barcode is the fallback until that report exists. It is a read
 * of the card, not a DMV check.
 */
export type SignatureNameSource = 'mvr' | 'license'

export interface SignatureNameAnchor {
  name: string
  source: SignatureNameSource
}

export function joinPersonName(
  first?: string | null,
  middle?: string | null,
  last?: string | null,
): string | null {
  const name = [first, middle, last].map((part) => part?.trim() ?? '').filter(Boolean).join(' ')
  return personNameParts(name) ? name : null
}

/** MVR when a report is on file. Otherwise the confirmed barcode read. */
export function pickSignatureAnchor(
  mvrName: string | null,
  licenseName: string | null,
): SignatureNameAnchor | null {
  if (mvrName) return { name: mvrName, source: 'mvr' }
  if (licenseName) return { name: licenseName, source: 'license' }
  return null
}

/**
 * First and last have to agree. A shorter first name still matches when it is
 * the start of the longer one ("Sam" and "Samuel"). A single word is not a
 * full name, so it does not match.
 */
export function signatureMatchesName(signed: string, anchorName: string): boolean {
  if (!personNameParts(anchorName)) return true
  if (!personNameParts(signed)) return false
  return !personNamesConflict(signed, anchorName)
}

export function signatureFieldError(
  value: string,
  anchor: SignatureNameAnchor | null,
  field: 'signature' | 'printed',
): string | null {
  if (!anchor || signatureMatchesName(value, anchor.name)) return null
  const where =
    anchor.source === 'mvr'
      ? `the name on your motor vehicle report (${anchor.name})`
      : `the name read from your license barcode (${anchor.name})`
  return field === 'signature'
    ? `Sign with ${where}.`
    : `Printed name has to match ${where}.`
}
