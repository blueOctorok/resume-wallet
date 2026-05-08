/**
 * Accio XML Builder
 * Builds XML payloads for Accio API orders
 * Based on Accio XML schema from provided examples
 */

export interface AccioOrderData {
  // Driver Information
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  email: string
  phone?: string
  /**
   * Full 9-digit SSN (digits only, no dashes). Required by Accio for direct
   * identity verification — sending only the last 4 forces orders down a slow
   * applicant-portal verification path that can take hours instead of minutes.
   * Storm collects this at order time and never persists it (no `ssn` column
   * exists in our schema; verified `WHERE column_name ILIKE '%ssn%'`).
   */
  ssn: string
  dob: string // Format: YYYYMMDD
  gender?: 'M' | 'F' | 'U' // M = Male, F = Female, U = Unknown/Unspecified
  race?: string // U = Unknown (default)
  address: string
  city: string
  state: string // 2-letter state code (residential)
  zip: string
  jobState?: string // State where job will be performed (2-letter code)
  
  // License Information
  dlNumber: string
  dlState: string // 2-letter state code
  
  // Order Configuration
  orderNumber: string // Unique order number we generate
  mvrSearchType?: 'standard' | 'comprehensive'
  suppressApplicantEmail?: boolean // Suppress Accio's applicant portal email
  includeFmcsaCrashInspection?: boolean // Include FMCSA crash/inspection report
  /** When true, sets portalfromapplicant=Y (PSP / candidate-initiated flows). Default N for MVR-only. */
  portalFromApplicant?: boolean

  // Optional: Webhook Configuration
  webhookUrl?: string
  webhookGuid?: string
}

/**
 * Build Accio MVR order XML
 */
