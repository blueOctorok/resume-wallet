/**
 * Block Data Access Layer
 *
 * Typed read/write helpers for each block-owned data table.
 * Each block reads/writes its own table; cross-block reads use the
 * composite helpers at the bottom (getDotAppPrefillData, getResumePrefillData).
 *
 * All functions accept a Supabase admin client — callers are responsible
 * for creating it via getAdminSupabaseClient().
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  UnifiedDriverProfile,
  UnifiedEmployment,
  UnifiedReference,
  UnifiedEducation,
  UnifiedSkill,
  DrivingExperience,
  MvrViolation,
  MvrAccident,
} from '@/types/driver-profile'

// ── Row types (DB shape) ────────────────────────────────────────────────────

export interface CdlRow {
  id: string
  user_id: string
  cdl_number: string | null
  cdl_state: string | null
  cdl_class: string | null
  cdl_expiration: string | null
  endorsements: string[]
  restrictions: string[]
  created_at: string
  updated_at: string
}

export interface EmploymentRow {
  id: string
  user_id: string
  history: UnifiedEmployment[]
  updated_at: string
}

export interface MvrRow {
  id: string
  user_id: string
  order_id: string | null
  result_id: string | null
  expires_at: string | null
  license_status: string | null
  total_points: number
  violation_count: number
  violations: MvrViolation[]
  accidents: MvrAccident[]
  last_ordered_at: string | null
  last_updated: string | null
  created_at: string
  updated_at: string
}

export interface EmergencyRow {
  id: string
  user_id: string
  contact_name: string | null
  contact_relationship: string | null
  contact_phone: string | null
  created_at: string
  updated_at: string
}

export interface ExperienceRow {
  id: string
  user_id: string
  data: DrivingExperience | null
  created_at: string
  updated_at: string
}

export interface EducationRow {
  id: string
  user_id: string
  entries: UnifiedEducation[]
  updated_at: string
}

export interface SkillsRow {
  id: string
  user_id: string
  entries: UnifiedSkill[]
  updated_at: string
}

export interface ReferencesRow {
  id: string
  user_id: string
  entries: UnifiedReference[]
  updated_at: string
}

export interface DevGithubRow {
  id: string
  user_id: string
  username: string | null
  access_token: string | null
  connected_at: string | null
  data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DevPortfolioRow {
  id: string
  user_id: string
  portfolio_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  personal_website: string | null
  created_at: string
  updated_at: string
}

export interface DevProfileRow {
  id: string
  user_id: string
  bio: string | null
  years_experience: number | null
  employment_history: Record<string, unknown>[]
  job_types: string[]
  work_styles: string[]
  willing_to_relocate: boolean
  available_for_work: boolean
  certifications: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

// ── Generic upsert helper ───────────────────────────────────────────────────

async function upsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  data: Partial<T>,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from(table)
    .upsert(
      { user_id: userId, ...data, updated_at: now },
      { onConflict: 'user_id' },
    )
  if (error) console.error(`[block-data] upsert ${table} failed:`, error.message)
}

// ── READS ───────────────────────────────────────────────────────────────────

export async function getCdlData(supabase: SupabaseClient, userId: string): Promise<CdlRow | null> {
  const { data } = await supabase
    .from('block_driver_cdl')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as CdlRow | null
}

export async function getDriverEmployment(supabase: SupabaseClient, userId: string): Promise<UnifiedEmployment[]> {
  const { data } = await supabase
    .from('block_driver_employment')
    .select('history')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.history as UnifiedEmployment[]) ?? []
}

export async function getMvrData(supabase: SupabaseClient, userId: string): Promise<MvrRow | null> {
  const { data } = await supabase
    .from('block_driver_mvr')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as MvrRow | null
}

export async function getEmergencyContact(supabase: SupabaseClient, userId: string): Promise<EmergencyRow | null> {
  const { data } = await supabase
    .from('block_driver_emergency')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as EmergencyRow | null
}

export async function getDrivingExperience(supabase: SupabaseClient, userId: string): Promise<DrivingExperience | null> {
  const { data } = await supabase
    .from('block_driver_experience')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.data as DrivingExperience) ?? null
}

export async function getEducation(supabase: SupabaseClient, userId: string): Promise<UnifiedEducation[]> {
  const { data } = await supabase
    .from('block_education')
    .select('entries')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.entries as UnifiedEducation[]) ?? []
}

export async function getSkills(supabase: SupabaseClient, userId: string): Promise<UnifiedSkill[]> {
  const { data } = await supabase
    .from('block_skills')
    .select('entries')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.entries as UnifiedSkill[]) ?? []
}

export async function getReferences(supabase: SupabaseClient, userId: string): Promise<UnifiedReference[]> {
  const { data } = await supabase
    .from('block_references')
    .select('entries')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.entries as UnifiedReference[]) ?? []
}

export async function getDevGithub(supabase: SupabaseClient, userId: string): Promise<DevGithubRow | null> {
  const { data } = await supabase
    .from('block_dev_github')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as DevGithubRow | null
}

export async function getDevPortfolio(supabase: SupabaseClient, userId: string): Promise<DevPortfolioRow | null> {
  const { data } = await supabase
    .from('block_dev_portfolio')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as DevPortfolioRow | null
}

export async function getDevProfile(supabase: SupabaseClient, userId: string): Promise<DevProfileRow | null> {
  const { data } = await supabase
    .from('block_dev_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as DevProfileRow | null
}

// ── WRITES ──────────────────────────────────────────────────────────────────

export async function saveCdlData(
  supabase: SupabaseClient,
  userId: string,
  data: {
    cdl_number?: string | null
    cdl_state?: string | null
    cdl_class?: string | null
    cdl_expiration?: string | null
    endorsements?: string[]
    restrictions?: string[]
  },
): Promise<void> {
  await upsert(supabase, 'block_driver_cdl', userId, data)
}

export async function saveDriverEmployment(
  supabase: SupabaseClient,
  userId: string,
  history: UnifiedEmployment[],
): Promise<void> {
  await upsert(supabase, 'block_driver_employment', userId, { history })
}

export async function saveMvrData(
  supabase: SupabaseClient,
  userId: string,
  data: Partial<Omit<MvrRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await upsert(supabase, 'block_driver_mvr', userId, data)
}

export async function saveEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
  data: {
    contact_name?: string | null
    contact_relationship?: string | null
    contact_phone?: string | null
  },
): Promise<void> {
  await upsert(supabase, 'block_driver_emergency', userId, data)
}

export async function saveDrivingExperience(
  supabase: SupabaseClient,
  userId: string,
  experience: DrivingExperience | null,
): Promise<void> {
  await upsert(supabase, 'block_driver_experience', userId, { data: experience })
}

export async function saveEducation(
  supabase: SupabaseClient,
  userId: string,
  entries: UnifiedEducation[],
): Promise<void> {
  await upsert(supabase, 'block_education', userId, { entries })
}

export async function saveSkills(
  supabase: SupabaseClient,
  userId: string,
  entries: UnifiedSkill[],
): Promise<void> {
  await upsert(supabase, 'block_skills', userId, { entries })
}

export async function saveReferences(
  supabase: SupabaseClient,
  userId: string,
  entries: UnifiedReference[],
): Promise<void> {
  await upsert(supabase, 'block_references', userId, { entries })
}

export async function saveDevGithub(
  supabase: SupabaseClient,
  userId: string,
  data: {
    username?: string | null
    access_token?: string | null
    connected_at?: string | null
    data?: Record<string, unknown> | null
  },
): Promise<void> {
  await upsert(supabase, 'block_dev_github', userId, data)
}

export async function saveDevPortfolio(
  supabase: SupabaseClient,
  userId: string,
  data: {
    portfolio_url?: string | null
    linkedin_url?: string | null
    twitter_url?: string | null
    personal_website?: string | null
  },
): Promise<void> {
  await upsert(supabase, 'block_dev_portfolio', userId, data)
}

export async function saveDevProfile(
  supabase: SupabaseClient,
  userId: string,
  data: {
    bio?: string | null
    years_experience?: number | null
    employment_history?: Record<string, unknown>[]
    job_types?: string[]
    work_styles?: string[]
    willing_to_relocate?: boolean
    available_for_work?: boolean
    certifications?: Record<string, unknown>[]
  },
): Promise<void> {
  await upsert(supabase, 'block_dev_profile', userId, data)
}

// ── BLOCK-TO-BLOCK COMPOSITE READS ─────────────────────────────────────────
// These are the "cross-block" queries for prefill scenarios.

/** DOT application needs: CDL + employment + education + emergency + experience */
export async function getDotAppPrefillData(supabase: SupabaseClient, userId: string) {
  const [cdl, employment, education, emergency, experience, refs] = await Promise.all([
    getCdlData(supabase, userId),
    getDriverEmployment(supabase, userId),
    getEducation(supabase, userId),
    getEmergencyContact(supabase, userId),
    getDrivingExperience(supabase, userId),
    getReferences(supabase, userId),
  ])
  return { cdl, employment, education, emergency, experience, references: refs }
}

