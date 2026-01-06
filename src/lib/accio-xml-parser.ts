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
  medicalCertIssueDate?: string
  medicalCertStatus?: string
  medicalCertSelfCertification?: string // e.g., "NON-EXCEPTED INTERSTATE"
  
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
  issueDate?: string           // license_issue_date (YYYYMMDD) - "Issued" date
  originalIssueDate?: string   // Original issue date (YYYYMMDD) - "Orig. Issued" date
  expirationDate?: string      // license_expiration_date (YYYYMMDD)
  class?: string               // license_class (e.g., "B", "C", "D")
  classDescription?: string    // Full description (e.g., "CDL SINGLE VEH GVWR 26,001 OR MORE")
  code?: string                // license_code
  type?: string                // license_type (e.g., "COMMERCIAL", "PERSONAL")
  status?: string              // license_status (e.g., "VALID", "SUSPENDED")
  cdlStatus?: string           // Separate CDL status field
  endorsements?: string        // license_endorsements (comma-separated: Hazmat, Tanker, etc.)
  restrictions?: string        // license_restrictions (e.g., "CORR LENSES")
}

export interface Violation {
  date?: string               // Issue/violation date
  convictionDate?: string     // Conviction date (often different from issue date)
  type?: string               // Violation type code
  description?: string        // Full description (e.g., "NO OR IMPROPER LIGHTS")
  points?: number             // Points assessed
  state?: string              // State where violation occurred
  acdCode?: string            // ACD (AAMVA Code Dictionary) code (e.g., "E55")
  stateCode?: string          // State-specific code
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
 * Supports multiple Accio XML formats:
 * 1. <ScreeningResults><completeOrder>...</completeOrder></ScreeningResults> (full order completion)
 * 2. <postResults order="..." subOrder="...">...</postResults> (individual result notification)
 */
export function parseAccioMvrResult(xml: string): ParsedMvrResult {
  try {
    // First, check if this is a <postResults> format (simpler, used for individual results)
    // Example: <postResults order="53901" subOrder="893073" type="MVR" filledStatus="filled" filledCode="discrepancy">
    const isPostResultsFormat = xml.includes('<postResults')
    
    let orderNumber = ''
    let subOrderNumber = ''
    let orderRemoteNumber: string | undefined
    let remoteSubOrderNumber: string | undefined
    let filledStatus: string | undefined
    let filledCode: string | undefined
    let timeOrdered: string | undefined
    let timeFilled: string | undefined
    let mvrSubOrder: {
      number?: string
      remoteNumber?: string
      timeOrdered?: string
      timeFilled?: string
      filledStatus?: string
      filledCode?: string
      heldForReview?: boolean
      heldForReleaseForm?: boolean
      content?: string
    } | null = null
    
    if (isPostResultsFormat) {
      // Parse <postResults> format - order info is in the root element attributes
      // <postResults order="53901" subOrder="893073" type="MVR" filledStatus="filled" filledCode="discrepancy">
      orderNumber = extractXmlAttribute(xml, 'postResults', 'order') || ''
      subOrderNumber = extractXmlAttribute(xml, 'postResults', 'subOrder') || ''
      filledStatus = extractXmlAttribute(xml, 'postResults', 'filledStatus')
      filledCode = extractXmlAttribute(xml, 'postResults', 'filledCode')
      
      // These are Accio's internal numbers - store them as remote numbers for matching
      orderRemoteNumber = orderNumber
      remoteSubOrderNumber = subOrderNumber
      
      // Time fields are still in regular tags
      timeOrdered = extractXmlValue(xml, 'time_ordered')
      timeFilled = extractXmlValue(xml, 'time_filled')
      
      console.log('[ACCIO PARSER] Detected postResults format - order:', orderNumber, 'subOrder:', subOrderNumber)
    } else {
      // Parse <completeOrder> or <order> format
      // Extract order number from completeOrder - try multiple tag names
      // Priority: reference_number > number (usually contains our order number) > remote_number (Accio's internal number)
      let orderReferenceNumber = extractXmlAttribute(xml, 'completeOrder', 'reference_number')
      let orderNumberAttr = extractXmlAttribute(xml, 'completeOrder', 'number')
      orderRemoteNumber = extractXmlAttribute(xml, 'completeOrder', 'remote_number')
      
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
      orderNumber = (orderReferenceNumber && orderReferenceNumber.trim()) 
        || (orderNumberAttr && orderNumberAttr.trim()) 
        || orderInfoNumber
        || orderRemoteNumber // Use remote_number as fallback - webhook can match by this
        || ''
      
      // Find MVR subOrder specifically - look for type="MVR" or check all subOrders
      mvrSubOrder = findMvrSubOrder(xml)
      
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
      
      subOrderNumber = (mvrSubOrder?.number && mvrSubOrder.number.trim()) || mvrSubOrder?.remoteNumber || ''
      remoteSubOrderNumber = mvrSubOrder?.remoteNumber
      timeOrdered = mvrSubOrder?.timeOrdered || extractXmlValue(xml, 'time_ordered')
      timeFilled = mvrSubOrder?.timeFilled || extractXmlValue(xml, 'time_filled')
      filledStatus = mvrSubOrder?.filledStatus
      filledCode = mvrSubOrder?.filledCode
    }

    // Build result object
    const result: ParsedMvrResult = {
      orderNumber,
      subOrderNumber,
      remoteOrderNumber: orderRemoteNumber,
      remoteSubOrderNumber,
      timeOrdered,
      timeFilled,
      filledStatus,
      filledCode,
      heldForReview: false,
      heldForReleaseForm: false,
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

    // Extract mvr_accident blocks
    result.accidents = extractMvrAccidents(xml)
    result.accidentCount = result.accidents?.length || 0

    // Extract mvr_suspension blocks
    result.suspensions = extractMvrSuspensions(xml)
    result.suspensionCount = result.suspensions?.length || 0

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
    // First try structured tags
    result.medicalCertExpiration = extractXmlValue(xml, 'medical_cert_expiration')
    result.medicalCertStatus = extractXmlValue(xml, 'medical_cert_status')
    
    // If not found in structured tags, try to extract from <text> block
    // Accio puts medical info in plain text like:
    // "MEDICAL CERTIFICATE INFORMATION   Issue: 06/04/2024   Expiration: 06/02/2026"
    // "Status:   CERTIFIED   Self Certificate: NON-EXCEPTED INTERSTATE."
    if (!result.medicalCertExpiration || !result.medicalCertStatus) {
      try {
        const textBlock = extractXmlValue(xml, 'text')
        if (textBlock) {
          const medicalInfo = extractMedicalInfoFromText(textBlock)
          if (medicalInfo.expiration && !result.medicalCertExpiration) {
            result.medicalCertExpiration = medicalInfo.expiration
          }
          if (medicalInfo.status && !result.medicalCertStatus) {
            result.medicalCertStatus = medicalInfo.status
          }
          if (medicalInfo.issueDate) {
            result.medicalCertIssueDate = medicalInfo.issueDate
          }
          if (medicalInfo.selfCertification) {
            result.medicalCertSelfCertification = medicalInfo.selfCertification
          }
        }
      } catch (textParseError) {
        // Non-critical - just log and continue
        console.warn('[ACCIO PARSER] Could not parse medical info from text block:', textParseError)
      }
    }

    return result
  } catch (error: any) {
    console.error('[ACCIO PARSER] Error parsing XML:', error?.message || error)
    console.error('[ACCIO PARSER] Error stack:', error?.stack)
    console.error('[ACCIO PARSER] XML sample (first 500 chars):', xml?.substring(0, 500))
    throw new Error(`Failed to parse Accio XML result: ${error?.message || 'Unknown error'}`)
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
 * Based on real MVR XML structure from Accio:
 * <mvr_license>
 *   <license_issue_date>20250113</license_issue_date>
 *   <license_orig_issue>10/07/2019</license_orig_issue>
 *   <license_expiration_date>20271001</license_expiration_date>
 *   <license_class>B - CDL SINGLE VEH GVWR 26,001 OR MORE,UNDER 10K TOW</license_class>
 *   <license_code>REGULAR CDL LICENSE</license_code>
 *   <license_type>COMMERCIAL</license_type>
 *   <license_status>VAL-VALID</license_status>
 *   <license_restrictions>CORR LENSES</license_restrictions>
 * </mvr_license>
 */
function extractMvrLicenses(xml: string): MvrLicense[] {
  const licenses: MvrLicense[] = []
  
  // Match all <mvr_license> blocks
  const licenseRegex = /<mvr_license[^>]*>([\s\S]*?)<\/mvr_license>/gi
  let match
  
  while ((match = licenseRegex.exec(xml)) !== null) {
    const licenseXml = match[1]
    
    // Get the full class string (e.g., "B - CDL SINGLE VEH GVWR 26,001 OR MORE,UNDER 10K TOW")
    const fullClass = extractXmlValue(licenseXml, 'license_class')
    
    // Parse class letter and description from combined field
    // Format: "B - CDL SINGLE VEH..." or just "D - OPERATOR"
    let classLetter = ''
    let classDescription = ''
    if (fullClass) {
      const classParts = fullClass.split(' - ')
      classLetter = classParts[0]?.trim() || fullClass
      classDescription = classParts.slice(1).join(' - ').trim() || ''
    }
    
    // Get original issue date - Accio uses "license_orig_issue" in MM/DD/YYYY format
    const origIssue = extractXmlValue(licenseXml, 'license_orig_issue')
    let originalIssueDateFormatted = origIssue
    // Convert MM/DD/YYYY to YYYYMMDD for consistency
    if (origIssue && origIssue.includes('/')) {
      const parts = origIssue.split('/')
      if (parts.length === 3) {
        originalIssueDateFormatted = `${parts[2]}${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}`
      }
    }
    
    const license: MvrLicense = {
      issueDate: extractXmlValue(licenseXml, 'license_issue_date'),
      originalIssueDate: originalIssueDateFormatted,
      expirationDate: extractXmlValue(licenseXml, 'license_expiration_date'),
      class: classLetter,
      classDescription: classDescription,
      code: extractXmlValue(licenseXml, 'license_code'),
      type: extractXmlValue(licenseXml, 'license_type'),
      status: extractXmlValue(licenseXml, 'license_status'),
      cdlStatus: extractXmlValue(licenseXml, 'cdl_status'),
      endorsements: extractXmlValue(licenseXml, 'license_endorsements'),
      restrictions: extractXmlValue(licenseXml, 'license_restrictions')
    }
    
    // Only add if we have at least a class or type
    if (license.class || license.type || license.status) {
      licenses.push(license)
    }
  }
  
  return licenses
}

/**
 * Extract all mvr_violation blocks from XML
 * Based on real MVR report structure - includes conviction dates, ACD codes, etc.
 */
function extractMvrViolations(xml: string): Violation[] {
  const violations: Violation[] = []
  
  // Try multiple tag patterns that Accio might use
  const tagPatterns = [
    /<mvr_violation[^>]*>([\s\S]*?)<\/mvr_violation>/gi,
    /<violation[^>]*>([\s\S]*?)<\/violation>/gi,
    /<VIOLATION[^>]*>([\s\S]*?)<\/VIOLATION>/gi
  ]
  
  for (const regex of tagPatterns) {
    let match
    while ((match = regex.exec(xml)) !== null) {
      const violationXml = match[1]
      
      // Parse violation date (YYYYMMDD format or various formats)
      const violationDate = extractXmlValue(violationXml, 'violation_date')
        || extractXmlValue(violationXml, 'issue_date')
        || extractXmlValue(violationXml, 'date')
      
      // Conviction date is often different from issue date
      const convictionDate = extractXmlValue(violationXml, 'conviction_date')
        || extractXmlValue(violationXml, 'disposed_date')
      
      // Parse points (vendor_points or state_points)
      const vendorPoints = extractXmlValue(violationXml, 'vendor_points')
      const statePoints = extractXmlValue(violationXml, 'state_points')
      const pointsStr = extractXmlValue(violationXml, 'points')
      const points = vendorPoints 
        ? parseInt(vendorPoints, 10) 
        : (statePoints ? parseInt(statePoints, 10) : (pointsStr ? parseInt(pointsStr, 10) : undefined))
      
      // ACD code (AAMVA Code Dictionary) - standardized violation codes
      const acdCode = extractXmlValue(violationXml, 'acd_code')
        || extractXmlValue(violationXml, 'ACD')
        || extractXmlValue(violationXml, 'aamva_code')
      
      const stateCode = extractXmlValue(violationXml, 'state_code')
        || extractXmlValue(violationXml, 'local_code')
      
      const violation: Violation = {
        date: violationDate,
        convictionDate,
        type: extractXmlValue(violationXml, 'violation_type')
          || extractXmlValue(violationXml, 'type'),
        description: extractXmlValue(violationXml, 'description') 
          || extractXmlValue(violationXml, 'state_description')
          || extractXmlValue(violationXml, 'violation_description'),
        points: isNaN(points as number) ? undefined : points,
        state: extractXmlValue(violationXml, 'state')
          || extractXmlValue(violationXml, 'state_of_violation')
          || extractXmlValue(violationXml, 'jurisdiction'),
        acdCode,
        stateCode
      }
      
      // Only add if we have at least some data
      if (violation.date || violation.description || violation.type) {
        violations.push(violation)
      }
    }
  }
  
  return violations
}

/**
 * Extract all mvr_accident blocks from XML
 * Based on real MVR report structure - accidents may include date, severity, fault, description
 */
function extractMvrAccidents(xml: string): Accident[] {
  const accidents: Accident[] = []
  
  // Try multiple tag patterns that Accio might use
  const tagPatterns = [
    /<mvr_accident[^>]*>([\s\S]*?)<\/mvr_accident>/gi,
    /<accident[^>]*>([\s\S]*?)<\/accident>/gi,
    /<ACCIDENT[^>]*>([\s\S]*?)<\/ACCIDENT>/gi
  ]
  
  for (const regex of tagPatterns) {
    let match
    while ((match = regex.exec(xml)) !== null) {
      const accidentXml = match[1]
      
      // Try multiple field name variations
      const accident: Accident = {
        date: extractXmlValue(accidentXml, 'accident_date') 
          || extractXmlValue(accidentXml, 'date')
          || extractXmlValue(accidentXml, 'incident_date'),
        severity: extractXmlValue(accidentXml, 'severity')
          || extractXmlValue(accidentXml, 'accident_severity'),
        fault: extractXmlValue(accidentXml, 'fault')
          || extractXmlValue(accidentXml, 'at_fault')
          || extractXmlValue(accidentXml, 'fault_indicator'),
        description: extractXmlValue(accidentXml, 'description')
          || extractXmlValue(accidentXml, 'accident_description')
          || extractXmlValue(accidentXml, 'state_description')
      }
      
      // Only add if we have at least some data
      if (accident.date || accident.description || accident.severity) {
        accidents.push(accident)
      }
    }
  }
  
  return accidents
}

/**
 * Extract all mvr_suspension blocks from XML
 * Based on real MVR report structure - suspensions may include date, reason, end date, state
 */
function extractMvrSuspensions(xml: string): Suspension[] {
  const suspensions: Suspension[] = []
  
  // Try multiple tag patterns that Accio might use
  const tagPatterns = [
    /<mvr_suspension[^>]*>([\s\S]*?)<\/mvr_suspension>/gi,
    /<suspension[^>]*>([\s\S]*?)<\/suspension>/gi,
    /<SUSPENSION[^>]*>([\s\S]*?)<\/SUSPENSION>/gi,
    /<license_suspension[^>]*>([\s\S]*?)<\/license_suspension>/gi
  ]
  
  for (const regex of tagPatterns) {
    let match
    while ((match = regex.exec(xml)) !== null) {
      const suspensionXml = match[1]
      
      // Try multiple field name variations
      const suspension: Suspension = {
        date: extractXmlValue(suspensionXml, 'suspension_date')
          || extractXmlValue(suspensionXml, 'start_date')
          || extractXmlValue(suspensionXml, 'date')
          || extractXmlValue(suspensionXml, 'effective_date'),
        reason: extractXmlValue(suspensionXml, 'reason')
          || extractXmlValue(suspensionXml, 'suspension_reason')
          || extractXmlValue(suspensionXml, 'description'),
        endDate: extractXmlValue(suspensionXml, 'end_date')
          || extractXmlValue(suspensionXml, 'reinstatement_date')
          || extractXmlValue(suspensionXml, 'expiration_date'),
        state: extractXmlValue(suspensionXml, 'state')
          || extractXmlValue(suspensionXml, 'state_code')
      }
      
      // Only add if we have at least some data
      if (suspension.date || suspension.reason) {
        suspensions.push(suspension)
      }
    }
  }
  
  return suspensions
}

/**
 * Extract medical certificate info from plain text block
 * Parses text like:
 * "MEDICAL CERTIFICATE INFORMATION   Issue: 06/04/2024   Expiration: 06/02/2026"
 * "Status:   CERTIFIED   Self Certificate: NON-EXCEPTED INTERSTATE."
 */
function extractMedicalInfoFromText(text: string): {
  issueDate?: string
  expiration?: string
  status?: string
  selfCertification?: string
} {
  const result: {
    issueDate?: string
    expiration?: string
    status?: string
    selfCertification?: string
  } = {}
  
  // Look for "Issue: MM/DD/YYYY"
  const issueMatch = text.match(/Issue:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (issueMatch) {
    result.issueDate = issueMatch[1]
  }
  
  // Look for "Expiration: MM/DD/YYYY"
  const expirationMatch = text.match(/Expiration:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (expirationMatch) {
    result.expiration = expirationMatch[1]
  }
  
  // Look for "Status: CERTIFIED" or similar
  // Pattern: "Status:" followed by whitespace and then a word
  const statusMatch = text.match(/Status:\s*([A-Z]+)/i)
  if (statusMatch) {
    result.status = statusMatch[1]
  }
  
  // Look for "Self Certificate: NON-EXCEPTED INTERSTATE" or similar
  const selfCertMatch = text.match(/Self Certificate:\s*([A-Z\-\s]+)(?:\.|$)/i)
  if (selfCertMatch) {
    result.selfCertification = selfCertMatch[1].trim()
  }
  
  return result
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
      certIssueDate: result.medicalCertIssueDate,
      certStatus: result.medicalCertStatus,
      selfCertification: result.medicalCertSelfCertification
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

