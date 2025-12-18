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
  
  // Subject Information (personal info from XML subject block)
  subject?: {
    firstName?: string
    middleName?: string
    lastName?: string
    nameSuffix?: string
    ssn?: string // Full SSN from XML (for parsing only, not storage)
    dateOfBirth?: string // YYYYMMDD format from XML
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    gender?: string
  }
  
  // License Information (from MVR subOrder - dlnum, dlstate, dlexpiration)
  licenseNumber?: string // dlnum
  licenseState?: string // dlstate
  licenseExpirationDate?: string // dlexpiration (YYYYMMDD format)
  
  // License Details (from mvr_license blocks - multiple possible)
  licenses?: MvrLicense[]
  
  // Violations & Points (from mvr_violation blocks)
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
  
  // Fees
  fees?: {
    addon?: number
    adjustments?: number
    thirdparty?: number
    taxes?: number
    total?: number
  }
  
  // Status
  filledStatus?: string
  filledCode?: string
  heldForReview?: boolean
  heldForReleaseForm?: boolean
  
  // Raw Data
  rawXml?: string
}

export interface MvrLicense {
  issueDate?: string // license_issue_date (YYYYMMDD)
  expirationDate?: string // license_expiration_date (YYYYMMDD)
  class?: string // license_class
  code?: string // license_code
  type?: string // license_type (e.g., "PERSONAL")
  status?: string // license_status (e.g., "VALID")
  endorsements?: string // license_endorsements (comma-separated or single value)
  restrictions?: string // license_restrictions
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
    // Extract order numbers from completeOrder attributes
    const result: ParsedMvrResult = {
      orderNumber: extractXmlAttribute(xml, 'completeOrder', 'number') || extractXmlValue(xml, 'ordernumber') || '',
      subOrderNumber: extractXmlAttribute(xml, 'subOrder', 'number') || extractXmlValue(xml, 'suborder') || '',
      remoteOrderNumber: extractXmlAttribute(xml, 'completeOrder', 'remote_number') || extractXmlValue(xml, 'remote_number'),
      remoteSubOrderNumber: extractXmlAttribute(xml, 'subOrder', 'remote_number') || extractXmlValue(xml, 'remote_suborder'),
      timeOrdered: extractXmlValue(xml, 'time_ordered'),
      timeFilled: extractXmlValue(xml, 'time_filled'),
      filledStatus: extractXmlAttribute(xml, 'subOrder', 'filledStatus'),
      filledCode: extractXmlAttribute(xml, 'subOrder', 'filledCode'),
      heldForReview: extractXmlAttribute(xml, 'subOrder', 'held_for_review') === 'Y',
      heldForReleaseForm: extractXmlAttribute(xml, 'subOrder', 'held_for_release_form') === 'Y',
      rawXml: xml
    }

    // Extract subject information (personal info from subject block)
    const subjectXml = extractXmlBlock(xml, 'subject')
    if (subjectXml) {
      result.subject = {
        firstName: extractXmlValue(subjectXml, 'name_first'),
        middleName: extractXmlValue(subjectXml, 'name_middle'),
        lastName: extractXmlValue(subjectXml, 'name_last'),
        nameSuffix: extractXmlValue(subjectXml, 'name_suffix'),
        ssn: extractXmlValue(subjectXml, 'ssn'),
        dateOfBirth: extractXmlValue(subjectXml, 'dob'), // YYYYMMDD format
        email: extractXmlValue(subjectXml, 'email'),
        phone: extractXmlValue(subjectXml, 'phone_number'),
        address: extractXmlValue(subjectXml, 'address'),
        city: extractXmlValue(subjectXml, 'city'),
        state: extractXmlValue(subjectXml, 'state'),
        zip: extractXmlValue(subjectXml, 'zip'),
        country: extractXmlValue(subjectXml, 'country'),
        gender: extractXmlValue(subjectXml, 'gender')
      }
    }

    // Extract basic license info from MVR subOrder (dlnum, dlstate, dlexpiration)
    result.licenseNumber = extractXmlValue(xml, 'dlnum')
    result.licenseState = extractXmlValue(xml, 'dlstate')
    result.licenseExpirationDate = extractXmlValue(xml, 'dlexpiration') // YYYYMMDD format

    // Extract mvr_license blocks (can be multiple)
    result.licenses = extractMvrLicenses(xml)

    // Extract mvr_violation blocks
    result.violations = extractMvrViolations(xml)
    result.violationCount = result.violations?.length || 0
    
    // Calculate total points from violations
    if (result.violations && result.violations.length > 0) {
      result.totalPoints = result.violations.reduce((sum, v) => sum + (v.points || 0), 0)
    }

    // Extract fees (from fees block within subOrder)
    const feesXml = extractXmlBlock(xml, 'fees')
    if (feesXml) {
      const addon = extractXmlValue(feesXml, 'addon')
      const adjustments = extractXmlValue(feesXml, 'adjustments')
      const thirdparty = extractXmlValue(feesXml, 'thirdparty')
      const taxes = extractXmlValue(feesXml, 'taxes')
      const total = extractXmlValue(feesXml, 'total')
      
      if (addon || adjustments || thirdparty || taxes) {
        result.fees = {
          addon: addon ? parseFloat(addon) : undefined,
          adjustments: adjustments ? parseFloat(adjustments) : undefined,
          thirdparty: thirdparty ? parseFloat(thirdparty) : undefined,
          taxes: taxes ? parseFloat(taxes) : undefined,
          total: total ? parseFloat(total) : undefined
        }
      }
    }

