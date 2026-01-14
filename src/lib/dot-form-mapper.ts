/**
 * DOT Form ↔ Driver Profile Mappers
 * 
 * Maps data between the three DOT application forms and the unified driver profile.
 * This enables the driver profile to be the single source of truth.
 * 
 * Form 1: Personal Info, Residency, License, Medical
 * Form 2: Driving Experience, Accidents, Convictions
 * Form 3: Employment History, Education, Signature
 */

import type { UnifiedDriverProfile, UnifiedEmployment, UnifiedEducation } from '@/types/driver-profile'

// =====================================================
// FORM 1 DATA TYPES
// =====================================================

export interface DotForm1Data {
  employingCarrier?: {
    name: string
    address: string
    phone: string
    email: string
  }
  firstName: string
  middleName: string
  lastName: string
  phone: string
  email: string
  dateOfBirth: string
  socialSecurity?: string
  dateOfApplication?: string
  positionAppliedFor?: string
  dateAvailableForWork?: string
  hasLegalRightToWork?: string
  currentMailing: {
    street: string
    city: string
    state: string
    zipCode: string
    yearsAtAddress?: string
  }
  previousAddresses?: Array<{
    street: string
    city: string
    state: string
    zipCode: string
    fromDate: string
    toDate: string
  }>
  currentLicenses: Array<{
    state: string
    licenseNumber: string
    typeClass: string
    endorsements: string
    expirationDate: string
  }>
  previousLicenses?: Array<{
    state: string
    licenseNumber: string
    typeClass: string
    expirationDate: string
    reasonNoLongerHeld: string
  }>
  disqualificationHistory?: {
    hasLicenseSuspension: string
    licenseSuspensionDetails: string
    hasDisqualifyingOffense: string
    disqualifyingOffenseDetails: string
    hasOutOfServiceViolation: string
    outOfServiceViolationDetails: string
    hasMobileDeviceViolation: string
    mobileDeviceViolationDetails: string
  }
  medicalQualification?: {
    hasValidMedicalCertificate: string
    medicalCertificateExpiration: string
    hasFiledWithState: string
    hasMedicalVariance: string
    medicalVarianceDetails: string
    hasChronicConditions: string
    chronicConditionsDetails: string
    visionHearingCompliance: string
    medicationDisclosure: string
    medicalExamDate: string
    medicalExaminerName: string
    medicalExaminerPhone: string
    medicalExaminerRegistryId: string
    medicalExaminerType: string
  }
}

// =====================================================
// FORM 2 DATA TYPES
// =====================================================

export interface DotForm2Data {
  drivingExperience: Array<{
    equipmentType: string
    yearsOfExperience: string
  }>
  accidents: Array<{
    date: string
    nature: string
    fatalities: string
    injuries: string
    chemicalSpills?: string
    atFault: string
  }>
  hasNoAccidents: boolean
  convictions: Array<{
    dateConvicted: string
    violation: string
    stateOfViolation: string
    penalty: string
  }>
  hasNoConvictions: boolean
  deniedLicense: string
  deniedLicenseExplain: string
  suspendedLicense: string
  suspendedLicenseExplain: string
}

// =====================================================
// FORM 3 DATA TYPES
// =====================================================

export interface DotForm3Employer {
  name: string
  phone: string
  address: string
  positionHeld: string
  fromDate: string
  toDate: string
  reasonForLeaving: string
  salary?: string
  gapsInEmployment?: string
  subjectToFMCSR: string
  safetySensitiveFunction: string
  isUnemployment: boolean
}

export interface DotForm3Education {
  schoolType: string
  nameAndLocation: string
  courseOfStudy: string
  yearsCompleted: string
  graduated: string
  details?: string
}

export interface DotForm3Data {
  employers: DotForm3Employer[]
  education: DotForm3Education[]
  otherQualifications?: string
  applicantSignature?: string
  signatureDate?: string
  applicantNamePrinted?: string
  // Various acknowledgements (not stored in profile)
  safetyPerformanceHistoryAcknowledgement?: boolean
  safetyPerformanceInquiryConsent?: boolean
  roadTestAcknowledgement?: boolean
  hasPreviousRoadTest?: string
  previousRoadTestDetails?: string
  hasValidCDL?: string
}

// =====================================================
// DATE CONVERSION HELPERS
// =====================================================

/**
 * Convert Form 3's MM/YYYY format to profile's YYYY-MM format
 * Also handles "Present" and various edge cases
 */
function form3DateToProfileDate(dateStr: string): string {
  if (!dateStr) return ''
  if (dateStr.toLowerCase() === 'present') return ''
  
  // Handle MM/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
  if (match) {
    const month = match[1].padStart(2, '0')
    const year = match[2]
    return `${year}-${month}`
  }
  
  // Handle MM/YY format (2-digit year)
  const shortMatch = dateStr.match(/^(\d{1,2})\/(\d{2})$/)
  if (shortMatch) {
    const month = shortMatch[1].padStart(2, '0')
    let year = parseInt(shortMatch[2])
    year = year < 50 ? 2000 + year : 1900 + year
    return `${year}-${month}`
  }
  
  // Already in YYYY-MM or ISO format
  if (dateStr.match(/^\d{4}-\d{2}/)) return dateStr
  
  return dateStr
}

