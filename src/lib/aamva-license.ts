/**
 * Fields read off a US driver license PDF417 barcode (AAMVA DL/ID card).
 *
 * The barcode is a text encoding of what is printed on the card. It is not a
 * signature from the DMV, so these fields stay "on file" until a state-record
 * pull confirms them.
 */

export interface LicenseScanFields {
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  licenseNumber: string
  state: string
  /** Single class letter when the card says A, B, or C. Otherwise the short code as printed. */
  licenseClass: string
  endorsements: string[]
  restrictions: string[]
  expirationDate: string
  street: string
  city: string
  postalCode: string
}

export function emptyLicenseFields(): LicenseScanFields {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    licenseNumber: '',
    state: '',
    licenseClass: '',
    endorsements: [],
    restrictions: [],
    expirationDate: '',
    street: '',
    city: '',
    postalCode: '',
  }
}

const ELEMENT_CODES = [
  'DAQ', 'DCS', 'DAC', 'DAD', 'DBB', 'DBA', 'DCA', 'DCB', 'DCD',
  'DAJ', 'DAG', 'DAI', 'DAK',
] as const

type ElementCode = (typeof ELEMENT_CODES)[number]

/** Pull AAMVA data elements out of a decoded barcode string. */
export function parseAamvaLicense(raw: string): LicenseScanFields | null {
  const elements = readElements(raw)
  if (!elements.DAQ && !elements.DCS && !elements.DAC) return null

  const fields = emptyLicenseFields()
  fields.firstName = titleCase(elements.DAC ?? '')
  fields.middleName = titleCase(elements.DAD ?? '')
  fields.lastName = titleCase(elements.DCS ?? '')
  fields.dateOfBirth = aamvaDate(elements.DBB ?? '')
  fields.expirationDate = aamvaDate(elements.DBA ?? '')
  fields.licenseNumber = (elements.DAQ ?? '').trim()
  fields.state = stateCode(elements.DAJ ?? '')
  fields.licenseClass = classCode(elements.DCA ?? '')
  fields.endorsements = codeList(elements.DCD ?? '')
  fields.restrictions = codeList(elements.DCB ?? '')
  fields.street = titleCase(elements.DAG ?? '')
  fields.city = titleCase(elements.DAI ?? '')
  fields.postalCode = postalCode(elements.DAK ?? '')
  return fields
}

export function isLicenseScanFields(value: unknown): value is LicenseScanFields {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.licenseNumber === 'string' && typeof row.state === 'string'
}

function readElements(raw: string): Partial<Record<ElementCode, string>> {
  const text = raw.replace(/\r/g, '\n')
  const found: Partial<Record<ElementCode, string>> = {}
  // Element code is 3 letters at the start of a line, or glued on after the header.
  const pattern = /(DAQ|DCS|DAC|DAD|DBB|DBA|DCA|DCB|DCD|DAJ|DAG|DAI|DAK)([^\n]*)/g
  for (const match of text.matchAll(pattern)) {
    const code = match[1] as ElementCode
    const value = match[2]?.trim() ?? ''
    if (!found[code] && value) found[code] = value
  }
  return found
}

/**
 * AAMVA dates are usually MMDDCCYY. A few jurisdictions use YYYYMMDD.
 * Prefer MMDDCCYY when the first two digits are a month and the last four are a year.
 */
export function aamvaDate(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return ''
  const eight = digits.slice(0, 8)
  const monthFirst = Number(eight.slice(0, 2))
  const yearLast = Number(eight.slice(4, 8))
  const yearFirst = Number(eight.slice(0, 4))
  const monthSecond = Number(eight.slice(4, 6))

  if (monthFirst >= 1 && monthFirst <= 12 && yearLast >= 1900 && yearLast <= 2100) {
    return iso(yearLast, monthFirst, Number(eight.slice(2, 4)))
  }
  if (yearFirst >= 1900 && yearFirst <= 2100 && monthSecond >= 1 && monthSecond <= 12) {
    return iso(yearFirst, monthSecond, Number(eight.slice(6, 8)))
  }
  return ''
}

function iso(year: number, month: number, day: number): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function stateCode(raw: string): string {
  const letters = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  return letters.length >= 2 ? letters.slice(0, 2) : ''
}

function classCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  const letter = trimmed.match(/[A-C]/)?.[0]
  if (letter) return letter
  return trimmed.replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

const IGNORED_CODES = new Set(['NONE', 'NA'])

function codeList(raw: string): string[] {
  const parts = raw.toUpperCase().split(/[^A-Z0-9]+/).map((p) => p.trim()).filter(Boolean)
  const codes = parts.filter((p) => !IGNORED_CODES.has(p))
  return [...new Set(codes)]
}

function titleCase(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function postalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 9 && digits.slice(5, 9) !== '0000') {
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
  }
  if (digits.length >= 5) return digits.slice(0, 5)
  return raw.trim()
}

/** DOT Form 1 stores class as "Class A", not the single letter on the card. */
export function licenseClassForDot(licenseClass: string): string {
  const letter = licenseClass.trim().toUpperCase()
  if (letter === 'A' || letter === 'B' || letter === 'C') return `Class ${letter}`
  return licenseClass.trim()
}
