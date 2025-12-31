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
    // Extract order number from completeOrder - try multiple tag names
    // Priority: reference_number > number (usually contains our order number) > remote_number (Accio's internal number)
    let orderReferenceNumber = extractXmlAttribute(xml, 'completeOrder', 'reference_number')
    let orderNumberAttr = extractXmlAttribute(xml, 'completeOrder', 'number')
    let orderRemoteNumber = extractXmlAttribute(xml, 'completeOrder', 'remote_number')
    
    // Fallback: try 'order' tag if 'completeOrder' doesn't exist
    if (!orderReferenceNumber && !orderNumberAttr && !orderRemoteNumber) {
      orderReferenceNumber = extractXmlAttribute(xml, 'order', 'reference_number')
      orderNumberAttr = extractXmlAttribute(xml, 'order', 'number')
      orderRemoteNumber = extractXmlAttribute(xml, 'order', 'remote_number') || extractXmlAttribute(xml, 'order', 'orderID')
    }
    
    // Also try extracting from orderInfo block (ordernumber or order_number tags)
    const orderInfoNumber = extractXmlValue(xml, 'ordernumber') || extractXmlValue(xml, 'order_number')
    
    // Use reference_number if available, otherwise use number attribute (which should contain our order number)
    // Fallback to orderInfo number, then remote_number (Accio's internal number)
    // Note: If only remote_number is available, we'll use it as orderNumber for matching purposes
    const orderNumber = (orderReferenceNumber && orderReferenceNumber.trim()) 
      || (orderNumberAttr && orderNumberAttr.trim()) 
      || orderInfoNumber
      || orderRemoteNumber // Use remote_number as fallback - webhook can match by this
      || ''
    
    // Find MVR subOrder specifically - look for type="MVR" or check all subOrders
    // Accio sometimes sends empty number="" and uses remote_number instead
    let mvrSubOrder = findMvrSubOrder(xml)
    
    // If no MVR subOrder found, try to extract from first subOrder as fallback
    if (!mvrSubOrder) {
      const firstSubOrderNumber = extractXmlAttribute(xml, 'subOrder', 'number')
      const firstSubOrderRemote = extractXmlAttribute(xml, 'subOrder', 'remote_number')
      if (firstSubOrderNumber || firstSubOrderRemote) {
        mvrSubOrder = {
          number: firstSubOrderNumber && firstSubOrderNumber.trim() ? firstSubOrderNumber : undefined,
          remoteNumber: firstSubOrderRemote
        }
      }
    }
    
    const subOrderNumber = (mvrSubOrder?.number && mvrSubOrder.number.trim()) || mvrSubOrder?.remoteNumber || ''
    const remoteSubOrderNumber = mvrSubOrder?.remoteNumber

    // Extract order numbers from completeOrder attributes
    const result: ParsedMvrResult = {
      orderNumber,
      subOrderNumber,
      remoteOrderNumber: orderRemoteNumber,
      remoteSubOrderNumber,
      timeOrdered: mvrSubOrder?.timeOrdered || extractXmlValue(xml, 'time_ordered'),
      timeFilled: mvrSubOrder?.timeFilled || extractXmlValue(xml, 'time_filled'),
      filledStatus: mvrSubOrder?.filledStatus,
      filledCode: mvrSubOrder?.filledCode,
      heldForReview: mvrSubOrder?.heldForReview || false,
      heldForReleaseForm: mvrSubOrder?.heldForReleaseForm || false,
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
    // IMPORTANT: Extract from the MVR subOrder content, not the entire XML
    // This prevents matching wrong tags (e.g., empty dlnum in subject block)
    if (mvrSubOrder?.content) {
      result.licenseNumber = extractXmlValue(mvrSubOrder.content, 'dlnum')
      result.licenseState = extractXmlValue(mvrSubOrder.content, 'dlstate')
      result.licenseExpirationDate = extractXmlValue(mvrSubOrder.content, 'dlexpiration') // YYYYMMDD format
    } else {
      // Fallback: try to extract from entire XML (but this is less reliable)
      result.licenseNumber = extractXmlValue(xml, 'dlnum')
      result.licenseState = extractXmlValue(xml, 'dlstate')
      result.licenseExpirationDate = extractXmlValue(xml, 'dlexpiration') // YYYYMMDD format
    }

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
 * Find MVR subOrder in XML - looks for type="MVR" or matches by description
 * Returns subOrder info including number/remote_number with proper fallback
 */
function findMvrSubOrder(xml: string): {
  number?: string
  remoteNumber?: string
  timeOrdered?: string
  timeFilled?: string
  filledStatus?: string
  filledCode?: string
  heldForReview?: boolean
  heldForReleaseForm?: boolean
  content?: string // The subOrder XML content for extracting dlnum/dlstate
} | null {
  // Match all subOrder tags
  const subOrderRegex = /<subOrder([^>]*)>([\s\S]*?)<\/subOrder>/gi
  let match
  
  while ((match = subOrderRegex.exec(xml)) !== null) {
    const attributes = match[1]
    const content = match[2]
    
    // Check if this is an MVR subOrder by type attribute
    const typeMatch = attributes.match(/type=["']([^"']*)["']/i)
    const type = typeMatch ? typeMatch[1].toUpperCase() : ''
    
    // Check description for MVR indicators
    const descMatch = attributes.match(/description=["']([^"']*)["']/i)
    const description = descMatch ? descMatch[1].toUpperCase() : ''
    
    // Also check content for MVR indicators (dlnum, dlstate are MVR-specific)
    const hasMvrContent = content.includes('<dlnum>') || content.includes('<dlstate>')
    
    // If this looks like an MVR subOrder (type="MVR" or has MVR content/description)
    if (type === 'MVR' || hasMvrContent || description.includes('MVR') || description.includes('MOTOR VEHICLE')) {
      // Extract number and remote_number
      const numberMatch = attributes.match(/number=["']([^"']*)["']/i)
      const number = numberMatch ? numberMatch[1].trim() : ''
      
      const remoteNumberMatch = attributes.match(/remote_number=["']([^"']*)["']/i)
      const remoteNumber = remoteNumberMatch ? remoteNumberMatch[1].trim() : undefined
      
      // Extract other attributes
      const filledStatusMatch = attributes.match(/filledStatus=["']([^"']*)["']/i)
      const filledCodeMatch = attributes.match(/filledCode=["']([^"']*)["']/i)
      const heldForReviewMatch = attributes.match(/held_for_review=["']([^"']*)["']/i)
      const heldForReleaseMatch = attributes.match(/held_for_release_form=["']([^"']*)["']/i)
      
      // Extract time values from content
      const timeOrdered = extractXmlValue(content, 'time_ordered')
      const timeFilled = extractXmlValue(content, 'time_filled')
      
      return {
        number: number || undefined, // Return undefined if empty, not empty string
        remoteNumber,
        timeOrdered,
        timeFilled,
        filledStatus: filledStatusMatch ? filledStatusMatch[1] : undefined,
        filledCode: filledCodeMatch ? filledCodeMatch[1] : undefined,
        heldForReview: heldForReviewMatch ? heldForReviewMatch[1] === 'Y' : false,
        heldForReleaseForm: heldForReleaseMatch ? heldForReleaseMatch[1] === 'Y' : false,
        content // Return the subOrder content so we can extract dlnum/dlstate from it
      }
    }
  }
  
  // If no MVR subOrder found by type/description, return null
  // The caller should handle this case
  return null
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

