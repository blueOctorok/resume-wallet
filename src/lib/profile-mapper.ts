/**
 * Unified Driver Profile Mapper
 * 
 * Bidirectional mapping between the unified profile and form-specific data structures.
 * This enables:
 * - Resume Builder → Profile → DOT Application
 * - DOT Application → Profile → Resume Builder
 * - Uploaded Resume (AI extracted) → Profile → Both forms
 * - MVR Data → Profile → Both forms
 */

import type {
  UnifiedDriverProfile,
  UnifiedEmployment,
  UnifiedReference,
  UnifiedEducation,
  UnifiedSkill,
} from '@/types/driver-profile'

import type { DriverApplicationData } from '@/components/driver-application/types/driver-application.types'

// ===== RESUME BUILDER TYPES =====
// These match the interfaces in ResumeBuilder.tsx

interface ResumePersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  professionalSummary: string
}

interface ResumeCDLInfo {
  cdlNumber: string
  cdlState: string
  cdlClass: string
  endorsements: string[]
  expirationDate: string
  restrictions: string[]
}

interface ResumeEmployment {
  id: string
  companyName: string
  position: string
  startDate: string
  endDate: string
  isCurrent: boolean
  location: string
  responsibilities: string[]
  equipment: string[]
  milesDriven?: string
  safetyRecord?: string
}

interface ResumeEducation {
  id: string
  school: string
  degree: string
  field: string
  year: string
  certifications: string[]
}

interface ResumeSkill {
  id: string
  name: string
  category: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

interface ResumeReference {
  id: string
  name: string
  title: string
  company: string
  phone: string
  email: string
  relationship: string
}

export interface ResumeBuilderData {
  personalInfo: ResumePersonalInfo
  cdlInfo: ResumeCDLInfo
  employments: ResumeEmployment[]
  educations: ResumeEducation[]
  skills: ResumeSkill[]
  references: ResumeReference[]
}

// =====================================================
// PROFILE → RESUME BUILDER
// =====================================================

/**
 * Map unified profile to Resume Builder format
 * Used when: User opens Resume Builder and should see their existing data
 */
export function profileToResumeBuilder(profile: UnifiedDriverProfile): ResumeBuilderData {
  return {
    personalInfo: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      professionalSummary: profile.professionalSummary,
    },
    cdlInfo: {
      cdlNumber: profile.cdlNumber,
      cdlState: profile.cdlState,
      cdlClass: profile.cdlClass,
      endorsements: profile.endorsements,
      expirationDate: profile.cdlExpiration,
      restrictions: profile.restrictions,
    },
    employments: profile.employmentHistory.map((emp): ResumeEmployment => ({
      id: emp.id,
      companyName: emp.companyName,
      position: emp.position,
      startDate: emp.startDate,
      endDate: emp.endDate,
      isCurrent: emp.isCurrent,
      location: emp.location,
      responsibilities: emp.responsibilities || [],
      equipment: emp.equipment || [],
      milesDriven: emp.milesDriven,
      safetyRecord: emp.safetyRecord,
    })),
    educations: profile.education.map((edu): ResumeEducation => ({
      id: edu.id,
      school: edu.school,
      degree: edu.degree,
      field: edu.field,
      year: edu.year,
      certifications: edu.certifications || [],
    })),
    skills: profile.skills.map((skill): ResumeSkill => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
    })),
    references: profile.references.map((ref): ResumeReference => ({
      id: ref.id,
      name: ref.name,
      title: ref.title || '',
      company: ref.company || '',
      phone: ref.phone,
      email: ref.email,
      relationship: ref.relationship,
    })),
  }
}

// =====================================================
// RESUME BUILDER → PROFILE
// =====================================================

/**
 * Map Resume Builder data to unified profile format
 * Used when: User saves in Resume Builder
 * Note: This returns a PARTIAL profile - only the fields Resume Builder knows about
 */
export function resumeBuilderToProfile(data: ResumeBuilderData): Partial<UnifiedDriverProfile> {
  return {
    firstName: data.personalInfo.firstName,
    lastName: data.personalInfo.lastName,
    email: data.personalInfo.email,
    phone: data.personalInfo.phone,
    address: data.personalInfo.address,
    city: data.personalInfo.city,
    state: data.personalInfo.state,
    zipCode: data.personalInfo.zipCode,
    professionalSummary: data.personalInfo.professionalSummary,
    cdlNumber: data.cdlInfo.cdlNumber,
    cdlState: data.cdlInfo.cdlState,
    cdlClass: data.cdlInfo.cdlClass,
    cdlExpiration: data.cdlInfo.expirationDate,
    endorsements: data.cdlInfo.endorsements,
    restrictions: data.cdlInfo.restrictions,
    employmentHistory: data.employments.map((emp): UnifiedEmployment => ({
      id: emp.id,
      companyName: emp.companyName,
      position: emp.position,
      location: emp.location,
      startDate: emp.startDate,
      endDate: emp.endDate,
      isCurrent: emp.isCurrent,
      responsibilities: emp.responsibilities,
      equipment: emp.equipment,
      milesDriven: emp.milesDriven,
      safetyRecord: emp.safetyRecord,
      // DOT fields - preserve if they existed
      reasonForLeaving: undefined,
      supervisorName: undefined,
      supervisorPhone: undefined,
    })),
    education: data.educations.map((edu): UnifiedEducation => ({
      id: edu.id,
      school: edu.school,
      degree: edu.degree,
      field: edu.field,
      year: edu.year,
      certifications: edu.certifications,
    })),
    skills: data.skills.map((skill): UnifiedSkill => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
    })),
    references: data.references.map((ref): UnifiedReference => ({
      id: ref.id,
      name: ref.name,
      title: ref.title,
      company: ref.company,
      phone: ref.phone,
      email: ref.email,
      relationship: ref.relationship,
      // DOT field - preserve if existed
      yearsKnown: undefined,
    })),
  }
}

