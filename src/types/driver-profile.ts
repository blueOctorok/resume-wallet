/**
 * Unified Driver Profile Types
 * 
 * App-layer types for driver data. The underlying storage uses block_* tables,
 * but these types represent the unified shape used by Resume Builder and
 * DOT Application for prefill and cross-block data sharing.
 * 
 * Design Philosophy:
 * - Store a SUPERSET of fields from both forms
 * - When mapping to a specific form, only use the fields that form needs
 * - When saving from a form, merge new data without overwriting unrelated fields
 */

// ===== EMPLOYMENT HISTORY =====
// Superset of Resume Builder + DOT Application fields
export interface UnifiedEmployment {
  id: string
  companyName: string
  position: string
  location: string
  startDate: string
  endDate: string
  isCurrent: boolean
  // Resume Builder fields
  responsibilities: string[]
  equipment: string[]
  milesDriven?: string
  safetyRecord?: string
  // DOT Application fields
  reasonForLeaving?: string
  supervisorName?: string
  supervisorPhone?: string
  supervisorEmail?: string
  subjectToFMCSR?: boolean
  subjectToDrugTest?: boolean
}

// ===== REFERENCES =====
// Superset of Resume Builder + DOT Application fields
export interface UnifiedReference {
  id: string
  name: string
  phone: string
  email: string
  relationship: string
  // Resume Builder fields
  title?: string
  company?: string
  // DOT Application fields
  yearsKnown?: string
}

// ===== EDUCATION =====
// From Resume Builder (DOT doesn't have education section)
export interface UnifiedEducation {
  id: string
  school: string
  degree: string
  field: string
  year: string
  certifications: string[]
}

// ===== SKILLS =====
// From Resume Builder
export interface UnifiedSkill {
  id: string
  name: string
  category: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

// ===== DRIVING EXPERIENCE =====
// From DOT Application (but useful for resume too)
export interface EquipmentExperience {
  years: number
  miles: number
}

export interface SpecializedEquipment extends EquipmentExperience {
  type: string
}

export interface DrivingExperience {
  equipmentTypes: {
    straightTruck: EquipmentExperience
    tractorTrailer: EquipmentExperience
    tractorTwoTrailers: EquipmentExperience
    specializedEquipment: SpecializedEquipment[]
  }
  specialSkills: {
    moffettForklift: boolean
    craneOperations: boolean
    hazmatHandling: boolean
    borderCrossing: boolean
  }
}

// ===== MVR DATA =====
// Read-only from MVR purchase
export interface MvrViolation {
  date: string
  violation: string
  state: string
  points?: number
  fine?: number
}

export interface MvrAccident {
  date: string
  description: string
  atFault: boolean
  injuries: boolean
  fatalities: boolean
}

// ===== MAIN UNIFIED PROFILE =====
// NOTE: Identity fields (name, email, phone, address) are stored in user_profiles.
// Role-specific fields live in block_* tables. They appear here for app-layer
// compatibility — the GET endpoint merges them from multiple sources.
export interface UnifiedDriverProfile {
  id: string
  userId: string
  
  // Personal Information (sourced from user_profiles at DB layer)
  firstName: string
  middleName: string              // DOT has this
  lastName: string
  email: string
  phone: string
  dateOfBirth: string             // DOT required
  ssnLastFour?: string            // DOT only, display only
  
  // Address (sourced from user_profiles at DB layer)
  address: string
  city: string
  state: string
  zipCode: string
  
  // Professional Summary (Resume feature)
  professionalSummary: string
  
  // CDL Information (100% shared)
  cdlNumber: string
  cdlState: string
  cdlClass: string
  cdlExpiration: string
  endorsements: string[]
  restrictions: string[]
  
  // Emergency Contact (DOT feature)
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
  
  // Complex nested data
  employmentHistory: UnifiedEmployment[]
  references: UnifiedReference[]
  education: UnifiedEducation[]
  skills: UnifiedSkill[]
  drivingExperience: DrivingExperience | null
  
  // MVR data (read-only)
  mvrViolations: MvrViolation[]
  mvrAccidents: MvrAccident[]
  mvrLastUpdated: string | null
  
  // Metadata
  lastUpdatedFrom: 'resume_builder' | 'dot_application' | 'mvr' | 'uploaded_resume' | 'manual' | null
  createdAt: string
  updatedAt: string
}

// ===== EMPTY PROFILE =====
// Default values for new profiles
export const EMPTY_DRIVER_PROFILE: Omit<UnifiedDriverProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  ssnLastFour: undefined,
  address: '',
  city: '',
  state: '',
  zipCode: '',
  professionalSummary: '',
  cdlNumber: '',
  cdlState: '',
  cdlClass: '',
  cdlExpiration: '',
  endorsements: [],
  restrictions: [],
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  employmentHistory: [],
  references: [],
  education: [],
  skills: [],
  drivingExperience: null,
  mvrViolations: [],
  mvrAccidents: [],
  mvrLastUpdated: null,
  lastUpdatedFrom: null,
}

