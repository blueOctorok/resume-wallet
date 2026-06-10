/**
 * Accio PSP (FMCSA Crash & Inspection) XML parser.
 *
 * Mirrors the structure of `src/lib/accio-xml-parser.ts` (MVR), but for the
 * `<subOrder type="fmcsa_crash_inspection">` element returned by Accio for
 * the FMCSA Pre-Employment Screening Program.
 *
 * Why this is defensive:
 * - Accio's `result_receipt.md` documents the MVR result schema in detail
 *   (section 2.10) but does NOT publish a corresponding schema for FMCSA PSP
 *   results. Vendor responses for less-common subOrder types historically
 *   carry a structured block (e.g. `<crash>` / `<inspection>`) plus a
 *   preformatted `<text>` block that the original Key portal renders verbatim.
 * - At the time this was written we had no completed PSP results in the
 *   database (every PSP order was stuck pending due to the
 *   `portalfromapplicant=Y` + suppressed-email bug fixed in this same PR), so
 *   the parser is built to be tolerant: structured fields when present,
 *   sensible empty arrays when absent, and the raw `<text>` block always
 *   captured so nothing is ever lost.
 *
 * On the first real-world fill we should re-read `psp_results.raw_xml` and
 * tighten the field selectors against what Accio actually sends.
 */

export type PspViolationOos = boolean | null

export interface PspCrash {
  date?: string
  reportNumber?: string
  city?: string
  state?: string
  fatalities?: number
  injuries?: number
  towAway?: boolean
  hazmatReleased?: boolean
  vehicleType?: string
  /** Free-text from the report when no structured field exists. */
  description?: string
}

export interface PspInspectionViolation {
  code?: string
  description?: string
  outOfService?: PspViolationOos
  /** "Driver" / "Vehicle" / "Hazmat" — what bucket FMCSA puts the violation in. */
  category?: string
  /** Federal regulation reference (e.g. "393.45A1IIIA"). */
  section?: string
  unitNumber?: number
}

export interface PspInspection {
  date?: string
  reportNumber?: string
  level?: string
  state?: string
  county?: string
  vehicleType?: string
  /** "No Violations Found" or null when there were violations. */
  result?: string
  outOfService?: PspViolationOos
  violations: PspInspectionViolation[]
}

export interface ParsedPspResult {
  // Order identifiers (mirror the MVR parser shape so callers feel the same)
  orderNumber: string
  subOrderNumber: string
  remoteOrderNumber?: string
  remoteSubOrderNumber?: string
  timeOrdered?: string
  timeFilled?: string

  // Driver identity
  subject?: {
    firstName?: string
    middleName?: string
    lastName?: string
    nameSuffix?: string
    dateOfBirth?: string
    licenseNumber?: string
    licenseState?: string
  }

  // Result content
  crashes: PspCrash[]
  inspections: PspInspection[]

  // Roll-up counts the UI / career card needs without re-walking arrays
  crashCount: number
  inspectionCount: number
  oosCount: number

  // Status flags
  filledStatus?: string
  filledCode?: string
  heldForReview?: boolean

  /** Preformatted human-readable report body Accio sends in `<text>`. */
  reportText?: string

  /** Raw FMCSA subOrder XML, kept so we can re-parse without hitting Accio. */
  rawXml: string
}

// ── small helpers (intentionally local; mirror accio-xml-parser style) ──────

function attr(tagBlock: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i')
  const m = tagBlock.match(re)
  return m ? m[1].trim() : undefined
}

