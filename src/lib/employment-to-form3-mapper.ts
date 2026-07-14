/**
 * Map prior-employer verification (EVR) → DOT Form 3 employer rows (P3.7).
 * Only VERIFIED / PARTIALLY_VERIFIED rows become `_source: 'verified'`.
 * Self-reported employment stays open; never badge unverified work history.
 */

import type { DotForm3Employer } from '@/lib/dot-form-mapper'

export interface VerifiedEmploymentSource {
  id: string
  employment_id: string
  previous_employer_name: string
  claimed_position: string
  claimed_start_date: string
  claimed_end_date: string | null
  verified_at: string | null
  status: string
}

/** ISO / YYYY-MM-DD / YYYYMMDD → MM/YYYY for Form 3 MonthYearPicker. */
export function evrDateToForm3MonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const t = dateStr.trim()
  if (/^present$/i.test(t)) return 'Present'
  const slash = t.match(/^(\d{1,2})\/(\d{4})$/)
  if (slash) return `${String(parseInt(slash[1], 10)).padStart(2, '0')}/${slash[2]}`
  const iso = t.match(/^(\d{4})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[1]}`
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 6) {
    return `${digits.slice(4, 6)}/${digits.slice(0, 4)}`
  }
  return ''
}

function normCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normMonthYear(raw: string): string {
  return evrDateToForm3MonthYear(raw).toLowerCase()
}

export function employmentMatchKey(company: string, startDate: string): string {
  return `${normCompany(company)}|${normMonthYear(startDate)}`
}

export function mapEvrToForm3Employer(evr: VerifiedEmploymentSource): DotForm3Employer {
  return {
    id: evr.employment_id || `evr-${evr.id}`,
    name: evr.previous_employer_name || '',
    phone: '',
    email: '',
    address: '',
    positionHeld: evr.claimed_position || '',
    duties: '',
    fromDate: evrDateToForm3MonthYear(evr.claimed_start_date),
    toDate: evr.claimed_end_date
      ? evrDateToForm3MonthYear(evr.claimed_end_date)
      : 'Present',
    reasonForLeaving: '',
    salary: '',
    gapsInEmployment: '',
    subjectToFMCSR: '',
    safetySensitiveFunction: '',
    isUnemployment: false,
    _source: 'verified',
    _verificationRequestId: evr.id,
    _evrKey: `evr:${evr.id}`,
    _verificationStatus: evr.status,
    _verifiedAt: evr.verified_at ?? undefined,
  }
}

/**
 * Match an EVR to an existing Form 3 employer by employment_id or company+start.
 */
export function findMatchingEmployerIndex(
  employers: DotForm3Employer[],
  evr: VerifiedEmploymentSource,
): number {
  const byId = employers.findIndex(
    (e) => e.id && evr.employment_id && e.id === evr.employment_id,
  )
  if (byId >= 0) return byId

  const key = employmentMatchKey(evr.previous_employer_name, evr.claimed_start_date)
  return employers.findIndex((e) => {
    if (e.isUnemployment) return false
    if (!e.name?.trim()) return false
    return employmentMatchKey(e.name, e.fromDate) === key
  })
}