export function buildAccioMvrOrderXml(data: AccioOrderData): string {
  const {
    firstName,
    middleName,
    lastName,
    suffix,
    email,
    phone,
    ssn,
    dob,
    gender = 'U',
    race = 'U',
    address,
    city,
    state,
    zip,
    jobState,
    dlNumber,
    dlState,
    orderNumber,
    mvrSearchType = 'standard',
    suppressApplicantEmail = true,
    includeFmcsaCrashInspection = false,
    portalFromApplicant = false,
    webhookUrl,
    webhookGuid
  } = data

  // Get Accio credentials from environment
  const account = process.env.ACCIO_ACCOUNT || ''
  const username = process.env.ACCIO_USERNAME || ''
  const password = process.env.ACCIO_PASSWORD || ''
  const mode = process.env.ACCIO_MODE || 'PROD'

  // Format DOB (YYYYMMDD)
  const dobFormatted = dob.replace(/-/g, '').substring(0, 8)

  // Build XML - matching new Accio format exactly
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Accio_Order>
    <mode>${mode}</mode>
    <login>
        <account>${escapeXml(account)}</account>
        <!-- ATS master account name -->
        <username>${escapeXml(username)}</username>
        <!-- ATS master user name -->
        <password>${escapeXml(password)}</password>
        <!-- ATS master password -->
    </login>
    <placeOrder number="${orderNumber}">
        <mode>${mode}</mode>
        <SuppressApplicantPortalEmail>${suppressApplicantEmail ? 'Y' : 'N'}</SuppressApplicantPortalEmail>
        <orderInfo>
            <requester_name use_default="Y"/>
            <requester_phone use_default="Y"/>
            <requester_fax use_default="Y"/>
            <requester_email use_default="Y"/>
            <requester_billingdata/>
            <requester_billingdata2/>
            <requester_billingdata3/>
        </orderInfo>
        <package>A LA CARTE</package>
        <subject>
            <name_first>${escapeXml(firstName)}</name_first>
            ${middleName ? `<name_middle>${escapeXml(middleName)}</name_middle>` : '<name_middle/>'}
            <name_last>${escapeXml(lastName)}</name_last>
            ${suffix ? `<name_suffix>${escapeXml(suffix)}</name_suffix>` : '<name_suffix/>'}
            <email>${escapeXml(email)}</email>
            <ssn>${escapeXml(ssn)}</ssn>
            <dob>${dobFormatted}</dob>
            <gender>${gender}</gender>
            <race>${race}</race>
            ${phone ? `<phone_number>${escapeXml(phone)}</phone_number>` : '<phone_number>555-555-5555</phone_number>'}
            <address>${escapeXml(address)}</address>
            <city>${escapeXml(city)}</city>
            <state>${escapeXml(state)}</state>
            <zip>${escapeXml(zip)}</zip>
            ${jobState ? `<jobstate>${escapeXml(jobState)}</jobstate>` : `<jobstate>${escapeXml(state)}</jobstate>`}
            <citizenship_status>A citizen of the United States</citizenship_status>
            <FCRAPurpose>Employment by Hire or Contract</FCRAPurpose>
            <ApplicantID/>
            <RequisitionNumber/>
            <managerName/>
            <position_requested/>
            <drugscreen>N</drugscreen>
            <has_admitted_convictions>N</has_admitted_convictions>
            <admitted_conviction_details/>
            <portalfromapplicant>${portalFromApplicant ? 'Y' : 'N'}</portalfromapplicant>
            <!--
              require_ews: when portalfromapplicant=Y Accio defaults this to Y and
              parks the order waiting for the applicant to sign Accio's release form.
              We always send N because Storm collects FCRA disclosure on our side
              (psp_consents / bgcheck_consents) before the order is ever placed.
            -->
            <require_ews>N</require_ews>
        </subject>`

  // Add webhook configuration if provided.
  // postback_types: trimmed from CETA::IPC::EXP::CNF::OCR::RDC down to the three
  // we actually care about — IPC (in-progress completion), OCR (order completion),
  // RDC (results-delivery completion). The dropped types were generating noisy
  // intermediate webhook posts (confirmation, expirations) that we just 200-acked
  // without doing any work.
  if (webhookUrl && webhookGuid) {
    xml += `
        <postBackInfo>
            <URL>${escapeXml(webhookUrl)}</URL>
            <guID>${escapeXml(webhookGuid)}</guID>
            <account>${escapeXml(account)}</account>
            <username>${escapeXml(username)}</username>
            <postback_types>IPC::OCR::RDC</postback_types>
        </postBackInfo>`
  }

  // Add MVR subOrder
  xml += `
        <subOrder type='MVR'>
            <dlnum>${escapeXml(dlNumber)}</dlnum>
            <dlstate>${escapeXml(dlState)}</dlstate>
            <!-- See 'State Conversion' -->
            <mvr_searchtype>${mvrSearchType}</mvr_searchtype>
            <!-- Optional -->
        </subOrder>`

  // Add FMCSA crash/inspection subOrder if requested
  if (includeFmcsaCrashInspection) {
    xml += `
        <subOrder type='fmcsa_crash_inspection'>
            <dlnum>${escapeXml(dlNumber)}</dlnum>
            <dlstate>${escapeXml(dlState)}</dlstate>
        </subOrder>`
  }

  xml += `
    </placeOrder>
</Accio_Order>`

  return xml
}

/**
 * FMCSA-only Accio order (single subOrder). Storm’s PSP **product** uses
 * `buildAccioPspWithMvrBundleOrderXml` (MVR + FMCSA in one placeOrder) instead.
 */
export interface AccioPspOrderData {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  email: string
  phone?: string
  /** Full 9-digit SSN — see comment on `AccioOrderData.ssn`. */
  ssn: string
  dob: string
  gender?: 'M' | 'F' | 'U'
  race?: string
  address: string
  city: string
  state: string
  zip: string
  jobState?: string
  dlNumber: string
  dlState: string
  orderNumber: string
  suppressApplicantEmail?: boolean
  webhookUrl?: string
  webhookGuid?: string
}

export function buildAccioPspOrderXml(data: AccioPspOrderData): string {
  const {
    firstName,
    middleName,
    lastName,
    suffix,
    email,
    phone,
    ssn,
    dob,
    gender = 'U',
    race = 'U',
    address,
    city,
    state,
    zip,
    jobState,
    dlNumber,
    dlState,
    orderNumber,
    suppressApplicantEmail = true,
    webhookUrl,
    webhookGuid,
  } = data

  const account = process.env.ACCIO_ACCOUNT || ''
  const username = process.env.ACCIO_USERNAME || ''
  const password = process.env.ACCIO_PASSWORD || ''
  const mode = process.env.ACCIO_MODE || 'PROD'
  const dobFormatted = dob.replace(/-/g, '').substring(0, 8)

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Accio_Order>
    <mode>${mode}</mode>
    <login>
        <account>${escapeXml(account)}</account>
        <username>${escapeXml(username)}</username>
        <password>${escapeXml(password)}</password>
    </login>
    <placeOrder number="${orderNumber}">
        <mode>${mode}</mode>
        <SuppressApplicantPortalEmail>${suppressApplicantEmail ? 'Y' : 'N'}</SuppressApplicantPortalEmail>
        <orderInfo>
            <requester_name use_default="Y"/>
            <requester_phone use_default="Y"/>
            <requester_fax use_default="Y"/>
            <requester_email use_default="Y"/>
            <requester_billingdata/>
            <requester_billingdata2/>
            <requester_billingdata3/>
        </orderInfo>
        <package>A LA CARTE</package>
        <subject>
            <name_first>${escapeXml(firstName)}</name_first>
            ${middleName ? `<name_middle>${escapeXml(middleName)}</name_middle>` : '<name_middle/>'}
            <name_last>${escapeXml(lastName)}</name_last>
            ${suffix ? `<name_suffix>${escapeXml(suffix)}</name_suffix>` : '<name_suffix/>'}
            <email>${escapeXml(email)}</email>
            <ssn>${escapeXml(ssn)}</ssn>
            <dob>${dobFormatted}</dob>
            <gender>${gender}</gender>
            <race>${race}</race>
            ${phone ? `<phone_number>${escapeXml(phone)}</phone_number>` : '<phone_number>555-555-5555</phone_number>'}
            <address>${escapeXml(address)}</address>
            <city>${escapeXml(city)}</city>
            <state>${escapeXml(state)}</state>
            <zip>${escapeXml(zip)}</zip>
            ${jobState ? `<jobstate>${escapeXml(jobState)}</jobstate>` : `<jobstate>${escapeXml(state)}</jobstate>`}
            <citizenship_status>A citizen of the United States</citizenship_status>
            <FCRAPurpose>Employment by Hire or Contract</FCRAPurpose>
            <ApplicantID/>
            <RequisitionNumber/>
            <managerName/>
            <position_requested/>
            <drugscreen>N</drugscreen>
            <has_admitted_convictions>N</has_admitted_convictions>
            <admitted_conviction_details/>
            <portalfromapplicant>N</portalfromapplicant>
            <require_ews>N</require_ews>
        </subject>`

  if (webhookUrl && webhookGuid) {
    xml += `
        <postBackInfo>
            <URL>${escapeXml(webhookUrl)}</URL>
            <guID>${escapeXml(webhookGuid)}</guID>
            <account>${escapeXml(account)}</account>
            <username>${escapeXml(username)}</username>
            <postback_types>IPC::OCR::RDC</postback_types>
        </postBackInfo>`
  }

  xml += `
        <subOrder type='fmcsa_crash_inspection'>
            <dlnum>${escapeXml(dlNumber)}</dlnum>
            <dlstate>${escapeXml(dlState)}</dlstate>
        </subOrder>
    </placeOrder>
</Accio_Order>`

  return xml
}

