/**
 * Resume text → DOT application fields.
 *
 * The uploaded file is never stored. This module only turns an already-extracted
 * JSON shape into Form 1 / 2 / 3 values. The browser merges those values into the
 * draft so MVR-locked fields and verified employers stay put.
 */

import type { DotForm1Data, DotForm2Data, DotForm3Data, DotForm3Employer } from '@/lib/dot-form-mapper'
import { evrDateToForm3MonthYear } from '@/lib/employment-to-form3-mapper'
import type { ParsedResumeEducation, ParsedResumeExtraction } from '@/types/resume-extraction'

const STATE_BY_NAME: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
}

export interface ResumeDotPrefill {
  form1Data: Partial<DotForm1Data> | null
  form2Data: Partial<DotForm2Data> | null
  form3Data: Partial<DotForm3Data> | null
  stats: { extracted: number; fieldNames: string[] }
}

export function toStateCode(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase()
  return STATE_BY_NAME[t.toLowerCase()] ?? t
}

/** Map a resume skill onto Form 2's equipment <select> values. Unknown skills are skipped. */
export function equipmentFromSkillName(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('school bus')) return 'SCHOOL BUS'
  if (n.includes('motorcoach') || n.includes('motor coach')) return 'MOTORCOACH'
  if (n.includes('tanker')) return 'TRACTOR & TANKER'
  if (n.includes('double') || n.includes('triple')) return 'TRACTOR & 2 TRAILERS'
  if (n.includes('straight')) return 'STRAIGHT TRUCK'
  if (n.includes('bus')) return 'BUS'
  if (
    n.includes('tractor') ||
    n.includes('semi') ||
    n.includes('reefer') ||
    n.includes('flatbed') ||
    n.includes('dry van') ||
    /\bvan\b/.test(n)
  ) {
    return 'TRACTOR & SEMI-TRAILER'
  }
  return null
}

function normalizeCdlClass(raw: string | undefined): string {
  const t = blank(raw)
  if (!t) return ''
  // "Class A", "CDL-A", "A", "Class A CDL" all collapse to the same letters.
  const letters = t.toLowerCase().replace(/[^a-z]/g, '')
  if (letters === 'a' || letters === 'classa' || letters === 'cdla' || letters === 'classacdl' || letters === 'cdlclassa') {
    return 'Class A'
  }
  if (letters === 'b' || letters === 'classb' || letters === 'cdlb' || letters === 'classbcdl' || letters === 'cdlclassb') {
    return 'Class B'
  }
  if (letters === 'c' || letters === 'classc' || letters === 'cdlc' || letters === 'classccdl' || letters === 'cdlclassc') {
    return 'Class C'
  }
  return t
}