/**
 * Convert profile's YYYY-MM format to Form 3's MM/YYYY format
 */
function profileDateToForm3Date(dateStr: string, isCurrent: boolean): string {
  if (!dateStr && isCurrent) return 'Present'
  if (!dateStr) return ''
  
  // Handle YYYY-MM format
  const match = dateStr.match(/^(\d{4})-(\d{2})/)
  if (match) {
    return `${match[2]}/${match[1]}`
  }
  
  return dateStr
}

// =====================================================
// FORM 1 → PROFILE
// =====================================================

export function form1ToProfile(data: DotForm1Data): Partial<UnifiedDriverProfile> {
  const currentLicense = data.currentLicenses?.[0]
  
  return {
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    dateOfBirth: data.dateOfBirth,
    ssnLastFour: data.socialSecurity ? data.socialSecurity.slice(-4) : undefined,
    address: data.currentMailing.street,
    city: data.currentMailing.city,
    state: data.currentMailing.state,
    zipCode: data.currentMailing.zipCode,
    cdlNumber: currentLicense?.licenseNumber || '',
    cdlState: currentLicense?.state || '',
    cdlClass: currentLicense?.typeClass || '',
    cdlExpiration: currentLicense?.expirationDate || '',
    endorsements: currentLicense?.endorsements ? currentLicense.endorsements.split(',').map(e => e.trim()) : [],
  }
}

// =====================================================
// PROFILE → FORM 1
// =====================================================

export function profileToForm1(profile: UnifiedDriverProfile): Partial<DotForm1Data> {
  return {
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    currentMailing: {
      street: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      yearsAtAddress: '',
    },
    currentLicenses: [{
      state: profile.cdlState,
      licenseNumber: profile.cdlNumber,
      typeClass: profile.cdlClass,
      endorsements: profile.endorsements.join(', '),
      expirationDate: profile.cdlExpiration,
    }],
  }
}

// =====================================================
// FORM 2 → PROFILE
// =====================================================

export function form2ToProfile(data: DotForm2Data): Partial<UnifiedDriverProfile> {
  // Form 2 contains driving experience and safety records
  // These map to drivingExperience and mvrViolations/mvrAccidents
  
  // Note: MVR data is typically read-only from purchased reports,
  // but self-reported accidents/convictions can be stored separately
  // For now, we'll focus on driving experience
  
  return {
    // Driving experience from Form 2 could map to profile.drivingExperience
    // but the structure is different - keeping this simple for now
    // Main profile fields are in Form 1 and Form 3
  }
}

// =====================================================
// PROFILE → FORM 2
// =====================================================

export function profileToForm2(profile: UnifiedDriverProfile): Partial<DotForm2Data> {
  return {
    // Pre-fill from profile's driving experience if available
    drivingExperience: profile.drivingExperience ? [
      { equipmentType: 'Straight Truck', yearsOfExperience: profile.drivingExperience.equipmentTypes.straightTruck.years.toString() },
      { equipmentType: 'Tractor-Trailer', yearsOfExperience: profile.drivingExperience.equipmentTypes.tractorTrailer.years.toString() },
    ].filter(exp => parseFloat(exp.yearsOfExperience) > 0) : [],
    // Pre-fill accidents from MVR if available
    accidents: profile.mvrAccidents.map(acc => ({
      date: acc.date,
      nature: acc.description,
      fatalities: acc.fatalities ? 'Yes' : 'No',
      injuries: acc.injuries ? 'Yes' : 'No',
      atFault: acc.atFault ? 'Yes' : 'No',
    })),
    hasNoAccidents: profile.mvrAccidents.length === 0,
    // Pre-fill convictions from MVR if available
    convictions: profile.mvrViolations.map(viol => ({
      dateConvicted: viol.date,
      violation: viol.violation,
      stateOfViolation: viol.state,
      penalty: viol.fine ? `$${viol.fine}` : '',
    })),
    hasNoConvictions: profile.mvrViolations.length === 0,
  }
}

// =====================================================
// FORM 3 → PROFILE (Most important for employment history)
// =====================================================

