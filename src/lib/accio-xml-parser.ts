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

  /**
   * The DMV's own "As of" timestamp from the report text block. Distinct from
   * `timeOrdered` / `timeFilled` (which are Accio's clock) — `dmvAsOfDate` is
   * when the **state DMV pulled the record**. Employers care about this for
   * recency ("how stale is this MVR?"). Format mirrors the source text, e.g.
   * "5/8/2026 1:10:25 PM".
   */
  dmvAsOfDate?: string

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

  /**
   * DMV-reported personal characteristics. These come from the text block
   * (Accio doesn't put them in structured tags) and can be missing on partial
   * fills. Sex/Weight/Eyes/Height/Hair/Donor are all best-effort — render a
   * field only when present, never fabricate. `age` is computed from `<dob>`,
   * NOT scraped from the text, so it stays accurate as time passes.
   */
  personalCharacteristics?: {
    sex?: string
    weight?: string        // raw DMV string ("165", "220 lbs") — display as-is
    height?: string        // e.g. `5' 08"`
    eyes?: string          // e.g. "BROWN", "BRO"
    hair?: string
    donor?: string         // organ donor flag — usually "Y"/blank
    age?: number           // computed from subject.dateOfBirth
  }

  /**
   * Medical examiner details from the MEDICAL EXAMINER INFORMATION text section.
   * Only populated for CDL drivers whose state includes examiner info in the report.
   */
  medicalExaminer?: {
    name?: string
    licenseNumber?: string
    licenseJurisdiction?: string
    nationalRegistryNumber?: string
    phone?: string
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
      
      // Extract the opening tag to parse attributes more reliably
      const postResultsTagMatch = xml.match(/<postResults([^>]*)>/i)
      const postResultsAttrs = postResultsTagMatch ? postResultsTagMatch[1] : ''
      
      // Parse order attribute (NOT subOrder) - use specific regex with word boundary
      const orderMatch = postResultsAttrs.match(/\border=["']([^"']+)["']/i)
      orderNumber = orderMatch ? orderMatch[1] : ''
      
      // Parse subOrder attribute separately
      const subOrderMatch = postResultsAttrs.match(/\bsubOrder=["']([^"']+)["']/i)
      subOrderNumber = subOrderMatch ? subOrderMatch[1] : ''
      
      filledStatus = extractXmlAttribute(xml, 'postResults', 'filledStatus')
      filledCode = extractXmlAttribute(xml, 'postResults', 'filledCode')
      
      // These are Accio's internal numbers - store them as remote numbers for matching
      orderRemoteNumber = orderNumber
      remoteSubOrderNumber = subOrderNumber
      
      // Time fields are still in regular tags
      timeOrdered = extractXmlValue(xml, 'time_ordered')
      timeFilled = extractXmlValue(xml, 'time_filled')
      
      console.log('[ACCIO PARSER] Detected postResults format')
      console.log('[ACCIO PARSER] postResults attrs:', postResultsAttrs)
      console.log('[ACCIO PARSER] Parsed order:', orderNumber, 'subOrder:', subOrderNumber)
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

    // Build result object — propagate held_for_* flags from the matched
    // subOrder so deriveScreeningStatus can route held reports to needs_review.
    const result: ParsedMvrResult = {
      orderNumber,
      subOrderNumber,
      remoteOrderNumber: orderRemoteNumber,
      remoteSubOrderNumber,
      timeOrdered,
      timeFilled,
      filledStatus,
      filledCode,
      heldForReview: mvrSubOrder?.heldForReview ?? false,
      heldForReleaseForm: mvrSubOrder?.heldForReleaseForm ?? false,
      rawXml: xml
    }

    // Extract subject information (personal info from subject block)
    const subjectXml = extractXmlBlock(xml, 'subject')
    if (subjectXml) {
      const rawState = extractXmlValue(subjectXml, 'state')
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
        // Reject suspiciously long values — state names/codes are ≤20 chars.
        // Some XML formats nest other blocks inside <subject>, causing the generic
        // extractor to grab entire XML fragments instead of a state abbreviation.
        state: rawState && rawState.length <= 20 ? rawState : undefined,
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

    // Medical certificate info (only meaningful for CDL drivers — DOT med card
    // is required for CMV operators per 49 CFR §391.41-43).
    //
    // Two-step extract:
    //   1. Try Accio's structured tags (some states populate them directly).
    //   2. If absent, fall back to the human-readable text block — but ONLY
    //      after scoping to the "MEDICAL CERTIFICATE INFORMATION" section.
    //      A previous version ran the regexes against the entire text block,
    //      which on Class D drivers (no med cert) silently grabbed the
    //      LICENSE's "Status: VALID" and labelled it the med cert status.
    //      See `extractMedicalInfoFromText` for details.
    const rawStructuredStatus = extractXmlValue(xml, 'medical_cert_status')
    const rawStructuredExpiration = extractXmlValue(xml, 'medical_cert_expiration')
    if (isMeaningfulMedCertStatus(rawStructuredStatus)) {
      result.medicalCertStatus = rawStructuredStatus
    }
    if (rawStructuredExpiration) {
      result.medicalCertExpiration = rawStructuredExpiration
    }

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
          if (medicalInfo.issueDate && !result.medicalCertIssueDate) {
            result.medicalCertIssueDate = medicalInfo.issueDate
          }
          if (medicalInfo.selfCertification && !result.medicalCertSelfCertification) {
            result.medicalCertSelfCertification = medicalInfo.selfCertification
          }
        }
      } catch (textParseError) {
        // Non-critical — log and continue. The structured tags above (when
        // present) are the canonical source; the text block is only a fallback
        // for state DMVs that don't populate structured fields.
        console.warn('[ACCIO PARSER] Could not parse medical info from text block:', textParseError)
      }
    }

    // Personal characteristics + DMV "As of" date + per-license CDL status all
    // live ONLY in the text block — Accio doesn't expose them as structured
    // tags. Same scoping discipline as the medical extractor: be defensive
    // (text can be empty / partial) and never fabricate values.
    try {
      const mvrTextBlock = mvrSubOrder?.content
        ? extractXmlValue(mvrSubOrder.content, 'text')
        : extractXmlValue(xml, 'text')
      if (mvrTextBlock) {
        const characteristics = extractPersonalCharacteristicsFromText(mvrTextBlock)
        // Compute age from DOB (subject.dateOfBirth = YYYYMMDD) so it stays
        // current — using the text's "AGE: 56" would go stale.
        const age = computeAgeFromYmd(result.subject?.dateOfBirth)
        if (
          characteristics.sex ||
          characteristics.weight ||
          characteristics.height ||
          characteristics.eyes ||
          characteristics.hair ||
          characteristics.donor ||
          age !== undefined
        ) {
          result.personalCharacteristics = { ...characteristics, age }
        }

        const asOf = extractAsOfDateFromText(mvrTextBlock)
        if (asOf) result.dmvAsOfDate = asOf

        // Promote text-block "CDL Status" onto the primary license when the
        // structured `<cdl_status>` tag is absent (most states leave it blank).
        const cdlStatus = extractCdlStatusFromText(mvrTextBlock)
        if (cdlStatus && result.licenses && result.licenses.length > 0 && !result.licenses[0].cdlStatus) {
          result.licenses[0].cdlStatus = cdlStatus
        }

        // Text-block license fallback: some states don't emit `<mvr_license>`
        // XML blocks but do include structured license info in the text.
        if (!result.licenses || result.licenses.length === 0) {
          const textLicenses = extractLicensesFromText(mvrTextBlock)
          if (textLicenses.length > 0) result.licenses = textLicenses
        }

        // Text-block endorsement fallback: when XML `<license_endorsements>` is
        // empty, pull from the ENDORSEMENTS section of the text report.
        if (result.licenses && result.licenses.length > 0 && !result.licenses[0].endorsements) {
          const textEndorsements = extractEndorsementsFromText(mvrTextBlock)
          if (textEndorsements) result.licenses[0].endorsements = textEndorsements
        }

        // Medical examiner info lives only in the text block.
        const examiner = extractMedicalExaminerFromText(mvrTextBlock)
        if (examiner) result.medicalExaminer = examiner
      }
    } catch (textParseError) {
      console.warn('[ACCIO PARSER] Could not parse personal/asof/cdl from text block:', textParseError)
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
  // Use word boundary or space/quote before attribute name to prevent partial matches
  // e.g., "order" should not match "subOrder"
  const regex = new RegExp(`<${tagName}[^>]*[\\s"']${attributeName}=["']([^"']*)["']`, 'i')
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
 * Allow-list of status values that mean "this driver actually has a real DOT
 * medical certificate." Conservative on purpose — we'd rather hide a med cert
 * we don't recognize than display the LICENSE's `Status: VALID` as a med card
 * (the original Class D bug). Add new vocab here as we see it from real
 * Accio fills.
 *
 * NOT in this set on purpose:
 *  - "VALID" / "SUSPENDED" / "REVOKED" / "CANCELLED" / "EXPIRED" — those are
 *    license statuses, not med cert statuses. If they show up in the med cert
 *    field it's the bug we're patching.
 *  - "NOT CERTIFIED" / "NOT REQUIRED" / "NONE" / "N/A" / "UNKNOWN" — Class D
 *    and other non-CDL drivers.
 */
const VALID_MED_CERT_STATUSES = new Set([
  'CERTIFIED',
  'EXEMPT',
  'EXEMPT INTRASTATE',
  'EXEMPT INTERSTATE',
  'VOLUNTARY',
])

// Plain boolean return (not a type predicate) on purpose: a non-meaningful
// status is still a string, so we don't want callers' `else` branches to
// narrow `status` to `never`.
function isMeaningfulMedCertStatus(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toUpperCase()
  if (!normalized) return false
  if (VALID_MED_CERT_STATUSES.has(normalized)) return true
  // Heuristic: anything starting with "CERT" (CERTIFIED, CERTIFICATE ON FILE,
  // CERTIFIED-MEDICAL VARIANCE, etc.) is med cert vocabulary. Pulled out so
  // we don't have to keep enumerating every state's exact phrasing.
  return normalized.startsWith('CERT')
}

/**
 * True iff this driver has a real DOT medical certificate on file. Use this
 * to gate the entire "Medical Certificate" section in the UI and PDF — for
 * Class D / non-CDL drivers (and existing rows with bogus "VALID" data left
 * over from the May 2026 parser bug), this returns false so the section is
 * hidden instead of misrepresenting license info as a med card.
 */
export function hasValidMedicalCert(
  status: string | null | undefined,
  expiration: string | null | undefined,
): boolean {
  if (isMeaningfulMedCertStatus(status)) return true
  // Some state DMVs return only the expiration and leave status blank. Accept
  // a bare expiration only if there's no conflicting bad status (we don't want
  // to "rescue" a bogus row that has status="VALID" + expiration=license-exp).
  if (status && status.trim()) return false
  return Boolean(expiration && expiration.trim())
}

/**
 * Extract medical certificate fields from Accio's plain-text report block.
 *
 * Accio structures each report as alternating section headers separated by
 * 100-underscore rules, e.g.:
 *
 *   ___________________________________________________________________
 *      MEDICAL CERTIFICATE INFORMATION
 *   ___________________________________________________________________
 *   Description: ...   Issue: 06/04/2024   Expiration: 06/02/2026
 *   Status:   CERTIFIED   Self Certificate: NON-EXCEPTED INTERSTATE.
 *   ___________________________________________________________________
 *      VIOLATIONS
 *   ...
 *
 * We MUST scope every regex to the text BETWEEN the medical header and the
 * next underscore rule. A previous version ran each regex against the full
 * text block — on Class D drivers (whose medical section says "NOT CERTIFIED"
 * with empty Issue/Expiration), the unscoped `Status:` regex grabbed the
 * LICENSE section's `Status: VALID` instead, falsely showing the driver as
 * having a valid med card.
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

  // 1. Find the medical block. Header line is "MEDICAL CERTIFICATE INFORMATION"
  //    sandwiched between underscore rules. We grab everything up to the next
  //    rule of >=20 underscores (real reports use 100 but we're tolerant).
  const blockMatch = text.match(
    /MEDICAL CERTIFICATE INFORMATION[^\n]*\n_{20,}\s*([\s\S]*?)(?:\n_{20,}|$)/i,
  )
  if (!blockMatch) return result
  const block = blockMatch[1]

  // 2. Issue: MM/DD/YYYY  (scoped — won't pick up "Issued: ..." from license)
  const issueMatch = block.match(/Issue:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (issueMatch) result.issueDate = issueMatch[1]

  // 3. Expiration: MM/DD/YYYY  (scoped — won't pick up "Expires: ..." from license)
  const expirationMatch = block.match(/Expiration:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (expirationMatch) result.expiration = expirationMatch[1]

  // 4. Status: ...  Capture multi-word values like "NOT CERTIFIED" by reading
  //    until either 2+ spaces (Accio's column separator) or end of line. Then
  //    drop "no med cert" sentinels so we don't render them as a real status.
  const statusMatch = block.match(/Status:\s+([^\n]*?)(?=\s{2,}\S|\s*$)/im)
  if (statusMatch) {
    const raw = statusMatch[1].trim()
    if (isMeaningfulMedCertStatus(raw)) {
      result.status = raw.toUpperCase()
    }
  }

  // 5. Self Certificate: ... (e.g. "NON-EXCEPTED INTERSTATE"). Empty value on
  //    Class D drivers — skip when blank.
  const selfCertMatch = block.match(/Self Certificate:\s*([^\n]*?)(?:\.|\n|$)/i)
  if (selfCertMatch) {
    const v = selfCertMatch[1].trim()
    if (v) result.selfCertification = v
  }

  return result
}

/**
 * Extract DMV-reported personal characteristics from Accio's plain-text block.
 *
 * The text block has a fixed two-line layout right under the address header:
 *
 *   Sex : MALE      Weight: 165        DOB: 01/05/1970            AGE: 56
 *   Eyes: BROWN     Height: 5' 08"     Hair: BROWN        Donor:
 *
 * Each "Label: VALUE" pair is separated by 2+ spaces from the next pair. We
 * grab each value up to either 2+ spaces (column boundary) or end-of-line.
 * All fields are best-effort — return undefined when missing rather than
 * fabricating empty strings (lets callers cleanly skip rendering).
 */
function extractPersonalCharacteristicsFromText(text: string): {
  sex?: string
  weight?: string
  height?: string
  eyes?: string
  hair?: string
  donor?: string
} {
  const result: {
    sex?: string
    weight?: string
    height?: string
    eyes?: string
    hair?: string
    donor?: string
  } = {}

  // Each capture stops at 2+ spaces (Accio's column separator) or end of line.
  // CRITICAL: use `[ \t]*` (not `\s*`) after `:` so the regex never crosses
  // newlines. The earlier `\s*` version caused Donor (which is the last
  // column on its line, often blank) to silently capture the underscore
  // separator line that follows. Each rule is anchored to its own line.
  // Donor is allowed to be blank → caller should test truthy before rendering.
  const rules: Array<[keyof typeof result, RegExp]> = [
    ['sex', /\bSex[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
    ['weight', /\bWeight[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
    // Height includes a quote ("5' 08\"") so we deliberately allow inner quotes.
    ['height', /\bHeight[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
    ['eyes', /\bEyes[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
    ['hair', /\bHair[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
    ['donor', /\bDonor[ \t]*:[ \t]*([^\n]*?)(?=[ \t]{2,}\S|[ \t]*$)/im],
  ]
  for (const [key, regex] of rules) {
    const m = text.match(regex)
    if (m) {
      const v = m[1].trim()
      // Reject underscore separators and values that look like the next column's
      // label (e.g. "Weight:", "Exp Date:"). This happens when a field is blank —
      // the `[ \t]*` after the colon eats all whitespace and positions the lazy
      // capture at the neighboring label instead of an empty string.
      if (v && !/^_+$/.test(v) && !/^[\w][\w\s]*:$/.test(v)) result[key] = v
    }
  }
  return result
}

/**
 * Extract the "As of: M/D/YYYY h:mm:ss AM/PM" timestamp the DMV stamps on the
 * report. We keep the raw string (don't try to normalize timezones) because
 * the DMV doesn't tell us what zone it's in — we just display it verbatim.
 *
 * Bug guard: use `[ \t]*` (not `\s*`) after the colon so the regex can't cross
 * a newline and capture an underscore separator row on states where the "As of"
 * field is blank (e.g. MO DRIVER NOT FOUND reports). Also reject values that
 * contain no digit — real timestamps always have at least one digit.
 */
function extractAsOfDateFromText(text: string): string | undefined {
  const m = text.match(/^\s*As\s*of\s*:[ \t]*([^\n]+?)\s*$/im)
  if (!m) return undefined
  const v = m[1].trim()
  if (!v || /^_+$/.test(v) || !/\d/.test(v)) return undefined
  return v
}

/**
 * Some states emit a separate "CDL Status: VALID" line in the text block but
 * don't populate `<cdl_status>` in the structured `<mvr_license>`. This pulls
 * just that line so the License section can show CDL status alongside the
 * regular license status.
 */
function extractCdlStatusFromText(text: string): string | undefined {
  const m = text.match(/^\s*CDL\s+Status\s*:\s*([^\n]+?)\s*$/im)
  return m ? m[1].trim().toUpperCase() : undefined
}

/**
 * Text-block license fallback for states that don't emit `<mvr_license>` XML.
 *
 * Parses the LICENSE AND PERMIT INFORMATION section (the underscore-delimited
 * block common to most state formats) into MvrLicense entries. Only called
 * when `extractMvrLicenses` returns an empty array.
 *
 * VA format example:
 *   License: COMMERCIAL    Orig. Issued:     Issued: 10/07/2025    Expires: 07/02/2033
 *   Status: LICENSED
 *   Class: A - ANY COMBINATION OF VEHICLES...
 */
function extractLicensesFromText(text: string): MvrLicense[] {
  // Scope to the LICENSE AND PERMIT INFORMATION block only.
  const blockMatch = text.match(
    /LICENSE AND PERMIT INFORMATION[^\n]*\n_{20,}\s*([\s\S]*?)(?:\n_{20,}|$)/i,
  )
  if (!blockMatch) return []

  const block = blockMatch[1]
  const typeLine = block.match(/^License:\s*([^\n]+)/im)
  if (!typeLine) return []

  // On some states "License:" is followed by the DL number (not the type).
  // If it looks alphanumeric-only (no spaces, mixed case) treat it as a number,
  // not a type description — and skip (the number is already on the order row).
  const rawType = typeLine[1].split(/\s{2,}/)[0]?.trim() ?? ''
  if (/^[A-Z0-9]{5,}$/.test(rawType)) return []

  // Dates may appear on the same line as "License: TYPE"
  const dateSource = typeLine[1]
  const origIssueMatch = dateSource.match(/Orig\.\s*Issued:\s*(\d[\d/]+)/i)
  const issuedMatch = dateSource.match(/(?<!Orig\.\s{0,5})Issued:\s*(\d[\d/]+)/i)
  const expiresMatch = dateSource.match(/Expires:\s*(\d[\d/]+)/i)

  const statusMatch = block.match(/^Status:\s*([^\n]+)/im)
  const classMatch = block.match(/^Class:\s*([^\n]+)/im)

  const classStr = classMatch?.[1]?.trim() ?? ''
  const parts = classStr.split(' - ')
  const classLetter = parts[0]?.trim() || undefined
  const classDescription = parts.slice(1).join(' - ').trim() || undefined

  const license: MvrLicense = {
    type: rawType || undefined,
    issueDate: issuedMatch?.[1] || undefined,
    originalIssueDate: origIssueMatch?.[1] || undefined,
    expirationDate: expiresMatch?.[1] || undefined,
    status: statusMatch?.[1]?.trim() || undefined,
    class: classLetter,
    classDescription,
  }

  return license.type || license.status || license.class ? [license] : []
}

/**
 * Extract endorsements from the ENDORSEMENTS text section as a fallback when
 * `<license_endorsements>` XML is empty.
 *
 * VA/typical format:
 *   ENDORSEMENTS
 *   ___
 *    Class: A  Lic. Type: COMMERCIAL
 *   |N TANK - N TANK|
 *
 * Each `|CODE DESC - CODE DESC|` line is one endorsement group.
 * Returns a comma-separated string matching the existing `endorsements` field type.
 */
function extractEndorsementsFromText(text: string): string | undefined {
  const blockMatch = text.match(/ENDORSEMENTS[^\n]*\n_{20,}\s*([\s\S]*?)(?:\n_{20,}|$)/i)
  if (!blockMatch) return undefined

  const block = blockMatch[1]
  const endorsements: string[] = []

  // Capture each pipe-delimited endorsement entry
  const entryRe = /\|([^|]+)\|/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(block)) !== null) {
    // "N TANK - N TANK" → deduplicate and normalize to "N TANK"
    const parts = m[1]
      .split(/\s*-\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
    const unique = [...new Set(parts)]
    endorsements.push(unique.join(', '))
  }

  return endorsements.length > 0 ? endorsements.join('; ') : undefined
}

/**
 * Extract medical examiner details from the MEDICAL EXAMINER INFORMATION text
 * section. This block appears on CDL driver records from states that include
 * examiner data (e.g. VA).
 *
 * VA format:
 *   Examiner full name: Seldat,Heather,,   MD License No: 0024180261   MD License jurisd: VIRGINIA
 *   MD Registry No: 6835767235
 */
function extractMedicalExaminerFromText(text: string): ParsedMvrResult['medicalExaminer'] {
  const blockMatch = text.match(
    /MEDICAL EXAMINER INFORMATION[^\n]*\n_{20,}\s*([\s\S]*?)(?:\n_{20,}|$)/i,
  )
  if (!blockMatch) return undefined

  const block = blockMatch[1]

  const nameMatch = block.match(/Examiner full name:\s*([^\n,]{2,}?)(?:\s{2,}|MD License|$)/im)
  const licNoMatch = block.match(/MD License No:\s*([^\s]+)/im)
  const licJurisdMatch = block.match(/MD License jurisd:\s*([^\n]+?)(?:\s{2,}|$)/im)
  const regNoMatch = block.match(/MD Registry No:\s*([^\s]+)/im)
  const phoneMatch = block.match(/Phone(?:\s+Number)?:\s*([^\n]+?)(?:\s{2,}|$)/im)

  // Clean up the name — Accio stores it as "Seldat,Heather,," (last,first,,suffix)
  let name: string | undefined
  if (nameMatch?.[1]) {
    const parts = nameMatch[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    name = parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts[0]
  }

  const result: ParsedMvrResult['medicalExaminer'] = {}
  if (name) result.name = name
  if (licNoMatch?.[1]) result.licenseNumber = licNoMatch[1].trim()
  if (licJurisdMatch?.[1]) result.licenseJurisdiction = licJurisdMatch[1].trim()
  if (regNoMatch?.[1]) result.nationalRegistryNumber = regNoMatch[1].trim()
  if (phoneMatch?.[1]) result.phone = phoneMatch[1].trim()

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Compute age in completed years from a YYYYMMDD birth-date string. We use
 * this instead of scraping "AGE: 56" from the text so the displayed age stays
 * accurate as time passes (an MVR pulled a year ago should show today's age,
 * not last year's).
 */
function computeAgeFromYmd(ymd?: string): number | undefined {
  if (!ymd || !/^\d{8}$/.test(ymd)) return undefined
  const year = Number(ymd.slice(0, 4))
  const month = Number(ymd.slice(4, 6))
  const day = Number(ymd.slice(6, 8))
  const today = new Date()
  let age = today.getUTCFullYear() - year
  const beforeBirthdayThisYear =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)
  if (beforeBirthdayThisYear) age -= 1
  return age >= 0 && age < 130 ? age : undefined
}

/**
 * Convert parsed result to JSONB format for database storage
 */
export function mvrResultToJsonb(result: ParsedMvrResult): Record<string, unknown> {
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
    dmvAsOfDate: result.dmvAsOfDate,
    personalCharacteristics: result.personalCharacteristics,
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
    medicalExaminer: result.medicalExaminer,
    fees: result.fees,
    status: {
      filledStatus: result.filledStatus,
      filledCode: result.filledCode,
      heldForReview: result.heldForReview,
      heldForReleaseForm: result.heldForReleaseForm
    }
  }
}