/** `<input type="date">` only accepts YYYY-MM-DD. A month with no day stays blank. */
function toDateInput(raw: string | undefined): string {
  const match = blank(raw).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function blank(value: string | undefined): string {
  return (value ?? '').trim()
}

function toForm3Date(raw: string | undefined, isCurrent: boolean): string {
  if (isCurrent) return 'Present'
  return evrDateToForm3MonthYear(raw)
}

function isDrivingSchool(edu: ParsedResumeEducation): boolean {
  const blob = `${edu.school ?? ''} ${edu.degree ?? ''} ${edu.field ?? ''}`.toLowerCase()
  return /cdl|truck driving|driving school/.test(blob)
}

function courseOfStudy(edu: ParsedResumeEducation): string {
  const degree = blank(edu.degree)
  const field = blank(edu.field)
  const certs = (edu.certifications ?? []).map((c) => c.trim()).filter(Boolean)
  const parts = [degree, field && field.toLowerCase() !== degree.toLowerCase() ? field : '', ...certs]
  return parts.filter(Boolean).join(', ')
}

function newId(): string {
  return crypto.randomUUID()
}

export function extractionToDotPrefill(extraction: ParsedResumeExtraction): ResumeDotPrefill {
  const fieldNames: string[] = []
  const person = extraction.personalInfo
  const cdl = extraction.cdlInfo

  const firstName = blank(person?.firstName)
  const lastName = blank(person?.lastName)
  const phone = blank(person?.phone)
  const email = blank(person?.email)
  const city = blank(person?.city)
  const state = toStateCode(person?.state)
  const zipCode = blank(person?.zipCode)

  if (firstName || lastName) fieldNames.push('Name')
  if (phone) fieldNames.push('Phone')
  if (email) fieldNames.push('Email')
  if (city || state || zipCode) fieldNames.push('Location')

  const license = {
    state: toStateCode(cdl?.cdlState),
    licenseNumber: blank(cdl?.cdlNumber),
    typeClass: normalizeCdlClass(cdl?.cdlClass),
    endorsements: (cdl?.endorsements ?? []).map((e) => e.trim()).filter(Boolean).join(', '),
    expirationDate: toDateInput(cdl?.cdlExpiration),
  }
  const hasLicense = Object.values(license).some((v) => v.trim())
  if (hasLicense) fieldNames.push('CDL')

  const hasMailing = Boolean(city || state || zipCode)
  const form1Data: Partial<DotForm1Data> | null =
    firstName || lastName || phone || email || hasMailing || hasLicense
      ? {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          ...(hasMailing
            ? { currentMailing: { street: '', city, state, zipCode, yearsAtAddress: '' } }
            : {}),
          ...(hasLicense ? { currentLicenses: [license] } : {}),
        }
      : null

  const equipmentSeen = new Set<string>()
  const drivingExperience: DotForm2Data['drivingExperience'] = []
  for (const skill of extraction.skills ?? []) {
    const equipmentType = equipmentFromSkillName(skill.name ?? '')
    if (!equipmentType || equipmentSeen.has(equipmentType)) continue
    equipmentSeen.add(equipmentType)
    // Years are not on a typical resume line. Leave them blank so the driver fills them.
    drivingExperience.push({ equipmentType, yearsOfExperience: '' })
  }
  if (drivingExperience.length) fieldNames.push('Equipment')
  const form2Data: Partial<DotForm2Data> | null = drivingExperience.length
    ? { drivingExperience }
    : null

  const employers: DotForm3Employer[] = []
  for (const job of extraction.employments ?? []) {
    const name = blank(job.companyName)
    if (!name) continue
    const isCurrent = Boolean(job.isCurrent)
    employers.push({
      id: newId(),
      type: 'employment',
      name,
      phone: '',
      address: blank(job.location),
      positionHeld: blank(job.position),
      duties: (job.responsibilities ?? []).map((r) => r.trim()).filter(Boolean).join('\n'),
      fromDate: toForm3Date(job.startDate, false),
      toDate: toForm3Date(job.endDate, isCurrent),
      reasonForLeaving: '',
      subjectToFMCSR: '',
      safetySensitiveFunction: '',
      isUnemployment: false,
      _source: 'self',
    })
  }
  if (employers.length) fieldNames.push(`${employers.length} job${employers.length === 1 ? '' : 's'}`)

  let schoolCount = 0
  for (const edu of extraction.educations ?? []) {
    const name = blank(edu.school)
    if (!name) continue
    schoolCount += 1
    const driving = isDrivingSchool(edu)
    employers.push({
      id: newId(),
      type: driving ? 'drivingSchool' : 'school',
      name,
      phone: '',
      address: '',
      positionHeld: '',
      courseOfStudy: courseOfStudy(edu),
      fromDate: '',
      toDate: evrDateToForm3MonthYear(edu.year),
      reasonForLeaving: '',
      subjectToFMCSR: '',
      safetySensitiveFunction: '',
      isUnemployment: false,
      _source: 'self',
    })
  }
  if (schoolCount) fieldNames.push(`${schoolCount} school${schoolCount === 1 ? '' : 's'}`)

  const form3Data: Partial<DotForm3Data> | null = employers.length ? { employers } : null

  return {
    form1Data,
    form2Data,
    form3Data,
    stats: { extracted: fieldNames.length, fieldNames },
  }
}

/** Keep a value the driver or an MVR already put on the form. Only fill blanks. */
function fillBlank(existing: string, incoming: string): string {
  return existing.trim() ? existing : incoming
}

function employerKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Copy resume fields into the open draft.
 * A value already on the form wins, including MVR-locked identity. Verified
 * employers are kept. Accidents stay on Form 2 — those come from the MVR.
 */
export function mergeResumePrefillIntoDot(
  existing: {
    form1?: Partial<DotForm1Data> | null
    form2?: Partial<DotForm2Data> | null
    form3?: Partial<DotForm3Data> | null
  },
  incoming: Pick<ResumeDotPrefill, 'form1Data' | 'form2Data' | 'form3Data'>,
): Pick<ResumeDotPrefill, 'form1Data' | 'form2Data' | 'form3Data'> {
  const form1 = mergeForm1(existing.form1 ?? null, incoming.form1Data)
  const form2 = mergeForm2(existing.form2 ?? null, incoming.form2Data)
  const form3 = mergeForm3(existing.form3 ?? null, incoming.form3Data)
  return { form1Data: form1, form2Data: form2, form3Data: form3 }
}

function mergeForm1(
  existing: Partial<DotForm1Data> | null,
  incoming: Partial<DotForm1Data> | null,
): Partial<DotForm1Data> | null {
  if (!incoming) return existing
  const base = existing ?? {}
  const take = (current: string, next: string) => fillBlank(current, next)

  const mailing = base.currentMailing
  const nextMailing = incoming.currentMailing
  const currentMailing = nextMailing
    ? {
        street: mailing?.street ?? '',
        city: fillBlank(mailing?.city ?? '', nextMailing.city ?? ''),
        state: fillBlank(mailing?.state ?? '', nextMailing.state ?? ''),
        zipCode: fillBlank(mailing?.zipCode ?? '', nextMailing.zipCode ?? ''),
        yearsAtAddress: mailing?.yearsAtAddress ?? '',
      }
    : mailing

  const existingLicenses = [...(base.currentLicenses ?? [])]
  const incomingLicense = incoming.currentLicenses?.[0]
  let currentLicenses = existingLicenses
  if (incomingLicense) {
    const current = existingLicenses[0]
    const mergedLicense = {
      state: take(current?.state ?? '', incomingLicense.state ?? ''),
      licenseNumber: take(current?.licenseNumber ?? '', incomingLicense.licenseNumber ?? ''),
      typeClass: take(current?.typeClass ?? '', incomingLicense.typeClass ?? ''),
      endorsements: take(current?.endorsements ?? '', incomingLicense.endorsements ?? ''),
      expirationDate: take(current?.expirationDate ?? '', incomingLicense.expirationDate ?? ''),
    }
    currentLicenses = [{ ...current, ...mergedLicense }, ...existingLicenses.slice(1)]
  }

  return {
    ...base,
    firstName: take(base.firstName ?? '', incoming.firstName ?? ''),
    lastName: take(base.lastName ?? '', incoming.lastName ?? ''),
    phone: take(base.phone ?? '', incoming.phone ?? ''),
    email: fillBlank(base.email ?? '', incoming.email ?? ''),
    ...(currentMailing ? { currentMailing } : {}),
    ...(currentLicenses.length ? { currentLicenses } : {}),
  }
}

function mergeForm2(
  existing: Partial<DotForm2Data> | null,
  incoming: Partial<DotForm2Data> | null,
): Partial<DotForm2Data> | null {
  if (!incoming?.drivingExperience?.length) return existing
  const kept = (existing?.drivingExperience ?? []).filter((row) => row.equipmentType?.trim())
  const seen = new Set(kept.map((row) => row.equipmentType))
  const added = incoming.drivingExperience.filter((row) => {
    if (!row.equipmentType?.trim() || seen.has(row.equipmentType)) return false
    seen.add(row.equipmentType)
    return true
  })
  const drivingExperience = [...kept, ...added]
  if (!drivingExperience.length) return existing
  return { ...(existing ?? {}), drivingExperience }
}

function mergeForm3(
  existing: Partial<DotForm3Data> | null,
  incoming: Partial<DotForm3Data> | null,
): Partial<DotForm3Data> | null {
  const incomingEmployers = incoming?.employers ?? []
  if (!incomingEmployers.length) return existing
  const kept = (existing?.employers ?? []).filter((row) => row.name?.trim())
  const seen = new Set(kept.map((row) => employerKey(row.name)))
  const added = incomingEmployers.filter((row) => {
    const key = employerKey(row.name ?? '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { ...(existing ?? {}), employers: [...kept, ...added] }
}

/** Drop blanks so a resume prefill cannot null out CDL or employment already on the profile. */
export function onlyFilledProfileFields(profile: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'string') {
      if (value.trim()) out[key] = value
      continue
    }
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value
      continue
    }
    if (value != null && value !== '') out[key] = value
  }
  return out
}