// =====================================================
// PROFILE → DOT APPLICATION
// =====================================================

/**
 * Map unified profile to DOT Application format
 * Used when: User opens DOT Application and should see their existing data
 */
export function profileToDotApplication(profile: UnifiedDriverProfile): Partial<DriverApplicationData> {
  return {
    personalInfo: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleName: profile.middleName,
      ssn: '', // Never prefill full SSN for security
      dateOfBirth: profile.dateOfBirth,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      phone: profile.phone,
      email: profile.email,
      emergencyContact: {
        name: profile.emergencyContactName,
        relationship: profile.emergencyContactRelationship,
        phone: profile.emergencyContactPhone,
      },
    },
    cdlInfo: {
      cdlNumber: profile.cdlNumber,
      cdlState: profile.cdlState,
      cdlExpiration: profile.cdlExpiration,
      cdlClass: profile.cdlClass,
      endorsements: profile.endorsements,
      restrictions: profile.restrictions,
    },
    employmentHistory: profile.employmentHistory.map((emp) => ({
      company: emp.companyName,
      companyName: emp.companyName,
      position: emp.position,
      location: emp.location,
      startDate: emp.startDate,
      endDate: emp.isCurrent ? '' : emp.endDate,
      reasonForLeaving: emp.reasonForLeaving || '',
      supervisorName: emp.supervisorName || '',
      supervisorPhone: emp.supervisorPhone || '',
      supervisorEmail: emp.supervisorEmail || '',
      duties: emp.responsibilities?.join('; ') || '',
    })),
    // Map MVR data to driving record if available
    drivingRecord: {
      violations: profile.mvrViolations.map((v) => ({
        date: v.date,
        violation: v.violation,
        location: v.state,
        fine: v.fine?.toString() || '',
        points: v.points?.toString() || '',
      })),
      accidents: profile.mvrAccidents.map((a) => ({
        date: a.date,
        description: a.description,
        fatalities: a.fatalities ? 'Yes' : 'No',
        injuries: a.injuries ? 'Yes' : 'No',
        propertyDamage: '', // Not in MVR data
      })),
    },
    references: profile.references.map((ref) => ({
      name: ref.name,
      relationship: ref.relationship,
      phone: ref.phone,
      email: ref.email,
      yearsKnown: ref.yearsKnown || '',
    })),
    drivingExperience: profile.drivingExperience || {
      equipmentTypes: {
        straightTruck: { years: 0, miles: 0 },
        tractorTrailer: { years: 0, miles: 0 },
        tractorTwoTrailers: { years: 0, miles: 0 },
        specializedEquipment: [],
      },
      specialSkills: {
        moffettForklift: false,
        craneOperations: false,
        hazmatHandling: false,
        borderCrossing: false,
      },
    },
  }
}

// =====================================================
// DOT APPLICATION → PROFILE
// =====================================================

/**
 * Map DOT Application data to unified profile format
 * Used when: User saves in DOT Application
 * Note: This returns a PARTIAL profile - only the fields DOT Application knows about
 */
export function dotApplicationToProfile(data: DriverApplicationData): Partial<UnifiedDriverProfile> {
  return {
    firstName: data.personalInfo.firstName,
    middleName: data.personalInfo.middleName,
    lastName: data.personalInfo.lastName,
    email: data.personalInfo.email,
    phone: data.personalInfo.phone,
    dateOfBirth: data.personalInfo.dateOfBirth,
    // Store only last 4 of SSN for security
    ssnLastFour: data.personalInfo.ssn ? data.personalInfo.ssn.slice(-4) : undefined,
    address: data.personalInfo.address,
    city: data.personalInfo.city,
    state: data.personalInfo.state,
    zipCode: data.personalInfo.zipCode,
    emergencyContactName: data.personalInfo.emergencyContact.name,
    emergencyContactRelationship: data.personalInfo.emergencyContact.relationship,
    emergencyContactPhone: data.personalInfo.emergencyContact.phone,
    cdlNumber: data.cdlInfo.cdlNumber,
    cdlState: data.cdlInfo.cdlState,
    cdlClass: data.cdlInfo.cdlClass,
    cdlExpiration: data.cdlInfo.cdlExpiration,
    endorsements: data.cdlInfo.endorsements,
    restrictions: data.cdlInfo.restrictions,
    employmentHistory: data.employmentHistory.map((emp, index): UnifiedEmployment => ({
      id: `dot-emp-${index}`,
      companyName: emp.company,
      position: emp.position,
      location: '', // DOT form doesn't have separate location
      startDate: emp.startDate,
      endDate: emp.endDate,
      isCurrent: !emp.endDate,
      responsibilities: emp.duties ? emp.duties.split(';').map((d) => d.trim()) : [],
      equipment: [],
      reasonForLeaving: emp.reasonForLeaving,
      supervisorName: emp.supervisorName,
      supervisorPhone: emp.supervisorPhone,
    })),
    references: data.references.map((ref, index): UnifiedReference => ({
      id: `dot-ref-${index}`,
      name: ref.name,
      phone: ref.phone,
      email: ref.email,
      relationship: ref.relationship,
      yearsKnown: ref.yearsKnown,
    })),
    drivingExperience: data.drivingExperience,
  }
}