function tagValue(xml: string, tagName: string): string | undefined {
  // CDATA-aware: strip wrapping <![CDATA[ ... ]]> if present.
  // `(?:\s[^>]*)?` boundary prevents prefix collisions (e.g. a tag matching a
  // longer sibling like <name_lastmaiden/>) — see accio-xml-parser openingTag.
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}\\s*>`, 'i')
  const m = xml.match(re)
  if (!m) return undefined
  const raw = m[1].trim()
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  return (cdata ? cdata[1] : raw).trim() || undefined
}

function intValue(xml: string, tagName: string): number | undefined {
  const v = tagValue(xml, tagName)
  if (v === undefined) return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

function boolValue(xml: string, tagName: string): boolean | undefined {
  const v = tagValue(xml, tagName)?.toUpperCase()
  if (v === undefined) return undefined
  if (v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1') return true
  if (v === 'N' || v === 'NO' || v === 'FALSE' || v === '0') return false
  return undefined
}

function allBlocks(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1])
  }
  return out
}

/** Find the FMCSA crash/inspection subOrder block within a full Accio result. */
function findFmcsaSubOrder(xml: string): { attrs: string; body: string } | null {
  const re = /<subOrder([^>]*type=["']fmcsa_crash_inspection["'][^>]*)>([\s\S]*?)<\/subOrder>/i
  const m = xml.match(re)
  if (!m) return null
  return { attrs: m[1], body: m[2] }
}

// ── main parser ────────────────────────────────────────────────────────────

export function parsePspResult(xml: string): ParsedPspResult {
  // Accio sends two shapes for completion: a wrapping <ScreeningResults> with
  // <completeOrder> and individual <subOrder>s, OR a single <postResults>
  // notification scoped to one subOrder. Either way we just need to find the
  // FMCSA-typed subOrder.
  const fmcsa = findFmcsaSubOrder(xml)

  // Postback notifications for individual results use <postResults> with
  // status attributes on the root element.
  const postResultsTag = xml.match(/<postResults([^>]*)>/i)
  const postAttrs = postResultsTag ? postResultsTag[1] : ''

  const filledStatus =
    fmcsa ? attr(fmcsa.attrs, 'filledStatus') : attr(postAttrs, 'filledStatus')
  const filledCode =
    fmcsa ? attr(fmcsa.attrs, 'filledCode') : attr(postAttrs, 'filledCode')
  const heldForReview =
    (fmcsa ? attr(fmcsa.attrs, 'held_for_review') : undefined)?.toUpperCase() === 'Y'

  const subOrderBody = fmcsa?.body ?? xml

  const orderNumber =
    attr(postAttrs, 'order') ??
    tagValue(xml, 'ordernumber') ??
    tagValue(xml, 'order_number') ??
    ''
  const subOrderNumber =
    attr(postAttrs, 'subOrder') ??
    (fmcsa ? attr(fmcsa.attrs, 'number') ?? attr(fmcsa.attrs, 'remote_number') : undefined) ??
    ''
  const remoteOrderNumber = attr(postAttrs, 'order') ?? tagValue(xml, 'orderID')
  const remoteSubOrderNumber =
    fmcsa ? attr(fmcsa.attrs, 'remote_number') : attr(postAttrs, 'subOrder')

  // Subject identity may live either in the subOrder (dlnum/dlstate) or in a
  // wrapping <subject>/<applicant> block. Try both.
  const subjectBlock =
    tagValue(xml, 'subject') ?? tagValue(xml, 'applicant') ?? ''

  const subject = {
    firstName: tagValue(subjectBlock, 'firstName') ?? tagValue(subjectBlock, 'first_name'),
    middleName: tagValue(subjectBlock, 'middleName') ?? tagValue(subjectBlock, 'middle_name'),
    lastName: tagValue(subjectBlock, 'lastName') ?? tagValue(subjectBlock, 'last_name'),
    nameSuffix: tagValue(subjectBlock, 'nameSuffix') ?? tagValue(subjectBlock, 'suffix'),
    dateOfBirth: tagValue(subjectBlock, 'dateOfBirth') ?? tagValue(subjectBlock, 'dob'),
    licenseNumber: tagValue(subOrderBody, 'dlnum') ?? tagValue(subjectBlock, 'dlnum'),
    licenseState: tagValue(subOrderBody, 'dlstate') ?? tagValue(subjectBlock, 'dlstate'),
  }

  // Crashes: try every known shape Accio is likely to emit. We support the
  // singular `<crash>`, the carrier-style `<crashRecord>`, and the FMCSA-style
  // `<crash_record>` so nothing gets dropped on schema drift.
  const crashBlocks = [
    ...allBlocks(subOrderBody, 'crash'),
    ...allBlocks(subOrderBody, 'crashRecord'),
    ...allBlocks(subOrderBody, 'crash_record'),
  ]
  const crashes: PspCrash[] = crashBlocks.map((block) => ({
    date: tagValue(block, 'date') ?? tagValue(block, 'crashDate') ?? tagValue(block, 'crash_date'),
    reportNumber:
      tagValue(block, 'reportNumber') ?? tagValue(block, 'report_number') ?? tagValue(block, 'reportNo'),
    city: tagValue(block, 'city'),
    state: tagValue(block, 'state'),
    fatalities: intValue(block, 'fatalities'),
    injuries: intValue(block, 'injuries'),
    towAway: boolValue(block, 'towAway') ?? boolValue(block, 'tow_away'),
    hazmatReleased:
      boolValue(block, 'hazmatReleased') ?? boolValue(block, 'hazmat_released'),
    vehicleType: tagValue(block, 'vehicleType') ?? tagValue(block, 'vehicle_type'),
    description: tagValue(block, 'description') ?? tagValue(block, 'narrative'),
  }))

  // Inspections (same defensive multi-shape approach)
  const inspectionBlocks = [
    ...allBlocks(subOrderBody, 'inspection'),
    ...allBlocks(subOrderBody, 'inspectionRecord'),
    ...allBlocks(subOrderBody, 'inspection_record'),
  ]
  let oosCount = 0
  const inspections: PspInspection[] = inspectionBlocks.map((block) => {
    const violationBlocks = [
      ...allBlocks(block, 'violation'),
      ...allBlocks(block, 'violationRecord'),
      ...allBlocks(block, 'violation_record'),
    ]
    const violations: PspInspectionViolation[] = violationBlocks.map((vb) => {
      const oos = boolValue(vb, 'outOfService') ?? boolValue(vb, 'oos') ?? null
      if (oos) oosCount++
      return {
        code: tagValue(vb, 'code') ?? tagValue(vb, 'violationCode') ?? tagValue(vb, 'violation_code'),
        description: tagValue(vb, 'description') ?? tagValue(vb, 'narrative'),
        outOfService: oos,
        category: tagValue(vb, 'category') ?? tagValue(vb, 'type'),
        section: tagValue(vb, 'section') ?? tagValue(vb, 'regulation'),
        unitNumber: intValue(vb, 'unit') ?? intValue(vb, 'unit_number'),
      }
    })
    const inspectionOos = boolValue(block, 'outOfService') ?? boolValue(block, 'oos') ?? null
    if (inspectionOos && violations.length === 0) oosCount++
    return {
      date: tagValue(block, 'date') ?? tagValue(block, 'inspectionDate') ?? tagValue(block, 'inspection_date'),
      reportNumber: tagValue(block, 'reportNumber') ?? tagValue(block, 'report_number'),
      level: tagValue(block, 'level') ?? tagValue(block, 'inspectionLevel'),
      state: tagValue(block, 'state'),
      county: tagValue(block, 'county'),
      vehicleType: tagValue(block, 'vehicleType') ?? tagValue(block, 'vehicle_type'),
      result: tagValue(block, 'result'),
      outOfService: inspectionOos,
      violations,
    }
  })

  // Always preserve the human-readable report body — Accio sends a
  // pre-formatted text dump that Key's portal renders verbatim, and we want it
  // available for the PDF and the in-app modal even if the structured parsing
  // misses a field.
  const reportText = tagValue(subOrderBody, 'text')
  const timeOrdered = tagValue(subOrderBody, 'time_ordered')
  const timeFilled = tagValue(subOrderBody, 'time_filled')

  return {
    orderNumber,
    subOrderNumber,
    remoteOrderNumber,
    remoteSubOrderNumber,
    timeOrdered,
    timeFilled,
    subject,
    crashes,
    inspections,
    crashCount: crashes.length,
    inspectionCount: inspections.length,
    oosCount,
    filledStatus,
    filledCode,
    heldForReview,
    reportText,
    rawXml: fmcsa ? `<subOrder${fmcsa.attrs}>${fmcsa.body}</subOrder>` : xml,
  }
}

/** JSONB-ready shape stored in `psp_results.parsed_data`. */
export function pspResultToJsonb(parsed: ParsedPspResult): Record<string, unknown> {
  return {
    orderNumber: parsed.orderNumber,
    subOrderNumber: parsed.subOrderNumber,
    remoteOrderNumber: parsed.remoteOrderNumber,
    remoteSubOrderNumber: parsed.remoteSubOrderNumber,
    timeOrdered: parsed.timeOrdered,
    timeFilled: parsed.timeFilled,
    subject: parsed.subject,
    crashes: parsed.crashes,
    inspections: parsed.inspections,
    crashCount: parsed.crashCount,
    inspectionCount: parsed.inspectionCount,
    oosCount: parsed.oosCount,
    filledStatus: parsed.filledStatus,
    filledCode: parsed.filledCode,
    heldForReview: parsed.heldForReview,
    reportText: parsed.reportText,
  }
}
