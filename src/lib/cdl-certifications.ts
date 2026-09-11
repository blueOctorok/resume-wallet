/**
 * CDL classes + FMCSA endorsements a driver can claim after CDL school.
 *
 * Drivers used to hand-type this on DOT Form 3, which made it unfilterable for
 * employers ("Class A", "class-a cdl", "CDL A" are all the same thing). It's a
 * picker now.
 *
 * Selections are stored in the entry's existing `courseOfStudy` field as a
 * comma-joined list. No option contains a comma, so a legacy hand-typed value
 * round-trips as chips instead of being dropped on hydrate.
 */
export const CDL_CERTIFICATION_OPTIONS = [
  'Class A CDL',
  'Class B CDL',
  'Class C CDL',
  'Hazmat (H)',
  'Tanker (N)',
  'Tanker + Hazmat (X)',
  'Doubles/Triples (T)',
  'Passenger (P)',
  'School Bus (S)',
  'Air Brakes (L)',
  'None/Other',
] as const

/** Exclusive option — "none" alongside a class is contradictory. */
export const CDL_CERTIFICATION_NONE = 'None/Other'

export function parseCertifications(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function joinCertifications(certifications: string[]): string {
  return certifications.join(', ')
}

/** Append one option, enforcing None/Other exclusivity in both directions. */
export function addCertification(current: string[], option: string): string[] {
  if (current.includes(option)) return current
  if (option === CDL_CERTIFICATION_NONE) return [CDL_CERTIFICATION_NONE]
  return [...current.filter((c) => c !== CDL_CERTIFICATION_NONE), option]
}
