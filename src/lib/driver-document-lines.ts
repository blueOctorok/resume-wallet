/**
 * Slot shape and the resume line built from it.
 *
 * Kept separate from the model call so a resume PDF download does not pull
 * the Anthropic client into the browser.
 *
 * The model fills slots only. This file writes the resume line. A model sentence
 * would embellish ("excellent safety record") and that line would look like a
 * verified claim. VIN, policy number, and SSN are not slots.
 */

export type DriverDocumentKind = 'insurance' | 'authority' | 'registration' | 'other'

export interface DriverDocumentSlots {
  kind: DriverDocumentKind
  insurer: string | null
  liabilityLimit: string | null
  cargoLimit: string | null
  expiration: string | null
  mcNumber: string | null
  usdot: string | null
  authorityDate: string | null
  vehicleYear: string | null
  vehicleMake: string | null
}

export type DriverDocumentReadStatus = 'read' | 'unread' | 'failed'

/** Stored on block_driver_documents.documents. */
export interface DriverDocumentRecord {
  id: string
  filename: string
  contentType: string
  storagePath: string
  uploadedAt: string
  readStatus: DriverDocumentReadStatus
  unreadReason: string | null
  slots: DriverDocumentSlots | null
  proposedLine: string | null
  acceptedAt: string | null
}

/** What the driver sees. The storage path stays on the server. */
export interface DriverDocumentView {
  id: string
  filename: string
  uploadedAt: string
  readStatus: DriverDocumentReadStatus
  unreadReason: string | null
  proposedLine: string | null
  accepted: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const EMPTY_SLOTS: DriverDocumentSlots = {
  kind: 'other',
  insurer: null,
  liabilityLimit: null,
  cargoLimit: null,
  expiration: null,
  mcNumber: null,
  usdot: null,
  authorityDate: null,
  vehicleYear: null,
  vehicleMake: null,
}

export function toDriverDocumentView(doc: DriverDocumentRecord): DriverDocumentView {
  return {
    id: doc.id,
    filename: doc.filename,
    uploadedAt: doc.uploadedAt,
    readStatus: doc.readStatus,
    unreadReason: doc.unreadReason,
    proposedLine: doc.proposedLine,
    accepted: Boolean(doc.acceptedAt),
  }
}

export function acceptedResumeLines(docs: DriverDocumentRecord[]): string[] {
  return docs
    .filter((doc) => doc.acceptedAt && doc.proposedLine)
    .map((doc) => doc.proposedLine as string)
}

export function parseDriverDocuments(value: unknown): DriverDocumentRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(isDriverDocumentRecord)
}

function isDriverDocumentRecord(value: unknown): value is DriverDocumentRecord {
  if (!value || typeof value !== 'object') return false
  const row = value as DriverDocumentRecord
  return typeof row.id === 'string' && typeof row.filename === 'string' && typeof row.storagePath === 'string'
}

/** Resume line from slots. Null when the page had nothing worth printing. */
export function lineFromSlots(slots: DriverDocumentSlots): string | null {
  if (slots.kind === 'insurance') {
    const parts = [
      slots.liabilityLimit ? `Auto liability ${formatMoney(slots.liabilityLimit)}` : null,
      slots.cargoLimit ? `Cargo ${formatMoney(slots.cargoLimit)}` : null,
      slots.expiration ? `expires ${formatMonthYear(slots.expiration)}` : null,
    ].filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (slots.kind === 'authority') {
    const id = slots.mcNumber
      ? `MC ${slots.mcNumber}`
      : slots.usdot
        ? `USDOT ${slots.usdot}`
        : null
    const since = slots.authorityDate ? `authority since ${slots.authorityDate.slice(0, 4)}` : null
    const parts = [id, since].filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (slots.kind === 'registration') {
    const line = [slots.vehicleYear, slots.vehicleMake].filter(Boolean).join(' ')
    return line || null
  }

  return null
}

export function sanitizeSlots(value: unknown): DriverDocumentSlots {
  if (!value || typeof value !== 'object') return { ...EMPTY_SLOTS }
  const raw = value as Record<string, unknown>
  const kind = raw.kind === 'insurance' || raw.kind === 'authority' || raw.kind === 'registration'
    ? raw.kind
    : 'other'
  return {
    kind,
    insurer: shortText(raw.insurer),
    liabilityLimit: moneyDigits(raw.liabilityLimit),
    cargoLimit: moneyDigits(raw.cargoLimit),
    expiration: isoDate(raw.expiration),
    mcNumber: idDigits(raw.mcNumber),
    usdot: idDigits(raw.usdot),
    authorityDate: isoDate(raw.authorityDate),
    vehicleYear: yearDigits(raw.vehicleYear),
    vehicleMake: vehicleMake(raw.vehicleMake),
  }
}

/** A make is words. A VIN is letters and digits, and it does not belong on a resume. */
function vehicleMake(value: unknown): string | null {
  const text = shortText(value)
  if (!text || /\d/.test(text)) return null
  return text
}

function shortText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 60) return null
  return text
}

function moneyDigits(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1000) {
    return String(Math.round(value))
  }
  if (typeof value !== 'string') return null
  const lower = value.toLowerCase()
  const leading = Number(value.replace(/[$,\s]/g, '').match(/[\d.]+/)?.[0] ?? '')
  if (lower.includes('million') && Number.isFinite(leading) && leading > 0 && leading < 1000) {
    return String(Math.round(leading * 1_000_000))
  }
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const amount = Number(digits)
  if (!Number.isFinite(amount) || amount < 1000) return null
  return String(amount)
}

function idDigits(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const digits = String(Math.trunc(value))
    return digits.length >= 4 && digits.length <= 10 ? digits : null
  }
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 4 && digits.length <= 10 ? digits : null
}

function yearDigits(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
  const match = raw.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const full = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (full) {
    const month = Number(full[2])
    const day = Number(full[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${full[1]}-${full[2]}-${full[3]}`
  }
  const monthOnly = value.match(/^(\d{4})-(\d{2})$/)
  if (!monthOnly) return null
  const month = Number(monthOnly[2])
  if (month < 1 || month > 12) return null
  return `${monthOnly[1]}-${monthOnly[2]}-01`
}

function formatMoney(digits: string): string {
  return `$${Number(digits).toLocaleString('en-US')}`
}

function formatMonthYear(iso: string): string {
  const [year, month] = iso.split('-')
  const label = MONTHS[Number(month) - 1]
  return label ? `${label} ${year}` : year
}
