/**
 * Unified Driver Profile Types
 * 
 * This is the single source of truth for driver data.
 * Both Resume Builder and DOT Application read from and write to this profile.
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
// NOTE: Identity fields (name, email, phone, address) are stored in the DB
// in user_profiles, NOT driver_profiles. They appear here for app-layer
// compatibility — the GET endpoint merges them from user_profiles.
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

// ===== DATABASE ROW TYPE =====
// What we get back from Supabase (snake_case)
// Matches the driver_profiles table after migration 042 (identity columns dropped).
// Identity (name, email, phone, address) now lives in user_profiles.
export interface DriverProfileRow {
  id: string
  user_id: string
  ssn_last_four: string | null
  professional_summary: string | null
  cdl_number: string | null
  cdl_state: string | null
  cdl_class: string | null
  cdl_expiration: string | null
  endorsements: string[] | null
  restrictions: string[] | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  employment_history: UnifiedEmployment[] | null
  references: UnifiedReference[] | null
  education: UnifiedEducation[] | null
  skills: UnifiedSkill[] | null
  driving_experience: DrivingExperience | null
  mvr_violations: MvrViolation[] | null
  mvr_accidents: MvrAccident[] | null
  mvr_last_updated: string | null
  last_updated_from: string | null
  created_at: string
  updated_at: string
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

// ===== CONVERSION HELPERS =====

/**
 * Convert database row (snake_case) to app type (camelCase)
 */
// Identity fields default to empty — the API layer merges them from user_profiles.
export function rowToProfile(row: DriverProfileRow): UnifiedDriverProfile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    ssnLastFour: row.ssn_last_four || undefined,
    address: '',
    city: '',
    state: '',
    zipCode: '',
    professionalSummary: row.professional_summary || '',
    cdlNumber: row.cdl_number || '',
    cdlState: row.cdl_state || '',
    cdlClass: row.cdl_class || '',
    cdlExpiration: row.cdl_expiration || '',
    endorsements: row.endorsements || [],
    restrictions: row.restrictions || [],
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactRelationship: row.emergency_contact_relationship || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    employmentHistory: row.employment_history || [],
    references: row.references || [],
    education: row.education || [],
    skills: row.skills || [],
    drivingExperience: row.driving_experience || null,
    mvrViolations: row.mvr_violations || [],
    mvrAccidents: row.mvr_accidents || [],
    mvrLastUpdated: row.mvr_last_updated || null,
    lastUpdatedFrom: row.last_updated_from as UnifiedDriverProfile['lastUpdatedFrom'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Truncate state to 2-character abbreviation.
 * Database column is VARCHAR(2), so longer values will cause insert failures.
 */
function truncateState(state: string | undefined | null): string | null {
  if (!state) return null
  // Take first 2 characters and uppercase (handles both "OH" and "Ohio" → "OH")
  return state.trim().slice(0, 2).toUpperCase() || null
}

/**
 * Convert app type (camelCase) to database format (snake_case)
 * Only includes fields that have values to avoid overwriting with nulls
 */
export function profileToRow(
  profile: Partial<UnifiedDriverProfile>,
  source: UnifiedDriverProfile['lastUpdatedFrom']
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    last_updated_from: source,
  }
  
  // Identity fields (name, email, phone, address) are NOT written here — they go to user_profiles.
  // Only role-specific driver_profiles columns below.
  if (profile.ssnLastFour !== undefined) row.ssn_last_four = profile.ssnLastFour || null
  if (profile.professionalSummary !== undefined) row.professional_summary = profile.professionalSummary || null
  if (profile.cdlNumber !== undefined) row.cdl_number = profile.cdlNumber || null
  if (profile.cdlState !== undefined) row.cdl_state = truncateState(profile.cdlState)
  if (profile.cdlClass !== undefined) row.cdl_class = profile.cdlClass || null
  if (profile.cdlExpiration !== undefined) row.cdl_expiration = profile.cdlExpiration || null
  if (profile.endorsements !== undefined) row.endorsements = profile.endorsements
  if (profile.restrictions !== undefined) row.restrictions = profile.restrictions
  if (profile.emergencyContactName !== undefined) row.emergency_contact_name = profile.emergencyContactName || null
  if (profile.emergencyContactRelationship !== undefined) row.emergency_contact_relationship = profile.emergencyContactRelationship || null
  if (profile.emergencyContactPhone !== undefined) row.emergency_contact_phone = profile.emergencyContactPhone || null
  if (profile.employmentHistory !== undefined) row.employment_history = profile.employmentHistory
  if (profile.references !== undefined) row.references = profile.references
  if (profile.education !== undefined) row.education = profile.education
  if (profile.skills !== undefined) row.skills = profile.skills
  if (profile.drivingExperience !== undefined) row.driving_experience = profile.drivingExperience
  
  return row
}
