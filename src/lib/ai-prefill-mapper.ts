/**
 * Maps T Backend AI prefill response to our driver application form structure
 */

export interface TBackendApplication {
  fullName: string | null
  email: string | null
  phone: string | null
  address: string | null
  dateOfBirth: string | null
  licenseNumber: string | null
  licenseState: string | null
  endorsements: string[] | null
  workHistory: Array<{
    employer: string | null
    role: string | null
    startDate: string | null
    endDate: string | null
    city: string | null
    state: string | null
  }> | null
}

export interface TBackendPrefillResponse {
  application: TBackendApplication
  raw: string
  vector_store_id: string
  file_id: string
}

/**
 * Parse full name into first, middle, last
 */
function parseFullName(fullName: string | null): {
  firstName: string
  middleName: string
  lastName: string
} {
  if (!fullName) {
    return { firstName: '', middleName: '', lastName: '' }
  }

  const parts = fullName.trim().split(/\s+/)
  
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '' }
  } else if (parts.length === 2) {
    return { firstName: parts[0], middleName: '', lastName: parts[1] }
  } else {
    // 3+ parts: first, everything except last is middle, last
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    const middleName = parts.slice(1, -1).join(' ')
    return { firstName, middleName, lastName }
  }
}

/**
 * Parse address string into components
 */
function parseAddress(address: string | null): {
  street: string
  city: string
  state: string
  zipCode: string
} {
  if (!address) {
    return { street: '', city: '', state: '', zipCode: '' }
  }

  // Common format: "123 Main St, City, ST 12345"
  // Try to parse, but if it fails, just put everything in street
  const parts = address.split(',').map(s => s.trim())
  
  if (parts.length >= 3) {
    const street = parts[0]
    const city = parts[1]
    
    // Last part might be "ST 12345" or "State 12345"
    const lastPart = parts[2]
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    
    if (stateZipMatch) {
      return {
        street,
        city,
        state: stateZipMatch[1],
        zipCode: stateZipMatch[2],
      }
    }
    
    // Try to extract state and zip differently
    const words = lastPart.split(/\s+/)
    if (words.length >= 2) {
      const state = words[0]
      const zipCode = words[words.length - 1]
      return { street, city, state, zipCode }
    }
  }
  
  // Fallback: put everything in street
  return { street: address, city: '', state: '', zipCode: '' }
}

/**
 * Map T Backend response to Form 1 data (Personal Info, Residency, License)
 */
export function mapToForm1Data(response: TBackendPrefillResponse) {
  const { application } = response
  const { firstName, middleName, lastName } = parseFullName(application.fullName)
  const currentAddress = parseAddress(application.address)

  return {
    // Personal Information
    firstName,
    middleName,
    lastName,
    phone: application.phone || '',
    email: application.email || '',
    dateOfBirth: application.dateOfBirth || '',
    socialSecurity: '', // Never extracted from resume for privacy
    dateOfApplication: new Date().toISOString().slice(0, 10),
    positionAppliedFor: 'Commercial Driver', // Default
    dateAvailableForWork: new Date().toISOString().slice(0, 10),
    hasLegalRightToWork: '', // User must specify

    // Residency History (current address from resume)
    currentMailing: {
      street: currentAddress.street,
      city: currentAddress.city,
      state: currentAddress.state,
      zipCode: currentAddress.zipCode,
      yearsAtAddress: '', // User must specify
    },
    previousAddresses: [] as any[],

    // License Information
    currentLicenses: [
      {
        state: application.licenseState || '',
        licenseNumber: application.licenseNumber || '',
        typeClass: '', // User must specify
        endorsements: application.endorsements?.join(', ') || '',
        expirationDate: '',
      },
    ],
    previousLicenses: [] as any[],
  }
}

/**
 * Map T Backend work history to Form 2 data (Employment History)
 */
export function mapToForm2Data(response: TBackendPrefillResponse) {
  const { application } = response

  if (!application.workHistory || application.workHistory.length === 0) {
    return {
      employmentHistory: [],
      hasGaps: '',
      gapExplanations: [],
    }
  }

  // Map work history to employment records
  const employmentHistory = application.workHistory.map((job) => ({
    employer: job.employer || '',
    address: job.city && job.state ? `${job.city}, ${job.state}` : '',
    position: job.role || '',
    startDate: job.startDate || '',
    endDate: job.endDate || 'Present',
    reasonForLeaving: '', // User must specify
    salary: '', // Not extracted
    contactPerson: '', // Not extracted
    contactPhone: '', // Not extracted
    subjectToFMCSR: '', // User must specify
    subjectToDrugTest: '', // User must specify
  }))

  return {
    employmentHistory,
    hasGaps: '', // We'll let user determine
    gapExplanations: [] as any[],
  }
}

/**
 * Map to Form 3 data (Accident/Traffic Record, Certifications)
 * Note: T Backend doesn't extract this info, so return empty structure
 */
export function mapToForm3Data(response: TBackendPrefillResponse) {
  return {
    accidentHistory: [],
    trafficConvictions: [],
    deniedLicense: '',
    deniedLicenseExplanation: '',
    hasExperience: '',
    equipmentTypes: [],
    safetyEquipmentCertifications: [],
  }
}

/**
 * Main mapping function: returns all form data
 */
export function mapTBackendToFormData(response: TBackendPrefillResponse) {
  return {
    form1Data: mapToForm1Data(response),
    form2Data: mapToForm2Data(response),
    form3Data: mapToForm3Data(response),
  }
}

/**
 * Count how many fields were successfully extracted
 */
export function countExtractedFields(response: TBackendPrefillResponse): {
  total: number
  extracted: number
  fieldNames: string[]
} {
  const { application } = response
  const fields = [
    { name: 'Name', value: application.fullName },
    { name: 'Email', value: application.email },
    { name: 'Phone', value: application.phone },
    { name: 'Address', value: application.address },
    { name: 'Date of Birth', value: application.dateOfBirth },
    { name: 'License Number', value: application.licenseNumber },
    { name: 'License State', value: application.licenseState },
    { name: 'Endorsements', value: application.endorsements?.length },
    { name: 'Work History', value: application.workHistory?.length },
  ]

  const extractedFields = fields.filter((f) => f.value)
  
  return {
    total: fields.length,
    extracted: extractedFields.length,
    fieldNames: extractedFields.map((f) => f.name),
  }
}

