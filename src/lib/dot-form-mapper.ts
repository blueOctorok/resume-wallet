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
  // Accident record covers past 5 years (per DOT requirements)
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
  // Pre-employment drug/alcohol test question (49 CFR 40.25 — past 2 years)
  drugTestPositive?: string           // 'yes' | 'no'
  drugTestPositiveExplain?: string
  // 49 CFR 391.15 disqualifying criminal convictions (past 3 years)
  cfr391ConvictedYesNo?: string       // 'yes' | 'no'
  cfr391ConvictedOffenses?: string[]  // keys from CFR391_OFFENSES list
  cfr391ConvictedExplain?: string
}

// =====================================================
// FORM 3 DATA TYPES
// =====================================================

export interface DotForm3Employer {
  name: string
  phone: string
  /** Leftover on older drafts — no longer collected. */
  email?: string
  hiringManagerName?: string
  hiringManagerPhone?: string
  hiringManagerEmail?: string
  address: string
  positionHeld: string
  duties?: string
  fromDate: string
  toDate: string
  reasonForLeaving: string
  salary?: string
  gapsInEmployment?: string
  subjectToFMCSR: string
  safetySensitiveFunction: string
  isUnemployment: boolean
  /** Stable id — links to block_driver_employment.history[].id / EVR.employment_id */
  id?: string
  /** P3.7 — prior-employer portal confirmation vs driver self-entry */
  _source?: 'verified' | 'self'
  _verificationRequestId?: string
  _evrKey?: string
  /** 'VERIFIED' | 'PARTIALLY_VERIFIED' when _source is verified */
  _verificationStatus?: string
  _verifiedAt?: string
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
  // Electronic signature metadata
  signedAt?: string      // ISO timestamp auto-set when signature is typed
  ipAddress?: string     // Captured at submission time
  fcraAcknowledgement?: boolean
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
  // Defensive checks for partial data
  if (!data) return {}
  
  const currentLicense = data.currentLicenses?.[0]
  const mailing = data.currentMailing || {}
  
  return {
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    dateOfBirth: data.dateOfBirth || '',
    ssnLastFour: data.socialSecurity ? data.socialSecurity.slice(-4) : undefined,
    address: mailing.street || '',
    city: mailing.city || '',
    state: mailing.state || '',
    zipCode: mailing.zipCode || '',
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

/**
 * Form 2 from AI prefill includes employmentHistory (work history extracted from resume).
 * Map it to unified profile so it appears in Driver Hub and can be verified.
 */
function form2EmploymentToUnified(employmentHistory: Array<{
  employer?: string
  address?: string
  position?: string
  startDate?: string
  endDate?: string
  reasonForLeaving?: string
  contactPerson?: string
  contactPhone?: string
}>): UnifiedEmployment[] {
  if (!employmentHistory?.length) return []
  return employmentHistory
    .filter((e) => e.employer?.trim())
    .map((e, idx) => ({
      id: `prefill-emp-${idx}-${Date.now()}`,
      companyName: e.employer?.trim() ?? '',
      position: e.position?.trim() ?? '',
      location: e.address?.trim() ?? '',
      startDate: e.startDate ?? '',
      endDate: e.endDate === 'Present' ? '' : (e.endDate ?? ''),
      isCurrent: e.endDate === 'Present' || !e.endDate,
      responsibilities: [],
      equipment: [],
      reasonForLeaving: e.reasonForLeaving || undefined,
      supervisorName: e.contactPerson || undefined,
      supervisorPhone: e.contactPhone || undefined,
      supervisorEmail: undefined,
    }))
}

export function form2ToProfile(data: DotForm2Data): Partial<UnifiedDriverProfile> {
  // Form 2 contains driving experience and safety records.
  // When data comes from AI prefill, it also has employmentHistory (work history from resume).
  const withEmployment = data as DotForm2Data & { employmentHistory?: Array<{
    employer?: string
    address?: string
    position?: string
    startDate?: string
    endDate?: string
    reasonForLeaving?: string
    contactPerson?: string
    contactPhone?: string
  }> }
  const employmentHistory = withEmployment.employmentHistory?.length
    ? form2EmploymentToUnified(withEmployment.employmentHistory)
    : undefined

  return {
    ...(employmentHistory?.length ? { employmentHistory } : {}),
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
  // Defensive checks - form3Data might exist but have undefined arrays
  const employers = data?.employers || []
  const educationData = data?.education || []
  
  // Map Form 3 employers to profile employmentHistory
  const employmentHistory: UnifiedEmployment[] = employers
    .filter(emp => !emp.isUnemployment && emp.name) // Skip unemployment periods and empty entries
    .map((emp, idx): UnifiedEmployment => ({
      // Preserve stable id so EVR.employment_id linkage survives Form 3 ↔ profile sync
      id: emp.id?.trim() || `form3-emp-${idx}-${Date.now()}`,
      companyName: emp.name,
      position: emp.positionHeld,
      location: emp.address,
      startDate: form3DateToProfileDate(emp.fromDate),
      endDate: form3DateToProfileDate(emp.toDate),
      isCurrent: emp.toDate?.toLowerCase() === 'present' || !emp.toDate,
      responsibilities: [],
      equipment: [],
      reasonForLeaving: emp.reasonForLeaving,
      supervisorName: emp.hiringManagerName || '',
      supervisorPhone: emp.hiringManagerPhone || emp.phone,
      supervisorEmail: emp.hiringManagerEmail || undefined,
      subjectToFMCSR: emp.subjectToFMCSR === 'yes',
      subjectToDrugTest: emp.safetySensitiveFunction === 'yes',
    }))

  // Map Form 3 education to profile education
  const education: UnifiedEducation[] = educationData
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
    id: emp.id,
    name: emp.companyName,
    phone: emp.supervisorPhone || '',
    hiringManagerName: emp.supervisorName || '',
    hiringManagerPhone: emp.supervisorName ? emp.supervisorPhone || '' : '',
    hiringManagerEmail: emp.supervisorEmail || '',
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
    _source: 'self',
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
      emp.name && emp.email && emp.fromDate && emp.toDate && !emp.isUnemployment
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
