/**
 * Maps MVR (Motor Vehicle Record) results to DOT application Form 1 data structure
 * 
 * This mapper extracts verified license and personal information from Accio MVR results
 * and maps them to the DOT application form format for prefilling.
 */

import { ParsedMvrResult } from './accio-xml-parser'
import { formatPhoneForDotForm } from './mvr-display-sanitize'

/**
 * Convert YYYYMMDD date format to YYYY-MM-DD
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr.length !== 8) return ''
  
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  
  return `${year}-${month}-${day}`
}

/**
 * Parse full name into first, middle, last components
 */
function parseFullName(firstName?: string, middleName?: string, lastName?: string, suffix?: string): {
  firstName: string
  middleName: string
  lastName: string
} {
  return {
    firstName: firstName || '',
    middleName: middleName || '',
    lastName: lastName || (suffix ? `${lastName} ${suffix}`.trim() : '')
  }
}

/**
 * Parse address components from MVR subject data
 */
function parseAddress(address?: string, city?: string, state?: string, zip?: string): {
  street: string
  city: string
  state: string
  zipCode: string
} {
  return {
    street: address || '',
    city: city || '',
    state: state || '',
    zipCode: zip || ''
  }
}

/**
 * Parse license endorsements string (comma-separated or single value) to comma-separated format
 */
function parseEndorsements(endorsements?: string): string {
  if (!endorsements) return ''
  
  // Clean up and normalize (remove extra spaces, ensure comma separation)
  return endorsements.split(',').map(e => e.trim()).filter(e => e.length > 0).join(', ')
}

/**
 * Map MVR result to DOT Application Form 1 data structure
 * Only fills fields that are available from MVR - leaves others empty for user input
 */
export function mapMvrToForm1Data(mvrResult: ParsedMvrResult): any {
  const subject = mvrResult.subject
  
  // Get primary license from licenses array or fallback to basic license fields
  const primaryLicense = mvrResult.licenses && mvrResult.licenses.length > 0 
    ? mvrResult.licenses[0] 
    : null

  // Parse name components
  const name = parseFullName(
    subject?.firstName,
    subject?.middleName,
    subject?.lastName,
    subject?.nameSuffix
  )

  // Parse address
  const address = parseAddress(
    subject?.address,
    subject?.city,
    subject?.state,
    subject?.zip
  )

  // Format date of birth (YYYYMMDD -> YYYY-MM-DD)
  const dateOfBirth = subject?.dateOfBirth ? formatDate(subject.dateOfBirth) : ''

  // Build current licenses array (MVR typically has one primary license)
  const currentLicenses = []
  
  if (mvrResult.licenseNumber || primaryLicense) {
    const licenseExpiration = primaryLicense?.expirationDate 
      ? formatDate(primaryLicense.expirationDate)
      : (mvrResult.licenseExpirationDate ? formatDate(mvrResult.licenseExpirationDate) : '')
    
    const licenseClass = primaryLicense?.class || ''
    const endorsements = parseEndorsements(primaryLicense?.endorsements)
    
    currentLicenses.push({
      state: mvrResult.licenseState || '',
      licenseNumber: mvrResult.licenseNumber || '',
      typeClass: licenseClass, // e.g., "CDL-A", "CDL-B", etc.
      endorsements: endorsements,
      expirationDate: licenseExpiration
    })
  }

  // Build Form 1 data structure
  return {
    // Personal Information (only fill if available from MVR)
    firstName: name.firstName,
    middleName: name.middleName,
    lastName: name.lastName,
    phone: formatPhoneForDotForm(subject?.phone),
    email: subject?.email || '',
    dateOfBirth: dateOfBirth,
    socialSecurity: '', // Never extracted from MVR for privacy/security
    dateOfApplication: new Date().toISOString().slice(0, 10), // Set to today
    positionAppliedFor: '', // User must specify
    dateAvailableForWork: '', // User must specify
    hasLegalRightToWork: '', // User must specify

    // Residency History (current address from MVR subject)
    currentMailing: {
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      yearsAtAddress: '' // MVR doesn't provide this - user must specify
    },
    previousAddresses: [] as any[], // MVR doesn't include previous addresses

    // License Information (from MVR)
    currentLicenses: currentLicenses,
    previousLicenses: [] as any[], // MVR only shows current license

    // Disqualification History - leave empty, user must answer
    disqualificationHistory: {
      hasLicenseSuspension: '',
      licenseSuspensionDetails: '',
      hasDisqualifyingOffense: '',
      disqualifyingOffenseDetails: '',
      hasOutOfServiceViolation: '',
      outOfServiceViolationDetails: '',
      hasMobileDeviceViolation: '',
      mobileDeviceViolationDetails: ''
    },

    // Medical Qualification - leave empty, user must provide
    medicalQualification: {
      hasValidMedicalCertificate: '',
      medicalCertificateExpiration: '',
      hasFiledWithState: '',
      hasMedicalVariance: '',
      medicalVarianceDetails: '',
      hasChronicConditions: '',
      chronicConditionsDetails: '',
      visionHearingCompliance: '',
      medicationDisclosure: '',
      medicalExamDate: '',
      medicalExaminerName: '',
      medicalExaminerPhone: '',
      medicalExaminerRegistryId: '',
      medicalExaminerType: ''
    }
  }
}

/**
 * Get a summary of what fields were extracted from MVR
 */
export function getMvrExtractionSummary(mvrResult: ParsedMvrResult): {
  totalFields: number
  extractedFields: number
  fieldNames: string[]
} {
  const subject = mvrResult.subject
  const fields: { name: string; value: any }[] = [
    { name: 'First Name', value: subject?.firstName },
    { name: 'Middle Name', value: subject?.middleName },
    { name: 'Last Name', value: subject?.lastName },
    { name: 'Date of Birth', value: subject?.dateOfBirth },
    { name: 'Email', value: subject?.email },
    { name: 'Phone', value: subject?.phone },
    { name: 'Address', value: subject?.address },
    { name: 'City', value: subject?.city },
    { name: 'State', value: subject?.state },
    { name: 'ZIP Code', value: subject?.zip },
    { name: 'License Number', value: mvrResult.licenseNumber },
    { name: 'License State', value: mvrResult.licenseState },
    { name: 'License Class', value: mvrResult.licenses?.[0]?.class },
    { name: 'License Expiration', value: mvrResult.licenseExpirationDate || mvrResult.licenses?.[0]?.expirationDate },
    { name: 'License Endorsements', value: mvrResult.licenses?.[0]?.endorsements }
  ]

  const extractedFields = fields.filter(f => f.value)
  
  return {
    totalFields: fields.length,
    extractedFields: extractedFields.length,
    fieldNames: extractedFields.map(f => f.name)
  }
}

