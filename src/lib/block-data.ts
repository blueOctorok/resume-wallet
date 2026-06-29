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

import { nanoid } from 'nanoid'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockDefinition } from '@/lib/block-registry'
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
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'
import type { ParsedResumeExtraction } from '@/types/resume-extraction'

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

/** Hub cache for FMCSA PSP / crash-inspection (candidate self-orders only). */
export interface PspRow {
  id: string
  user_id: string
  order_id: string | null
  result_id: string | null
  expires_at: string | null
  report_status: string | null
  last_ordered_at: string | null
  // Summary fields populated from accio-psp-parser. NULL when the PSP is still
  // pending or when the structured parse failed (raw_xml is the source of truth).
  crash_count: number | null
  inspection_count: number | null
  oos_count: number | null
  /**
   * Free-form roll-up the career card / hub uses to render badges + headline
   * stats without joining psp_results. Shape:
   *   { outcome, crashCount, inspectionCount, oosCount }
   */
  report_summary: Record<string, unknown> | null
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

/** Accio MVR order + parsed result — third-party provenance for attestation facts (P2.3). */
export interface MvrAttestationContext {
  mvr: MvrRow
  orderId: string
  accioOrderNumber: string
  orderStatus: string
  completedAt: string | null
  licenseClass: string | null
  /** True when the source pull is driver-owned (ordered_by_company_id IS NULL). */
  isDriverOwned: true
}

interface DriverOwnedMvrOrderRow {
  id: string
  status: string
  accio_order_number: string
  completed_at: string | null
  expires_at: string | null
  ordered_at: string | null
  ordered_by_company_id: string | null
}

async function getLatestDriverOwnedMvrOrder(
  supabase: SupabaseClient,
  userId: string,
): Promise<DriverOwnedMvrOrderRow | null> {
  const { data: order } = await supabase
    .from('mvr_orders')
    .select('id, status, accio_order_number, completed_at, expires_at, ordered_at, ordered_by_company_id')
    .eq('driver_user_id', userId)
    .is('ordered_by_company_id', null)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order?.accio_order_number || !isDriverOwnedScreeningOrder(order)) {
    return null
  }

  return order as DriverOwnedMvrOrderRow
}

function attestationMvrRowFromOrder(
  userId: string,
  order: DriverOwnedMvrOrderRow,
  blockMvr: MvrRow | null,
  result: {
    id: string
    license_class: string | null
    violations: MvrViolation[] | null
    accidents: MvrAccident[] | null
    total_points?: number | null
    violation_count?: number | null
    license_status?: string | null
  } | null,
): MvrRow {
  if (blockMvr?.order_id === order.id) {
    return blockMvr
  }

  const violations = (result?.violations as MvrViolation[] | null) ?? []
  const accidents = (result?.accidents as MvrAccident[] | null) ?? []
  const stamp = order.completed_at ?? order.ordered_at ?? new Date().toISOString()

  return {
    id: blockMvr?.id ?? '',
    user_id: userId,
    order_id: order.id,
    result_id: result?.id ?? null,
    expires_at: order.expires_at,
    license_status: result?.license_status ?? null,
    total_points: result?.total_points ?? violations.length,
    violation_count: result?.violation_count ?? violations.length,
    violations,
    accidents,
    last_ordered_at: order.ordered_at,
    last_updated: stamp,
    created_at: blockMvr?.created_at ?? stamp,
    updated_at: stamp,
  }
}

export async function getMvrAttestationContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<MvrAttestationContext | null> {
  const order = await getLatestDriverOwnedMvrOrder(supabase, userId)
  if (!order) return null

  const blockMvr = await getMvrData(supabase, userId)

  const { data: result } = await supabase
    .from('mvr_results')
    .select('id, license_class, violations, accidents, total_points, violation_count, license_status')
    .eq('mvr_order_id', order.id)
    .maybeSingle()

  return {
    mvr: attestationMvrRowFromOrder(userId, order, blockMvr, result as {
      id: string
      license_class: string | null
      violations: MvrViolation[] | null
      accidents: MvrAccident[] | null
      total_points?: number | null
      violation_count?: number | null
      license_status?: string | null
    } | null),
    orderId: order.id,
    accioOrderNumber: order.accio_order_number,
    orderStatus: order.status,
    completedAt: order.completed_at,
    licenseClass: result?.license_class ?? null,
    isDriverOwned: true,
  }
}

/** Prior-employer verification row — minimal fields for attestation (no FMCSA answer substance). */
export interface EmploymentVerificationAttestationRow {
  id: string
  employment_id: string
  previous_employer_name: string
  claimed_position: string
  claimed_start_date: string
  claimed_end_date: string | null
  verified_at: string | null
  status: string
}