/** Resume builder needs: CDL + employment + education + skills + references */
export async function getResumePrefillData(supabase: SupabaseClient, userId: string) {
  const [cdl, employment, education, skills, refs] = await Promise.all([
    getCdlData(supabase, userId),
    getDriverEmployment(supabase, userId),
    getEducation(supabase, userId),
    getSkills(supabase, userId),
    getReferences(supabase, userId),
  ])
  return { cdl, employment, education, skills, references: refs }
}

/** Career card needs: CDL + employment + MVR + skills + education */
export async function getCareerCardData(supabase: SupabaseClient, userId: string) {
  const [cdl, employment, mvr, skills, education] = await Promise.all([
    getCdlData(supabase, userId),
    getDriverEmployment(supabase, userId),
    getMvrData(supabase, userId),
    getSkills(supabase, userId),
    getEducation(supabase, userId),
  ])
  return { cdl, employment, mvr, skills, education }
}

/** Full driver profile composed from all block tables */
export async function getFullDriverProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UnifiedDriverProfile | null> {
  const [cdl, employment, mvr, emergency, experience, education, skills, refs] =
    await Promise.all([
      getCdlData(supabase, userId),
      getDriverEmployment(supabase, userId),
      getMvrData(supabase, userId),
      getEmergencyContact(supabase, userId),
      getDrivingExperience(supabase, userId),
      getEducation(supabase, userId),
      getSkills(supabase, userId),
      getReferences(supabase, userId),
    ])

  // If no block data exists at all, the profile hasn't been created yet
  const hasAnyData = cdl || employment.length > 0 || mvr || emergency ||
    experience || education.length > 0 || skills.length > 0 || refs.length > 0

  if (!hasAnyData) return null

  return {
    id: '',
    userId,
    // Identity fields default to empty — API layer merges from user_profiles
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    professionalSummary: '',
    // CDL
    cdlNumber: cdl?.cdl_number || '',
    cdlState: cdl?.cdl_state || '',
    cdlClass: cdl?.cdl_class || '',
    cdlExpiration: cdl?.cdl_expiration || '',
    endorsements: cdl?.endorsements || [],
    restrictions: cdl?.restrictions || [],
    // Emergency
    emergencyContactName: emergency?.contact_name || '',
    emergencyContactRelationship: emergency?.contact_relationship || '',
    emergencyContactPhone: emergency?.contact_phone || '',
    // Collections
    employmentHistory: employment,
    references: refs,
    education,
    skills,
    drivingExperience: experience,
    // MVR
    mvrViolations: mvr?.violations || [],
    mvrAccidents: mvr?.accidents || [],
    mvrLastUpdated: mvr?.last_updated || null,
    // Metadata — block tables don't track lastUpdatedFrom
    lastUpdatedFrom: null,
    createdAt: cdl?.created_at || '',
    updatedAt: cdl?.updated_at || '',
  }
}