/**
 * Storm PSP product = **one** Accio `placeOrder` with **MVR + FMCSA PSP** subOrders.
 * Postback URL must be `/api/mvr/webhook` — FMCSA completion posts are routed to PSP storage from there.
 *
 * IMPORTANT — do NOT re-enable `portalFromApplicant`:
 * The previous version set portalFromApplicant=true while ALSO suppressing the
 * applicant-portal email. That parked every PSP+MVR order in Accio's portal
 * queue waiting for an applicant who never received a link, turning a
 * minutes-long screening into a 30 min – several hours wait until a Key/Accio
 * operator manually pushed it through. Storm collects FCRA disclosure on our
 * side (`psp_consents`) before this function is ever called, so there is
 * nothing left for Accio's applicant portal to gather.
 */
export function buildAccioPspWithMvrBundleOrderXml(data: AccioOrderData): string {
  return buildAccioMvrOrderXml({
    ...data,
    includeFmcsaCrashInspection: true,
    portalFromApplicant: false,
  })
}

/** Parses Accio `placeOrder` XML response for bundled MVR + FMCSA suborder IDs. */
export function parseAccioPlaceOrderBundleIds(responseXml: string): {
  accioOrderId: string | null
  mvrSuborderId: string | null
  fmcsaSuborderId: string | null
  applicantPortalUrl: string | null
} {
  const accioOrderId = responseXml.match(/orderID=["'](\d+)["']/i)?.[1] ?? null

  const subId = (typeLiteral: string): string | null => {
    const esc = typeLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let m = responseXml.match(
      new RegExp(`<subOrder[^>]*type=["']${esc}["'][^>]*suborderID=["']([^"']+)["']`, 'i'),
    )
    if (m?.[1]) return m[1]
    m = responseXml.match(
      new RegExp(`<subOrder[^>]*suborderID=["']([^"']+)["'][^>]*type=["']${esc}["']`, 'i'),
    )
    return m?.[1] ?? null
  }

  const mvrSuborderId = subId('MVR')
  const fmcsaSuborderId = subId('fmcsa_crash_inspection')

  const portalMatch =
    responseXml.match(/<applicantPortalURL><!\[CDATA\[(.*?)\]\]><\/applicantPortalURL>/) ||
    responseXml.match(/<applicantPortalURL>(.*?)<\/applicantPortalURL>/)
  const applicantPortalUrl = portalMatch?.[1] ?? null

  return { accioOrderId, mvrSuborderId, fmcsaSuborderId, applicantPortalUrl }
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate unique order number
 * Format: timestamp + random 4 digits
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${timestamp}${random}`
}

/**
 * Generate unique GUID for webhook tracking
 */
export function generateWebhookGuid(): string {
  return `stormchain-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