// =====================================================
// SMART MERGE
// =====================================================

/**
 * Intelligently merge new data into existing profile
 * Rules:
 * - Non-empty new values overwrite existing
 * - Empty new values don't overwrite existing (preserves data)
 * - Arrays replace only when the incoming list has items (empty DOT stubs
 *   must not wipe richer block_* employment / education / endorsements)
 * - Nested objects are recursively merged
 */
export function mergeIntoProfile(
  existing: UnifiedDriverProfile,
  newData: Partial<UnifiedDriverProfile>
): UnifiedDriverProfile {
  const merged = { ...existing }
  
  for (const [key, value] of Object.entries(newData)) {
    if (value === undefined) continue
    
    // For strings, only overwrite if new value is non-empty
    if (typeof value === 'string') {
      if (value.trim() !== '') {
        (merged as Record<string, unknown>)[key] = value
      }
    }
    else if (Array.isArray(value)) {
      if (value.length > 0) {
        (merged as Record<string, unknown>)[key] = value
      }
    }
    // For objects, do a shallow merge
    else if (typeof value === 'object' && value !== null) {
      (merged as Record<string, unknown>)[key] = value
    }
    // For other types (boolean, number), always use new value
    else {
      (merged as Record<string, unknown>)[key] = value
    }
  }
  
  return merged
}

// =====================================================
// MERGE EMPLOYMENT HISTORY (preserves fields from both forms)
// =====================================================

/**
 * Merge employment history while preserving fields from both forms
 * This is useful when user has some employment entered in Resume Builder
 * and adds more details (supervisor info) in DOT Application
 */
export function mergeEmploymentHistory(
  existing: UnifiedEmployment[],
  incoming: UnifiedEmployment[]
): UnifiedEmployment[] {
  // Create a map of existing employment by company+dates for matching
  const existingMap = new Map<string, UnifiedEmployment>()
  for (const emp of existing) {
    const key = `${emp.companyName.toLowerCase()}-${emp.startDate}`
    existingMap.set(key, emp)
  }
  
  const merged: UnifiedEmployment[] = []
  const processedKeys = new Set<string>()
  
  // Process incoming, merging with existing where matched
  for (const inc of incoming) {
    const key = `${inc.companyName.toLowerCase()}-${inc.startDate}`
    const existing = existingMap.get(key)
    
    if (existing) {
      // Merge: incoming overwrites non-empty fields, but preserves existing non-empty fields
      merged.push({
        ...existing,
        ...Object.fromEntries(
          Object.entries(inc).filter(([, v]) => 
            v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
          )
        ),
      } as UnifiedEmployment)
      processedKeys.add(key)
    } else {
      merged.push(inc)
      processedKeys.add(key)
    }
  }
  
  // Add any existing entries that weren't in incoming
  for (const [key, emp] of existingMap) {
    if (!processedKeys.has(key)) {
      merged.push(emp)
    }
  }
  
  return merged
}

// =====================================================
// UTILITY: Check if profile has meaningful data
// =====================================================

/**
 * Check if a profile has meaningful data that can be used for prefill
 */
export function profileHasData(profile: UnifiedDriverProfile | null): boolean {
  if (!profile) return false
  
  return !!(
    profile.firstName ||
    profile.lastName ||
    profile.email ||
    profile.phone ||
    profile.cdlNumber ||
    profile.employmentHistory.length > 0
  )
}

/**
 * Count how many fields are populated in the profile
 */
export function countPopulatedFields(profile: UnifiedDriverProfile): {
  total: number
  populated: number
  percentage: number
} {
  const fields = [
    profile.firstName,
    profile.lastName,
    profile.email,
    profile.phone,
    profile.address,
    profile.city,
    profile.state,
    profile.zipCode,
    profile.cdlNumber,
    profile.cdlState,
    profile.cdlClass,
    profile.dateOfBirth,
  ]
  
  const populated = fields.filter((f) => f && f.trim() !== '').length
  const total = fields.length
  
  return {
    total,
    populated,
    percentage: Math.round((populated / total) * 100),
  }
}
