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
  ssn: string // Last 4 digits only for security
  dob: string // Format: YYYYMMDD
  address: string
  city: string
  state: string // 2-letter state code
  zip: string
  
  // License Information
  dlNumber: string
  dlState: string // 2-letter state code
  
  // Order Configuration
  orderNumber: string // Unique order number we generate
  mvrSearchType?: 'standard' | 'comprehensive'
  
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
    address,
    city,
    state,
    zip,
    dlNumber,
    dlState,
    orderNumber,
    mvrSearchType = 'standard',
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

  // Build XML
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
            ${phone ? `<phone_number>${escapeXml(phone)}</phone_number>` : '<phone_number/>'}
            <address>${escapeXml(address)}</address>
            <city>${escapeXml(city)}</city>
            <state>${escapeXml(state)}</state>
            <zip>${escapeXml(zip)}</zip>
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
        </subject>`

  // Add webhook configuration if provided
  if (webhookUrl && webhookGuid) {
    xml += `
        <postBackInfo>
            <URL>${escapeXml(webhookUrl)}</URL>
            <guID>${escapeXml(webhookGuid)}</guID>
            <account>${escapeXml(account)}</account>
            <username>${escapeXml(username)}</username>
            <postback_types>CETA::IPC::EXP::CNF::OCR::RDC</postback_types>
        </postBackInfo>`
  }

  // Add MVR subOrder
  xml += `
        <subOrder type='MVR'>
            <dlnum>${escapeXml(dlNumber)}</dlnum>
            <dlstate>${escapeXml(dlState)}</dlstate>
            <mvr_searchtype>${mvrSearchType}</mvr_searchtype>
        </subOrder>
    </placeOrder>
</Accio_Order>`

  return xml
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
  return `veree-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

