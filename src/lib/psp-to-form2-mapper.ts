/**
 * Map ParsedPspResult → DOT Form 2 crash / inspection rows (P3.7).
 * Crashes land in the existing accidents[] list with `_source: 'psp'`.
 * Inspections get their own array (FMCSA PSP has no Form 2 home today).
 * Driver may still append `_source: 'self'` disclosures (391.21).
 */

import type { ParsedPspResult, PspCrash, PspInspection } from '@/lib/accio-psp-parser'
import type { Form2AccidentRow } from '@/lib/mvr-to-form2-mapper'

export interface Form2InspectionRow {
  date: string
  reportNumber: string
  level: string
  state: string
  result: string
  outOfService: string
  violationSummary: string
  _source?: 'psp' | 'self'
  _pspKey?: string
}

function yyyymmddToIso(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const digits = dateStr.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  return ''
}

function crashKey(c: PspCrash, index: number): string {
  const d = c.date || ''
  const desc = (c.description || c.reportNumber || '').slice(0, 40)
  return `psp-crash:${d}:${desc}:${index}`
}

function inspectionKey(i: PspInspection, index: number): string {
  const d = i.date || ''
  const rep = i.reportNumber || ''
  return `psp-insp:${d}:${rep}:${index}`
}

function crashNature(c: PspCrash): string {
  const bits = [
    c.description,
    c.city && c.state ? `${c.city}, ${c.state}` : c.state || c.city,
    c.vehicleType,
    c.towAway ? 'tow-away' : null,
  ].filter(Boolean)
  return bits.join(' · ') || 'FMCSA-reportable crash (PSP)'
}

/** PSP does not assign fault — leave blank (honest). */
export function mapPspCrashesToAccidentRows(psp: ParsedPspResult): Form2AccidentRow[] {
  return (psp.crashes ?? []).map((c, i) => ({
    date: yyyymmddToIso(c.date),
    nature: crashNature(c),
    fatalities: c.fatalities != null ? String(c.fatalities) : '',
    injuries: c.injuries != null ? String(c.injuries) : '',
    chemicalSpills: c.hazmatReleased ? 'yes' : '',
    atFault: '',
    _source: 'psp' as const,
    _pspKey: crashKey(c, i),
  }))
}

export function mapPspInspectionsToForm2Rows(psp: ParsedPspResult): Form2InspectionRow[] {
  return (psp.inspections ?? []).map((insp, i) => {
    const vios = (insp.violations ?? [])
      .map((v) => v.description || v.code || v.section)
      .filter(Boolean)
      .slice(0, 4)
    return {
      date: yyyymmddToIso(insp.date),
      reportNumber: insp.reportNumber || '',
      level: insp.level || '',
      state: insp.state || '',
      result: insp.result || (vios.length ? `${vios.length} violation(s)` : ''),
      outOfService:
        insp.outOfService === true ? 'yes' : insp.outOfService === false ? 'no' : '',
      violationSummary: vios.join('; '),
      _source: 'psp' as const,
      _pspKey: inspectionKey(insp, i),
    }
  })
}

export function mapPspToForm2Rows(psp: ParsedPspResult): {
  crashesAsAccidents: Form2AccidentRow[]
  inspections: Form2InspectionRow[]
} {
  return {
    crashesAsAccidents: mapPspCrashesToAccidentRows(psp),
    inspections: mapPspInspectionsToForm2Rows(psp),
  }
}