    // Extract medical certificate info (if present)
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
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i')
  const match = xml.match(regex)
  if (match && match[1]) {
    return match[1].trim()
  }
  return undefined
}

/**
 * Extract attribute value from XML tag
 */
function extractXmlAttribute(xml: string, tagName: string, attributeName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*${attributeName}=["']([^"']*)["']`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : undefined
}

/**
 * Extract XML block (content between opening and closing tags)
 */
function extractXmlBlock(xml: string, tagName: string): string | undefined {
  // Match opening tag, then capture everything until closing tag
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1] : undefined
}

/**
 * Extract all mvr_license blocks from XML
 */
function extractMvrLicenses(xml: string): MvrLicense[] {
  const licenses: MvrLicense[] = []
  
  // Match all <mvr_license> blocks
  const licenseRegex = /<mvr_license[^>]*>([\s\S]*?)<\/mvr_license>/gi
  let match
  
  while ((match = licenseRegex.exec(xml)) !== null) {
    const licenseXml = match[1]
    const license: MvrLicense = {
      issueDate: extractXmlValue(licenseXml, 'license_issue_date'),
      expirationDate: extractXmlValue(licenseXml, 'license_expiration_date'),
      class: extractXmlValue(licenseXml, 'license_class'),
      code: extractXmlValue(licenseXml, 'license_code'),
      type: extractXmlValue(licenseXml, 'license_type'),
      status: extractXmlValue(licenseXml, 'license_status'),
      endorsements: extractXmlValue(licenseXml, 'license_endorsements'),
      restrictions: extractXmlValue(licenseXml, 'license_restrictions')
    }
    licenses.push(license)
  }
  
  return licenses
}

/**
 * Extract all mvr_violation blocks from XML
 */
function extractMvrViolations(xml: string): Violation[] {
  const violations: Violation[] = []
  
  // Match all <mvr_violation> blocks
  const violationRegex = /<mvr_violation[^>]*>([\s\S]*?)<\/mvr_violation>/gi
  let match
  
  while ((match = violationRegex.exec(xml)) !== null) {
    const violationXml = match[1]
    
    // Parse violation date (YYYYMMDD format)
    const violationDate = extractXmlValue(violationXml, 'violation_date')
    const convictionDate = extractXmlValue(violationXml, 'conviction_date')
    
    // Parse points (vendor_points or state_points)
    const vendorPoints = extractXmlValue(violationXml, 'vendor_points')
    const statePoints = extractXmlValue(violationXml, 'state_points')
    const points = vendorPoints ? parseInt(vendorPoints, 10) : (statePoints ? parseInt(statePoints, 10) : undefined)
    
    const violation: Violation = {
      date: violationDate,
      type: extractXmlValue(violationXml, 'violation_type'),
      description: extractXmlValue(violationXml, 'description') || extractXmlValue(violationXml, 'state_description'),
      points: points,
      state: extractXmlValue(violationXml, 'state') || extractXmlValue(violationXml, 'state_code')
    }
    
    violations.push(violation)
  }
  
  return violations
}

/**
 * Extract multiple values from XML (for arrays)
 */
function extractXmlValues(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi')
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
  // Get primary license from licenses array or fallback to basic license fields
  const primaryLicense = result.licenses && result.licenses.length > 0 
    ? result.licenses[0] 
    : null

  return {
    orderNumber: result.orderNumber,
    subOrderNumber: result.subOrderNumber,
    remoteOrderNumber: result.remoteOrderNumber,
    remoteSubOrderNumber: result.remoteSubOrderNumber,
    timeOrdered: result.timeOrdered,
    timeFilled: result.timeFilled,
    subject: result.subject ? {
      // Only store non-sensitive fields (exclude SSN)
      firstName: result.subject.firstName,
      middleName: result.subject.middleName,
      lastName: result.subject.lastName,
      nameSuffix: result.subject.nameSuffix,
      dateOfBirth: result.subject.dateOfBirth,
      email: result.subject.email,
      phone: result.subject.phone,
      address: result.subject.address,
      city: result.subject.city,
      state: result.subject.state,
      zip: result.subject.zip,
      country: result.subject.country,
      gender: result.subject.gender
    } : undefined,
    license: {
      number: result.licenseNumber,
      state: result.licenseState,
      expirationDate: result.licenseExpirationDate,
      // From mvr_license blocks
      class: primaryLicense?.class,
      code: primaryLicense?.code,
      type: primaryLicense?.type,
      status: primaryLicense?.status,
      issueDate: primaryLicense?.issueDate,
      endorsements: primaryLicense?.endorsements,
      restrictions: primaryLicense?.restrictions
    },
    licenses: result.licenses || [], // All license blocks
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
    fees: result.fees,
    status: {
      filledStatus: result.filledStatus,
      filledCode: result.filledCode,
      heldForReview: result.heldForReview,
      heldForReleaseForm: result.heldForReleaseForm
    }
  }
}

