/**
 * Form 3 employer provenance + merge (P3.7).
 * Verified rows are projected from employment_verification_requests and re-applied
 * on save/load so client tampering cannot stick.
 */

import type { DotForm3Employer } from '@/lib/dot-form-mapper'
import {
  findMatchingEmployerIndex,
  mapEvrToForm3Employer,
  type VerifiedEmploymentSource,
} from '@/lib/employment-to-form3-mapper'

export interface DotForm3EmployerProvenance {
  version: 1
  verifiedEmployerCount: number
  /** Latest verified_at used for badge copy */
  asOf: string | null
  verificationRequestIds: string[]
}

export type Form3WithProvenance = Record<string, unknown> & {
  employers?: DotForm3Employer[]
  _employerProvenance?: DotForm3EmployerProvenance
}

type Form3EmployerRuntime = DotForm3Employer & {
  type?: string
}

function asRuntimeEmployers(form3: Record<string, unknown> | null | undefined): Form3EmployerRuntime[] {
  if (!form3 || !Array.isArray(form3.employers)) return []
  return form3.employers as Form3EmployerRuntime[]
}

/**
 * Merge EVR-backed employers into Form 3.
 * - Replaces all prior `_source:'verified'` rows with fresh projection
 * - Keeps self / untagged rows (non-employment types always self)
 * - Overwrites matched self employment rows with locked verified values
 */
export function mergeVerifiedEmployersIntoForm3(
  existing: Record<string, unknown> | null | undefined,
  verifiedSources: VerifiedEmploymentSource[],
): Form3WithProvenance {
  const base: Record<string, unknown> = existing ? { ...existing } : {}
  const existingEmployers = asRuntimeEmployers(base)

  // Keep non-verified rows (self employment + unemployment/school/military)
  const selfRows = existingEmployers
    .filter((row) => row._source !== 'verified')
    .map((row) => ({
      ...row,
      _source: (row._source === 'self' || !row._source ? 'self' : row._source) as 'self',
      id: row.id || undefined,
    }))

  const verifiedRows: Form3EmployerRuntime[] = []
  const consumedSelfIndexes = new Set<number>()

  for (const evr of verifiedSources) {
    const mapped = mapEvrToForm3Employer(evr) as Form3EmployerRuntime
    mapped.type = 'employment'

    // Prefer matching a self row so we preserve phone/address the driver typed
    const matchIdx = findMatchingEmployerIndex(selfRows, evr)
    if (matchIdx >= 0 && !consumedSelfIndexes.has(matchIdx)) {
      const self = selfRows[matchIdx]
      verifiedRows.push({
        ...self,
        ...mapped,
        // Soft-preserve contact fields the EVR does not carry
        phone: self.phone || mapped.phone,
        hiringManagerName: self.hiringManagerName || mapped.hiringManagerName,
        hiringManagerPhone: self.hiringManagerPhone || mapped.hiringManagerPhone,
        address: self.address || mapped.address,
        duties: self.duties || mapped.duties,
        reasonForLeaving: self.reasonForLeaving || mapped.reasonForLeaving,
        salary: self.salary || mapped.salary,
        subjectToFMCSR: self.subjectToFMCSR || mapped.subjectToFMCSR,
        safetySensitiveFunction:
          self.safetySensitiveFunction || mapped.safetySensitiveFunction,
        type: 'employment',
        _source: 'verified',
      })
      consumedSelfIndexes.add(matchIdx)
    } else {
      verifiedRows.push(mapped)
    }
  }

  const remainingSelf = selfRows.filter((_, i) => !consumedSelfIndexes.has(i))
  const employers = [...verifiedRows, ...remainingSelf]

  const asOfDates = verifiedSources
    .map((v) => v.verified_at)
    .filter((d): d is string => Boolean(d))
    .sort()
  const asOf = asOfDates.length ? asOfDates[asOfDates.length - 1] : null

  const provenance: DotForm3EmployerProvenance = {
    version: 1,
    verifiedEmployerCount: verifiedRows.length,
    asOf,
    verificationRequestIds: verifiedSources.map((v) => v.id),
  }

  return {
    ...base,
    employers,
    _employerProvenance: provenance,
  }
}

export function formatVerifiedEmployerBadge(meta: {
  status?: string | null
  verifiedAt?: string | null
}): string {
  const partial = meta.status === 'PARTIALLY_VERIFIED'
  const asOf = meta.verifiedAt ? new Date(meta.verifiedAt).toLocaleDateString() : null
  const base = partial
    ? 'Partially verified — prior employer confirmed with adjustments'
    : 'Verified — prior employer confirmed'
  return asOf ? `${base}, as of ${asOf}` : base
}