export async function getEmploymentVerificationForAttestation(
  supabase: SupabaseClient,
  userId: string,
  parameters?: { employmentId?: string; verificationRequestId?: string },
): Promise<EmploymentVerificationAttestationRow | null> {
  let query = supabase
    .from('employment_verification_requests')
    .select(
      'id, employment_id, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, verified_at, status',
    )
    .eq('driver_id', userId)
    .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])

  if (parameters?.verificationRequestId) {
    query = query.eq('id', parameters.verificationRequestId)
  } else if (parameters?.employmentId) {
    query = query.eq('employment_id', parameters.employmentId)
  }

  const { data } = await query.order('verified_at', { ascending: false }).limit(1).maybeSingle()
  return data as EmploymentVerificationAttestationRow | null
}

export async function getPspData(supabase: SupabaseClient, userId: string): Promise<PspRow | null> {
  const { data } = await supabase
    .from('block_driver_psp')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as PspRow | null
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

export async function savePspData(
  supabase: SupabaseClient,
  userId: string,
  data: Partial<Omit<PspRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  await upsert(supabase, 'block_driver_psp', userId, data)
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

// ── Hub install + AI extraction apply ─────────────────────────────────────

/** Install a registry block at the end of the hub if missing. Returns true if inserted. */
export async function ensureHubBlockInstalled(
  supabase: SupabaseClient,
  userId: string,
  blockType: string,
): Promise<boolean> {
  const def = getBlockDefinition(blockType)
  if (!def) return false

  const { data: existing } = await supabase
    .from('hub_blocks')
    .select('id')
    .eq('user_id', userId)
    .eq('block_type', blockType)
    .maybeSingle()

  if (existing) return false

  const { data: maxRow } = await supabase
    .from('hub_blocks')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = typeof maxRow?.position === 'number' ? maxRow.position + 1 : 0

  const { error } = await supabase.from('hub_blocks').insert({
    user_id: userId,
    block_type: blockType,
    position,
    config: {},
  })

  if (error && error.code !== '23505') {
    console.error('[block-data] ensureHubBlockInstalled insert failed:', error.message)
    return false
  }

  return true
}

function employmentDedupeKey(e: UnifiedEmployment): string {
  return `${e.companyName.toLowerCase()}|${e.position.toLowerCase()}|${e.startDate}`
}

function mergeEmployments(existing: UnifiedEmployment[], incoming: UnifiedEmployment[]): UnifiedEmployment[] {
  const seen = new Set(existing.map(employmentDedupeKey))
  const add = incoming.filter((e) => !seen.has(employmentDedupeKey(e)))
  return [...existing, ...add]
}

/** Build stormchain_resume_v1 structured_data from AI extraction (career card + PDF verify). */
export function buildStructuredDataFromExtraction(ex: ParsedResumeExtraction): Record<string, unknown> {
  return {
    schema: 'stormchain_resume_v1',
    personalInfo: {
      firstName: ex.personalInfo?.firstName,
      lastName: ex.personalInfo?.lastName,
      email: ex.personalInfo?.email,
      phone: ex.personalInfo?.phone,
      city: ex.personalInfo?.city,
      state: ex.personalInfo?.state,
      zipCode: ex.personalInfo?.zipCode,
      professionalSummary: ex.personalInfo?.professionalSummary,
    },
    cdlInfo: ex.cdlInfo
      ? {
          cdlClass: ex.cdlInfo.cdlClass,
          cdlState: ex.cdlInfo.cdlState,
          cdlNumber: ex.cdlInfo.cdlNumber,
          expirationDate: ex.cdlInfo.cdlExpiration,
          endorsements: ex.cdlInfo.endorsements ?? [],
        }
      : undefined,
    employments: (ex.employments ?? []).map((e) => ({
      companyName: e.companyName,
      position: e.position,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      responsibilities: e.responsibilities ?? [],
    })),
    educations: (ex.educations ?? []).map((ed) => ({
      school: ed.school,
      degree: ed.degree,
      field: ed.field,
      year: ed.year,
      certifications: ed.certifications ?? [],
    })),
    skills: (ex.skills ?? []).map((s) => ({
      name: s.name,
      category: s.category ?? 'other',
    })),
    references: (ex.references ?? []).map((r) => ({
      name: r.name,
      phone: r.phone,
      email: r.email,
      relationship: r.relationship,
      title: r.title,
      company: r.company,
    })),
    _stormMeta: {
      source: 'ai-extracted',
      parsedAt: new Date().toISOString(),
    },
  }
}

export interface SaveExtractedResumeResult {
  newlyInstalledBlocks: string[]
  updated: {
    cdl: boolean
    employment: boolean
    education: boolean
    skills: boolean
    references: boolean
    profile: boolean
    resumeStructuredData: boolean
  }
}

/**
 * Merge AI extraction into block_* tables, user_profiles, and the given resume's structured_data.
 */
export async function saveExtractedResumeData(
  supabase: SupabaseClient,
  userId: string,
  resumeId: string,
  extraction: ParsedResumeExtraction,
): Promise<SaveExtractedResumeResult> {
  const newlyInstalledBlocks: string[] = []
  const updated: SaveExtractedResumeResult['updated'] = {
    cdl: false,
    employment: false,
    education: false,
    skills: false,
    references: false,
    profile: false,
    resumeStructuredData: false,
  }

  if (await ensureHubBlockInstalled(supabase, userId, 'storm-resume')) {
    newlyInstalledBlocks.push('storm-resume')
  }

  const cdl = extraction.cdlInfo
  if (
    cdl &&
    (cdl.cdlClass ||
      cdl.cdlState ||
      cdl.cdlNumber ||
      cdl.cdlExpiration ||
      (cdl.endorsements && cdl.endorsements.length > 0))
  ) {
    if (await ensureHubBlockInstalled(supabase, userId, 'driver-cdl-credentials')) {
      newlyInstalledBlocks.push('driver-cdl-credentials')
    }
    await saveCdlData(supabase, userId, {
      cdl_number: cdl.cdlNumber ?? null,
      cdl_state: cdl.cdlState ?? null,
      cdl_class: cdl.cdlClass ?? null,
      cdl_expiration: cdl.cdlExpiration ?? null,
      endorsements: cdl.endorsements ?? [],
      restrictions: [],
    })
    updated.cdl = true
  }

  if (extraction.employments && extraction.employments.length > 0) {
    const existing = await getDriverEmployment(supabase, userId)
    const incoming: UnifiedEmployment[] = extraction.employments.map((e) => ({
      id: nanoid(),
      companyName: (e.companyName ?? '').trim() || 'Unknown',
      position: (e.position ?? '').trim() || 'Role',
      location: (e.location ?? '').trim(),
      startDate: e.startDate ?? '',
      endDate: e.endDate ?? '',
      isCurrent: Boolean(e.isCurrent),
      responsibilities: e.responsibilities ?? [],
      equipment: [],
    }))
    await saveDriverEmployment(supabase, userId, mergeEmployments(existing, incoming))
    updated.employment = true
  }

  if (extraction.educations && extraction.educations.length > 0) {
    const existing = await getEducation(supabase, userId)
    const incoming: UnifiedEducation[] = extraction.educations.map((ed) => ({
      id: nanoid(),
      school: (ed.school ?? '').trim(),
      degree: (ed.degree ?? '').trim(),
      field: (ed.field ?? '').trim(),
      year: ed.year ?? '',
      certifications: ed.certifications ?? [],
    }))
    await saveEducation(supabase, userId, [...existing, ...incoming])
    updated.education = true
  }

  if (extraction.skills && extraction.skills.length > 0) {
    const existing = await getSkills(supabase, userId)
    const incoming: UnifiedSkill[] = extraction.skills
      .filter((s) => (s.name ?? '').trim().length > 0)
      .map((s) => {
        const cat = s.category
        const safe: UnifiedSkill['category'] =
          cat === 'equipment' || cat === 'route' || cat === 'technology' || cat === 'safety' ? cat : 'other'
        return {
          id: nanoid(),
          name: s.name.trim(),
          category: safe,
        }
      })
    await saveSkills(supabase, userId, [...existing, ...incoming])
    updated.skills = true
  }

  if (extraction.references && extraction.references.length > 0) {
    const existing = await getReferences(supabase, userId)
    const incoming: UnifiedReference[] = extraction.references.map((r) => ({
      id: nanoid(),
      name: (r.name ?? '').trim(),
      phone: (r.phone ?? '').trim(),
      email: (r.email ?? '').trim(),
      relationship: (r.relationship ?? '').trim(),
      title: r.title,
      company: r.company,
    }))
    await saveReferences(supabase, userId, [...existing, ...incoming])
    updated.references = true
  }

  const pi = extraction.personalInfo
  if (
    pi &&
    (pi.firstName ||
      pi.lastName ||
      pi.email ||
      pi.phone ||
      pi.city ||
      pi.state ||
      pi.professionalSummary)
  ) {
    const patch: Record<string, string | undefined> = {}
    if (pi.firstName?.trim()) patch.first_name = pi.firstName.trim()
    if (pi.lastName?.trim()) patch.last_name = pi.lastName.trim()
    if (pi.email?.trim()) patch.email = pi.email.trim()
    if (pi.phone?.trim()) patch.phone = pi.phone.trim()
    if (pi.city?.trim()) patch.city = pi.city.trim()
    if (pi.state?.trim()) patch.state = pi.state.trim()
    if (pi.professionalSummary?.trim()) patch.professional_summary = pi.professionalSummary.trim()

    const { data: prof } = await supabase.from('user_profiles').select('user_id').eq('user_id', userId).maybeSingle()

    if (prof) {
      await supabase.from('user_profiles').update(patch).eq('user_id', userId)
    } else {
      await supabase.from('user_profiles').insert({ user_id: userId, ...patch })
    }
    updated.profile = true
  }

  const structuredData = buildStructuredDataFromExtraction(extraction)
  const { error: resumeErr } = await supabase
    .from('resumes')
    .update({ structured_data: structuredData })
    .eq('id', resumeId)
    .eq('user_id', userId)

  if (resumeErr) {
    console.error('[block-data] saveExtractedResumeData resume update failed:', resumeErr.message)
  } else {
    updated.resumeStructuredData = true
  }

  return { newlyInstalledBlocks, updated }
}

