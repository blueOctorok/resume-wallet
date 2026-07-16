/**
 * Map ParsedMvrResult → DOT Form 2 accident / conviction rows (P3.7).
 * Rows are stamped `_source: 'mvr'` so the UI can lock them and the driver
 * can still append self-certified disclosures (391.21).
 */

import type { ParsedMvrResult, Violation, Accident } from '@/lib/accio-xml-parser'

export interface Form2AccidentRow {
  date: string
  nature: string
  fatalities: string
  injuries: string
  chemicalSpills: string
  atFault: string
  _source?: 'mvr' | 'psp' | 'self'
  _mvrKey?: string
  _pspKey?: string
}

export interface Form2ConvictionRow {
  dateConvicted: string
  violation: string
  stateOfViolation: string
  penalty: string
  _source?: 'mvr' | 'psp' | 'self'
  _mvrKey?: string
}

function yyyymmddToIso(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const digits = dateStr.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  return ''
}

/** Form 2 convictions use MonthYearPicker (MM/YYYY). */
function toMonthYear(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const iso = yyyymmddToIso(dateStr)
  if (iso.length >= 7) {
    const [y, m] = iso.split('-')
    return `${m}/${y}`
  }
  const slash = dateStr.trim().match(/^(\d{1,2})\/(\d{4})$/)
  if (slash) return `${String(parseInt(slash[1], 10)).padStart(2, '0')}/${slash[2]}`
  return ''
}

function faultToYesNo(fault: string | undefined): string {
  if (!fault) return ''
  const f = fault.toLowerCase()
  if (f === 'y' || f === 'yes' || f === 'true' || f.includes('fault')) return 'yes'
  if (f === 'n' || f === 'no' || f === 'false') return 'no'
  return ''
}

/**
 * Accio often omits `<state>` on individual `<mvr_violation>` blocks.
 * Fall back to MVR DL state (`dlstate`), then subject address state.
 * Use `||` (not `??`) so empty strings from parsed JSON don't block fallbacks.
 */
function convictionState(v: Violation, mvr: ParsedMvrResult): string {
  const candidates = [v.state, mvr.licenseState, mvr.subject?.state]
  for (const candidate of candidates) {
    const raw = (candidate || '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(raw)) return raw
  }
  return ''
}

function violationKey(v: Violation, index: number): string {
  const d = v.convictionDate || v.date || ''
  const desc = (v.description || v.type || '').slice(0, 40)
  return `v:${d}:${v.state ?? ''}:${desc}:${index}`
}

function accidentKey(a: Accident, index: number): string {
  const d = a.date || ''
  const desc = (a.description || a.severity || '').slice(0, 40)
  return `a:${d}:${desc}:${index}`
}

export function mapMvrToForm2Rows(mvr: ParsedMvrResult): {
  accidents: Form2AccidentRow[]
  convictions: Form2ConvictionRow[]
} {
  const accidents: Form2AccidentRow[] = (mvr.accidents ?? []).map((a, i) => ({
    date: yyyymmddToIso(a.date),
    nature: a.description || a.severity || '',
    fatalities: '',
    injuries: '',
    chemicalSpills: '',
    atFault: faultToYesNo(a.fault),
    _source: 'mvr' as const,
    _mvrKey: accidentKey(a, i),
  }))

  const convictions: Form2ConvictionRow[] = (mvr.violations ?? []).map((v, i) => ({
    dateConvicted: toMonthYear(v.convictionDate || v.date),
    violation: v.description || v.type || '',
    stateOfViolation: convictionState(v, mvr),
    penalty: v.points != null && v.points > 0 ? `${v.points} pts` : '',
    _source: 'mvr' as const,
    _mvrKey: violationKey(v, i),
  }))

  return { accidents, convictions }
}
