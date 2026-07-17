/**
 * Live resume projection — assemble a driver resume preview from DOT app
 * (in progress or complete) + block_* tables + MVR summary.
 *
 * Used by the career-card Resume chrome chip. Not a saved artifact; a
 * read-only projection that fills as the DQ file grows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EMPTY_DRIVER_PROFILE,
  type UnifiedDriverProfile,
} from '@/types/driver-profile'
import { allFormsToProfile } from '@/lib/dot-form-mapper'
import { getFullDriverProfile, getMvrData } from '@/lib/block-data'
import {
  mergeIntoProfile,
  profileToResumeBuilder,
  type ResumeBuilderData,
} from '@/lib/profile-mapper'
import {
  assembleDriverResumePacket,
  type DriverResumePacket,
} from '@/lib/driver-resume-packet'

export type ResumeProjectionStatus = 'not_started' | 'building' | 'ready'

export interface ResumeMvrSummary {
  licenseState: string | null
  licenseStatus: string | null
  totalPoints: number
  violationCount: number
  /** Honesty: issuer-backed MVR rollup — safe for "Verified by Storm" language */
  verifiedByStorm: true
}

export interface ResumeProjection {
  status: ResumeProjectionStatus
  title: string
  structuredData: ResumeBuilderData
  mvrSummary: ResumeMvrSummary | null
  /** Premium DOT-packet layout (preview + PDF) */
  packet: DriverResumePacket
  /** DOT app exists (any progress) */
  hasDotApp: boolean
  dotAppComplete: boolean
  /** Non-empty sections count for thin-state copy */
  filledSectionCount: number
  sources: {
    identity: boolean
    dotApp: boolean
    blockData: boolean
    mvr: boolean
  }
}

function emptyUnifiedProfile(userId: string): UnifiedDriverProfile {
  return {
    id: '',
    userId,
    ...EMPTY_DRIVER_PROFILE,
    createdAt: '',
    updatedAt: '',
  }
}

function countFilledSections(data: ResumeBuilderData, mvr: ResumeMvrSummary | null): number {
  let n = 0
  const pi = data.personalInfo
  if (pi.firstName?.trim() || pi.lastName?.trim()) n++
  if (pi.professionalSummary?.trim()) n++
  if (data.cdlInfo.cdlClass?.trim() || data.cdlInfo.cdlNumber?.trim()) n++
  if (data.employments.some((e) => e.companyName?.trim())) n++
  if (data.educations.some((e) => e.school?.trim())) n++
  if (data.skills.some((s) => s.name?.trim())) n++
  if (data.references.some((r) => r.name?.trim())) n++
  if (mvr) n++
  return n
}

function deriveStatus(opts: {
  filledSectionCount: number
  hasDotApp: boolean
  dotAppComplete: boolean
  hasSavedResume: boolean
}): ResumeProjectionStatus {
  if (opts.hasSavedResume || opts.dotAppComplete || opts.filledSectionCount >= 4) {
    return 'ready'
  }
  if (opts.hasDotApp || opts.filledSectionCount > 0) return 'building'
  return 'not_started'
}

/**
 * Build a live resume projection for the candidate hub Resume chip.
 */
export async function buildResumeProjection(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResumeProjection> {
  const [blockProfile, { data: up }, { data: dotApp }, mvrRow, { data: mvrResult }, { count: resumeCount }] =
    await Promise.all([
      getFullDriverProfile(supabase, userId),
      supabase
        .from('user_profiles')
        .select(
          'first_name, last_name, email, phone, date_of_birth, address, city, state, zip_code, headline',
        )
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('driver_applications')
        .select('id, is_complete, application_data, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getMvrData(supabase, userId),
      supabase
        .from('mvr_results')
        .select('license_state, license_status, total_points, violation_count')
        .eq('driver_user_id', userId)
        .eq('result_status', 'parsed')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('resumes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

  let profile = blockProfile ?? emptyUnifiedProfile(userId)
  const hasBlockData = Boolean(blockProfile)

  // Overlay in-progress or complete DOT forms (fresher than stale block rows)
  let hasDotApp = false
  let dotAppComplete = false
  if (dotApp?.application_data) {
    hasDotApp = true
    dotAppComplete = Boolean(dotApp.is_complete)
    const ad = dotApp.application_data as {
      form1?: unknown
      form2?: unknown
      form3?: unknown
    }
    const fromDot = allFormsToProfile(
      ad.form1 as Parameters<typeof allFormsToProfile>[0],
      ad.form2 as Parameters<typeof allFormsToProfile>[1],
      ad.form3 as Parameters<typeof allFormsToProfile>[2],
    )
    profile = mergeIntoProfile(profile, fromDot)
  }

  // Identity from user_profiles is authoritative when present
  if (up) {
    profile = mergeIntoProfile(profile, {
      firstName: up.first_name || '',
      lastName: up.last_name || '',
      email: up.email || '',
      phone: up.phone || '',
      dateOfBirth: up.date_of_birth || '',
      address: up.address || '',
      city: up.city || '',
      state: up.state || '',
      zipCode: up.zip_code || '',
      professionalSummary: up.headline || '',
    })
  }

  // Enrich summary from CDL when headline is empty
  if (!profile.professionalSummary?.trim()) {
    const bits: string[] = []
    if (profile.cdlClass) bits.push(`Class ${profile.cdlClass} CDL`)
    if (profile.cdlState) bits.push(`${profile.cdlState} licensed`)
    if (profile.endorsements?.length) {
      bits.push(`Endorsements: ${profile.endorsements.join(', ')}`)
    }
    if (bits.length) {
      profile.professionalSummary = `Professional commercial driver — ${bits.join(' · ')}.`
    }
  }

  const structuredData = profileToResumeBuilder(profile)

  // Issuer-backed MVR rollup only — never invent from empty block stubs
  const mvrSummary: ResumeMvrSummary | null =
    mvrResult || mvrRow?.result_id
      ? {
          licenseState: mvrResult?.license_state || profile.cdlState || null,
          licenseStatus: mvrResult?.license_status || mvrRow?.license_status || null,
          totalPoints: mvrResult?.total_points ?? mvrRow?.total_points ?? 0,
          violationCount: mvrResult?.violation_count ?? mvrRow?.violation_count ?? 0,
          verifiedByStorm: true,
        }
      : null

  const filledSectionCount = countFilledSections(structuredData, mvrSummary)
  const hasSavedResume = (resumeCount ?? 0) > 0
  const status = deriveStatus({
    filledSectionCount,
    hasDotApp,
    dotAppComplete,
    hasSavedResume,
  })

  const name = [structuredData.personalInfo.firstName, structuredData.personalInfo.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  const applicationData = (dotApp?.application_data as {
    form2?: { accidents?: unknown[] }
  } | null) ?? null

  const packet = await assembleDriverResumePacket(supabase, userId, {
    structuredData,
    mvrSummary,
    hasDotApp,
    dotUpdatedAt: (dotApp?.updated_at as string | null) ?? null,
    applicationData,
  })

  return {
    status,
    title: name ? `${name} — Resume` : 'Your live resume',
    structuredData,
    mvrSummary,
    packet,
    hasDotApp,
    dotAppComplete,
    filledSectionCount,
    sources: {
      identity: Boolean(up?.first_name || up?.last_name || up?.email),
      dotApp: hasDotApp,
      blockData: hasBlockData,
      mvr: Boolean(mvrSummary),
    },
  }
}