export function form3ToProfile(data: DotForm3Data): Partial<UnifiedDriverProfile> {
  // Map Form 3 employers to profile employmentHistory
  const employmentHistory: UnifiedEmployment[] = data.employers
    .filter(emp => !emp.isUnemployment && emp.name) // Skip unemployment periods and empty entries
    .map((emp, idx): UnifiedEmployment => ({
      id: `form3-emp-${idx}-${Date.now()}`,
      companyName: emp.name,
      position: emp.positionHeld,
      location: emp.address,
      startDate: form3DateToProfileDate(emp.fromDate),
      endDate: form3DateToProfileDate(emp.toDate),
      isCurrent: emp.toDate.toLowerCase() === 'present' || !emp.toDate,
      responsibilities: [],
      equipment: [],
      reasonForLeaving: emp.reasonForLeaving,
      supervisorName: '',
      supervisorPhone: emp.phone,
      subjectToFMCSR: emp.subjectToFMCSR === 'yes',
      subjectToDrugTest: emp.safetySensitiveFunction === 'yes',
    }))

  // Map Form 3 education to profile education
  const education: UnifiedEducation[] = data.education
    .filter(edu => edu.nameAndLocation) // Skip empty entries
    .map((edu, idx): UnifiedEducation => ({
      id: `form3-edu-${idx}-${Date.now()}`,
      school: edu.nameAndLocation,
      degree: edu.graduated === 'yes' ? 'Completed' : 'Attended',
      field: edu.courseOfStudy,
      year: edu.yearsCompleted,
      certifications: edu.details ? [edu.details] : [],
    }))

  return {
    employmentHistory,
    education,
  }
}

// =====================================================
// PROFILE → FORM 3
// =====================================================

export function profileToForm3(profile: UnifiedDriverProfile): Partial<DotForm3Data> {
  // Map profile employmentHistory to Form 3 employers
  const employers: DotForm3Employer[] = profile.employmentHistory.map(emp => ({
    name: emp.companyName,
    phone: emp.supervisorPhone || '',
    address: emp.location,
    positionHeld: emp.position,
    fromDate: profileDateToForm3Date(emp.startDate, false),
    toDate: profileDateToForm3Date(emp.endDate, emp.isCurrent),
    reasonForLeaving: emp.reasonForLeaving || '',
    salary: '',
    gapsInEmployment: '',
    subjectToFMCSR: emp.subjectToFMCSR ? 'yes' : 'no',
    safetySensitiveFunction: emp.subjectToDrugTest ? 'yes' : 'no',
    isUnemployment: false,
  }))

  // Map profile education to Form 3 education
  const education: DotForm3Education[] = profile.education.map(edu => ({
    schoolType: edu.degree.toUpperCase().includes('HIGH') ? 'HIGH SCHOOL' : 
                edu.degree.toUpperCase().includes('COLLEGE') ? 'COLLEGE' : 'OTHER',
    nameAndLocation: edu.school,
    courseOfStudy: edu.field,
    yearsCompleted: edu.year,
    graduated: edu.degree === 'Completed' ? 'yes' : 'no',
    details: edu.certifications?.join(', ') || '',
  }))

  return {
    employers: employers.length > 0 ? employers : undefined,
    education: education.length > 0 ? education : undefined,
    applicantNamePrinted: `${profile.firstName} ${profile.middleName} ${profile.lastName}`.replace(/\s+/g, ' ').trim(),
    applicantSignature: `${profile.firstName} ${profile.middleName} ${profile.lastName}`.replace(/\s+/g, ' ').trim(),
  }
}

// =====================================================
// COMBINED MAPPERS
// =====================================================

/**
 * Map all DOT form data to a unified profile update
 */
export function allFormsToProfile(
  form1Data?: DotForm1Data | null,
  form2Data?: DotForm2Data | null,
  form3Data?: DotForm3Data | null
): Partial<UnifiedDriverProfile> {
  return {
    ...(form1Data ? form1ToProfile(form1Data) : {}),
    ...(form2Data ? form2ToProfile(form2Data) : {}),
    ...(form3Data ? form3ToProfile(form3Data) : {}),
  }
}

/**
 * Get count of populated fields for progress tracking
 */
export function getFormCompletionStats(
  form1Data?: DotForm1Data | null,
  form2Data?: DotForm2Data | null,
  form3Data?: DotForm3Data | null
): { total: number; completed: number; percentage: number } {
  let total = 0
  let completed = 0

  // Form 1 key fields
  const form1Fields = [
    form1Data?.firstName,
    form1Data?.lastName,
    form1Data?.phone,
    form1Data?.email,
    form1Data?.dateOfBirth,
    form1Data?.currentMailing?.street,
    form1Data?.currentMailing?.city,
    form1Data?.currentMailing?.state,
    form1Data?.currentLicenses?.[0]?.licenseNumber,
    form1Data?.currentLicenses?.[0]?.state,
  ]
  total += form1Fields.length
  completed += form1Fields.filter(f => f && String(f).trim() !== '').length

  // Form 3 key fields (employment)
  if (form3Data?.employers) {
    const hasValidEmployers = form3Data.employers.some(emp => 
      emp.name && emp.fromDate && emp.toDate && !emp.isUnemployment
    )
    total += 1
    if (hasValidEmployers) completed += 1
  }

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}
