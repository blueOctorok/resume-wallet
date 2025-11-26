/**
 * Accio XML Parser
 * Parses XML results from Accio webhooks into structured data
 */

export interface ParsedMvrResult {
  // Order Information
  orderNumber: string
  subOrderNumber: string
  remoteOrderNumber?: string
  remoteSubOrderNumber?: string
  timeOrdered?: string
  timeFilled?: string
  
  // License Information
  licenseNumber?: string
  licenseState?: string
  licenseClass?: string
  licenseStatus?: string
  licenseIssueDate?: string
  licenseExpirationDate?: string
  
  // Violations & Points
  totalPoints?: number
  violationCount?: number
  violations?: Violation[]
  
  // Accidents
  accidentCount?: number
  accidents?: Accident[]
  
  // Suspensions
  suspensionCount?: number
  suspensions?: Suspension[]
  
  // Medical Certificate
  medicalCertExpiration?: string
  medicalCertStatus?: string
  
  // CDL Information
  cdlEndorsements?: string[]
  cdlRestrictions?: string[]
  
  // Fees
  fees?: {
    addon?: number
    adjustments?: number
    thirdparty?: number
    taxes?: number
  }
  
  // Status
  filledStatus?: string
  filledCode?: string
  heldForReview?: boolean
  heldForReleaseForm?: boolean
  
  // Raw Data
  rawXml?: string
}

export interface Violation {
  date?: string
  type?: string
  description?: string
  points?: number
  state?: string
}

export interface Accident {
  date?: string
  severity?: string
  fault?: string
  description?: string
}

export interface Suspension {
  date?: string
  reason?: string
  endDate?: string
  state?: string
}

/**
 * Parse Accio XML result into structured data
 * This is a basic parser - you may need to enhance based on actual Accio response format
 */
export function parseAccioMvrResult(xml: string): ParsedMvrResult {
  try {
    // Basic XML parsing (you may want to use a proper XML parser like 'xml2js' or 'fast-xml-parser')
    // For now, we'll extract key fields using regex (not ideal, but works for MVP)
    
    const result: ParsedMvrResult = {
      orderNumber: extractXmlValue(xml, 'order'),
      subOrderNumber: extractXmlValue(xml, 'subOrder'),
      remoteOrderNumber: extractXmlValue(xml, 'remote_order'),
      remoteSubOrderNumber: extractXmlValue(xml, 'remote_subOrder'),
      timeOrdered: extractXmlValue(xml, 'time_ordered'),
      timeFilled: extractXmlValue(xml, 'time_filled'),
      filledStatus: extractXmlValue(xml, 'filledStatus'),
      filledCode: extractXmlValue(xml, 'filledCode'),
      heldForReview: extractXmlValue(xml, 'held_for_review') === 'Y',
      heldForReleaseForm: extractXmlValue(xml, 'held_for_release_form') === 'Y',
      rawXml: xml
    }

    // Extract license information
    result.licenseNumber = extractXmlValue(xml, 'dlnum') || extractXmlValue(xml, 'verified_dlnum')
    result.licenseState = extractXmlValue(xml, 'dlstate') || extractXmlValue(xml, 'verified_dlstate')
    result.licenseClass = extractXmlValue(xml, 'dlclass') || extractXmlValue(xml, 'verified_dlclass')
    result.licenseStatus = extractXmlValue(xml, 'license_status') || extractXmlValue(xml, 'verified_license_status')
    result.licenseExpirationDate = extractXmlValue(xml, 'dlexpiration') || extractXmlValue(xml, 'verified_dlexpiration')

    // Extract points and violations (basic - may need enhancement)
    const pointsMatch = xml.match(/<total_points>(\d+)<\/total_points>/i)
    if (pointsMatch) {
      result.totalPoints = parseInt(pointsMatch[1], 10)
    }

    const violationCountMatch = xml.match(/<violation_count>(\d+)<\/violation_count>/i)
    if (violationCountMatch) {
      result.violationCount = parseInt(violationCountMatch[1], 10)
    }

    // Extract fees
    const addonMatch = xml.match(/<addon>([\d.]+)<\/addon>/i)
    if (addonMatch) {
      result.fees = {
        addon: parseFloat(addonMatch[1]),
        adjustments: parseFloat(extractXmlValue(xml, 'adjustments') || '0'),
        thirdparty: parseFloat(extractXmlValue(xml, 'thirdparty') || '0'),
        taxes: parseFloat(extractXmlValue(xml, 'taxes') || '0')
      }
    }

    // Extract medical certificate info
    result.medicalCertExpiration = extractXmlValue(xml, 'medical_cert_expiration')
    result.medicalCertStatus = extractXmlValue(xml, 'medical_cert_status')

    return result
  } catch (error) {
    console.error('[ACCIO PARSER] Error parsing XML:', error)
    throw new Error('Failed to parse Accio XML result')
  }
}

/**
 * Extract value from XML tag
 */
function extractXmlValue(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : undefined
}

/**
 * Extract multiple values from XML (for arrays)
 */
function extractXmlValues(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi')
  const matches = xml.matchAll(regex)
  const values: string[] = []
  for (const match of matches) {
    if (match[1]) {
      values.push(match[1].trim())
    }
  }
  return values
}

/**
 * Convert parsed result to JSONB format for database storage
 */
export function mvrResultToJsonb(result: ParsedMvrResult): any {
  return {
    orderNumber: result.orderNumber,
    subOrderNumber: result.subOrderNumber,
    remoteOrderNumber: result.remoteOrderNumber,
    remoteSubOrderNumber: result.remoteSubOrderNumber,
    timeOrdered: result.timeOrdered,
    timeFilled: result.timeFilled,
    license: {
      number: result.licenseNumber,
      state: result.licenseState,
      class: result.licenseClass,
      status: result.licenseStatus,
      issueDate: result.licenseIssueDate,
      expirationDate: result.licenseExpirationDate
    },
    violations: {
      totalPoints: result.totalPoints || 0,
      count: result.violationCount || 0,
      details: result.violations || []
    },
    accidents: {
      count: result.accidentCount || 0,
      details: result.accidents || []
    },
    suspensions: {
      count: result.suspensionCount || 0,
      details: result.suspensions || []
    },
    medical: {
      certExpiration: result.medicalCertExpiration,
      certStatus: result.medicalCertStatus
    },
    cdl: {
      endorsements: result.cdlEndorsements || [],
      restrictions: result.cdlRestrictions || []
    },
    fees: result.fees,
    status: {
      filledStatus: result.filledStatus,
      filledCode: result.filledCode,
      heldForReview: result.heldForReview,
      heldForReleaseForm: result.heldForReleaseForm
    }
  }
}

