/**
 * Premium “DOT packet” resume model — layout matching docs/midnight/example_resume.png.
 *
 * Class and license status show up only as proofs. An Accio proof is a fact
 * on the driving record and stays until that same fact has a Midnight proof.
 * A license proof is the confirmed barcode read. None of these is a DMV check
 * by itself, and a barcode is never a Midnight claim (DEC-2026-08-004).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields } from '@/lib/aamva-license'
import { hasValidMedicalCert } from '@/lib/accio-xml-parser'
import { getLicenseScan, getMvrAttestationContext } from '@/lib/block-data'
import { loadCardAttestedFacts } from '@/lib/card-attested-facts'
import { formatCardFactLabel } from '@/lib/card-fact-display'
import { normalizeAccioCdlClass } from '@/lib/fact-registry'
import { normalizeEndorsementLetter } from '@/lib/mvr-field-predicate'
import { getAppBaseUrl } from '@/lib/app-url'
import { writeResumeSummary } from '@/lib/resume-summary'
import { cdlStaleSentence, readCdlFreshness } from '@/lib/cdl-freshness'
import type { ResumeBuilderData } from '@/lib/profile-mapper'

/** Minimal MVR rollup — avoids circular import with resume-projection */
export interface PacketMvrSummary {
  licenseState: string | null
  licenseStatus: string | null
  totalPoints: number
  violationCount: number
}

export type ResumeProofTier = 'midnight' | 'accio' | 'dkim' | 'license'

/** Midnight, then Accio facts it has not replaced, then a DKIM employment reply, then the barcode. */
export function resumeProofRank(tier: ResumeProofTier | undefined): number {
  if (tier === 'midnight') return 0
  if (tier === 'accio') return 1
  if (tier === 'dkim') return 2
  return 3
}

export interface DriverResumeProofChip {
  id: string
  label: string
  /** True when this chip came from an attestation row. */
  attested?: boolean
  /**
   * midnight — the Accio fact after its circuit ran.
   * accio — that fact on the driving record, until Midnight replaces it.
   * dkim — a signed employer reply the driver accepted onto the resume.
   * license — confirmed barcode read.
   */
  tier?: ResumeProofTier
  /** "expires January 17, 2034" from this proof's own source. Omitted when that source has no date. */
  dateLabel?: string
  /** Overrides the tier's default cite. DKIM uses the signing domain. */
  cite?: string
}

export interface DriverResumeExperienceRow {
  titleLine: string
  dateRange: string
  bullets: string[]
}

export interface DriverResumePacket {
  fullName: string
  /** City and state. Class lives on a proof, not in this line. */
  tagline: string
  /** e.g. "email · phone" */
  contactLine: string
  /** Two sentences on the work. Null when there is nothing to describe. */
  summary: string | null
  proofChips: DriverResumeProofChip[]
  asOfLabel: string
  expiresLabel: string
  verifyUrl: string
  /** Host + path for footer display (no protocol) */
  verifyDisplayPath: string
  experience: DriverResumeExperienceRow[]
  /** Driver-stated safety line; omit section when null */
  safetySummary: string | null
  qrLabelTop: string
  footerTitle: string
  footerBody: string
  /** Shown when packet is nearly empty */
  thinStateHint: string | null
  /** Self-reported CDL date is in the past. Not an issuer finding. */
  freshnessNote: string | null
  hasVerifiedClaims: boolean
}

function generateShareToken(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/** Ensure the user has a career-card share token (QR target). */
export async function ensureShareToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('share_token')
    .eq('id', userId)
    .maybeSingle()

  const existing = (user?.share_token as string | null) ?? null
  if (existing) return existing

  const newToken = generateShareToken()
  const { error } = await supabase
    .from('users')
    .update({
      share_token: newToken,
      share_token_created_at: new Date().toISOString(),
      share_views_count: 0,
    })
    .eq('id', userId)

  if (error) {
    console.error('[RESUME PACKET] share token ensure failed:', error)
    // Still return a ephemeral token so QR encodes something; next load will retry persist
    return newToken
  }
  return newToken
}

function formatShortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

function formatYearMonth(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function formatYearOnly(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return String(d.getFullYear())
}

function buildExperience(data: ResumeBuilderData): DriverResumeExperienceRow[] {
  return data.employments
    .filter((e) => e.companyName?.trim() || e.position?.trim())
    .map((emp) => {
      const position = emp.position?.trim() || 'Driver'
      const company = emp.companyName?.trim() || 'Employer'
      const start = formatYearOnly(emp.startDate) || formatYearMonth(emp.startDate)
      const end = emp.isCurrent
        ? 'Present'
        : formatYearOnly(emp.endDate) || formatYearMonth(emp.endDate) || ''
      const dateRange = [start, end].filter(Boolean).join(' – ')
      const bullets = (emp.responsibilities || []).filter((r) => r?.trim())
      return {
        titleLine: `${position} — ${company}`,
        dateRange,
        bullets,
      }
    })
}

export interface BuildPacketInput {
  structuredData: ResumeBuilderData
  mvrSummary: PacketMvrSummary | null
  shareToken: string
  /** ISO timestamps for as-of */
  asOfCandidates: (string | null | undefined)[]
  pspResultOutcome?: string | null
  /** DOT Form 2 accidents array length when known */
  dotAccidentCount?: number | null
  attestedChips?: DriverResumeProofChip[]
  /** Confirmed barcode read. Omitted when the card was never confirmed. */
  licenseProof?: { label: string; expirationDate?: string | null } | null
  /** Parsed driver-owned Accio record. Facts it does not contain are skipped. */
  accioRecord?: {
    licenseClass: string | null
    endorsements: string[]
    restrictions: string[]
    medicalCertStatus: string | null
    medicalCertExpiration: string | null
    licenseExpiration: string | null
  } | null
  /** DKIM replies the driver accepted. A form reply never arrives here. */
  dkimProofs?: Array<{
    id: string
    employerName: string
    dkimDomain: string
    startDate: string | null
    endDate: string | null
    verifiedAt: string | null
  }>
  hasDotApp: boolean
}

function proofDay(raw: string | null | undefined): { day: string; when: string } | undefined {
  if (!raw?.trim()) return undefined
  const compact = raw.trim().match(/^(\d{4})(\d{2})(\d{2})$/)
  const iso = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  const day = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : iso?.[1]
  if (!day) return undefined
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return undefined
  const when = new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { day, when }
}

/** "expires January 17, 2034" from a YYYY-MM-DD or YYYYMMDD source date. */
export function proofDateLabel(raw: string | null | undefined, now: Date = new Date()): string | undefined {
  const parsed = proofDay(raw)
  if (!parsed) return undefined
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
  return parsed.day < today ? `expired ${parsed.when}` : `expires ${parsed.when}`
}

function dkimProofChips(rows: NonNullable<BuildPacketInput['dkimProofs']>): DriverResumeProofChip[] {
  return rows.flatMap((row) => {
    const employer = row.employerName.trim()
    const domain = row.dkimDomain.trim()
    if (!employer || !domain) return []
    const start = row.startDate?.slice(0, 4) ?? ''
    const end = row.endDate?.trim() ? row.endDate.slice(0, 4) : 'Present'
    const range = start ? `${start}–${end}` : ''
    const verified = proofDay(row.verifiedAt)
    return [{
      id: `dkim-${row.id}`,
      label: [employer, range].filter(Boolean).join(' · '),
      tier: 'dkim' as const,
      cite: domain,
      ...(verified ? { dateLabel: `verified ${verified.when}` } : {}),
    }]
  })
}

function withDate(chip: DriverResumeProofChip, raw: string | null | undefined): DriverResumeProofChip {
  const dateLabel = proofDateLabel(raw)
  return dateLabel ? { ...chip, dateLabel } : chip
}

/** Class, endorsements, and restrictions share the license date. The med card has its own. */
function recordDateForFact(
  factId: string,
  record: NonNullable<BuildPacketInput['accioRecord']> | null | undefined,
): string | null {
  if (!record) return null
  if (factId === 'med_cert_valid') return record.medicalCertExpiration
  if (
    factId === 'cdl_class' ||
    factId === 'cdl_class_a' ||
    factId === 'cdl_endorsements' ||
    factId === 'cdl_restrictions'
  ) {
    return record.licenseExpiration
  }
  return null
}

/** Facts the driving record actually contains. A shell with no class adds none. */
function accioRecordChips(
  record: NonNullable<BuildPacketInput['accioRecord']>,
): DriverResumeProofChip[] {
  const chips: DriverResumeProofChip[] = []
  const letter = normalizeAccioCdlClass(record.licenseClass)
  if (letter) {
    chips.push(
      withDate(
        {
          id: 'cdl_class',
          label: formatCardFactLabel('cdl_class', { class: letter }, `Class ${letter}`),
          tier: 'accio',
        },
        record.licenseExpiration,
      ),
    )
  }

  const endorsementLetters = record.endorsements
    .map((code) => normalizeEndorsementLetter(code))
    .filter((code): code is string => Boolean(code))
  if (endorsementLetters.length > 0) {
    chips.push(
      withDate(
        {
          id: 'cdl_endorsements',
          label: formatCardFactLabel(
            'cdl_endorsements',
            { endorsements: endorsementLetters.join(', ') },
            'Endorsements',
          ),
          tier: 'accio',
        },
        record.licenseExpiration,
      ),
    )
  }

  // "None" is only honest after a real license block was parsed.
  if (letter) {
    const raw = record.restrictions.map((code) => code.trim()).filter(Boolean)
    chips.push(
      withDate(
        {
          id: 'cdl_restrictions',
          label: formatCardFactLabel(
            'cdl_restrictions',
            { restrictions: raw.length > 0 ? raw.join(', ') : 'none' },
            'No restrictions',
          ),
          tier: 'accio',
        },
        record.licenseExpiration,
      ),
    )
  }

  if (hasValidMedicalCert(record.medicalCertStatus, record.medicalCertExpiration)) {
    chips.push(
      withDate(
        {
          id: 'med_cert_valid',
          label: formatCardFactLabel(
            'med_cert_valid',
            { expiration: record.medicalCertExpiration ?? '' },
            'Med card current',
          ),
          tier: 'accio',
        },
        record.medicalCertExpiration,
      ),
    )
  }

  return chips
}

/**
 * Pure builder — call after data fetch + share token ensure.
 */
export function buildDriverResumePacket(input: BuildPacketInput): DriverResumePacket {
  const pi = input.structuredData.personalInfo
  const cdl = input.structuredData.cdlInfo
  const fullName =
    [pi.firstName, pi.lastName].filter(Boolean).join(' ').trim() || 'Your name'

  const freshness = readCdlFreshness({
    cdlClass: cdl.cdlClass,
    expiration: cdl.expirationDate,
    endorsements: cdl.endorsements,
  })
  // Class is a proof (barcode or Midnight), for every letter. The header is place.
  const tagline = [pi.city, pi.state].filter(Boolean).join(', ')

  const contactLine = [pi.email, pi.phone].filter(Boolean).join(' · ')

  const proofChips: DriverResumeProofChip[] = (input.attestedChips ?? [])
    .filter((chip) => chip.tier === 'midnight')
    .map((chip) => withDate(chip, recordDateForFact(chip.id, input.accioRecord)))
  // A Midnight proof of a fact replaces that fact's Accio proof. The barcode stays.
  const proved = new Set(proofChips.map((chip) => chip.id))
  if (proved.has('cdl_class_a')) proved.add('cdl_class')
  if (input.accioRecord) {
    for (const chip of accioRecordChips(input.accioRecord)) {
      if (proved.has(chip.id)) continue
      proofChips.push(chip)
    }
  }
  proofChips.push(...dkimProofChips(input.dkimProofs ?? []))
  if (input.licenseProof?.label) {
    proofChips.push(
      withDate(
        {
          id: 'license-proof',
          label: input.licenseProof.label,
          tier: 'license',
        },
        input.licenseProof.expirationDate,
      ),
    )
  }
  const asOfDates = input.asOfCandidates
    .map((s) => (s ? new Date(s) : null))
    .filter((d): d is Date => Boolean(d && !Number.isNaN(d.getTime())))
  const asOf = asOfDates.length
    ? new Date(Math.max(...asOfDates.map((d) => d.getTime())))
    : new Date()
  const expires = new Date(asOf)
  expires.setDate(expires.getDate() + 90)

  const base = getAppBaseUrl()
  const verifyUrl = `${base}/card/${input.shareToken}`
  let verifyDisplayPath = verifyUrl.replace(/^https?:\/\//, '')
  try {
    const u = new URL(verifyUrl)
    verifyDisplayPath = `${u.host}${u.pathname}`
  } catch {
    /* keep stripped */
  }

  const experience = buildExperience(input.structuredData)

  // Driver-stated safety — only when we have a signal from DOT accidents or employment notes
  let safetySummary: string | null = null
  if (input.dotAccidentCount === 0 && input.hasDotApp) {
    safetySummary = 'No accidents reported on DOT application'
  }
  const safetyNotes = input.structuredData.employments
    .map((e) => e.safetyRecord?.trim())
    .filter(Boolean)
  if (safetyNotes.length > 0) {
    const joined = safetyNotes.slice(0, 2).join(' • ')
    safetySummary = safetySummary ? `${safetySummary} • ${joined}` : joined
  }

  const thin = proofChips.length === 0 && experience.length === 0

  return {
    fullName,
    tagline,
    contactLine,
    summary: null,
    proofChips,
    asOfLabel: formatShortDate(asOf),
    expiresLabel: formatShortDate(expires),
    verifyUrl,
    verifyDisplayPath,
    experience,
    safetySummary,
    qrLabelTop: 'DOT application packet',
    footerTitle: 'Full career card on Provven',
    footerBody:
      (input.attestedChips ?? []).length > 0
        ? 'Scan for the career card — verified credentials live there. This PDF does not include raw MVR/PSP.'
        : 'Open the link (or scan the QR). Driver-controlled career card. Does not include raw MVR/PSP.',
    thinStateHint: thin
      ? 'Start your DOT application to fill this packet — experience appears as you go.'
      : null,
    freshnessNote: cdlStaleSentence(freshness),
    hasVerifiedClaims: proofChips.some((chip) => chip.tier != null),
  }
}

/**
 * Fetch screening extras + share token, then build the packet.
 */
export async function assembleDriverResumePacket(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    structuredData: ResumeBuilderData
    mvrSummary: PacketMvrSummary | null
    hasDotApp: boolean
    dotUpdatedAt?: string | null
    applicationData?: { form2?: { accidents?: unknown[] } } | null
  },
): Promise<DriverResumePacket> {
  const shareToken = await ensureShareToken(supabase, userId)

  const [{ data: mvrExtra }, { data: pspOrder }, attestedFacts, licenseProof, accio, dkimRows] =
    await Promise.all([
    supabase
      .from('mvr_results')
      .select('received_at, result_status')
      .eq('driver_user_id', userId)
      .eq('result_status', 'parsed')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('psp_orders')
      .select('result_outcome, completed_at, status')
      .eq('driver_user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadCardAttestedFacts(supabase, userId),
    loadLicenseProof(supabase, userId),
    getMvrAttestationContext(supabase, userId),
    supabase
      .from('employment_verification_requests')
      .select('id, previous_employer_name, dkim_domain, claimed_start_date, claimed_end_date, verified_at')
      .eq('driver_id', userId)
      .eq('dkim_valid', true)
      .eq('driver_hidden', false)
      .not('resume_accepted_at', 'is', null)
      .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED']),
  ])

  const accidents = opts.applicationData?.form2?.accidents
  const dotAccidentCount = Array.isArray(accidents) ? accidents.length : null

  const packet = buildDriverResumePacket({
    structuredData: opts.structuredData,
    mvrSummary: opts.mvrSummary,
    shareToken,
    asOfCandidates: [
      mvrExtra?.received_at,
      opts.dotUpdatedAt,
      pspOrder?.completed_at,
    ],
    pspResultOutcome: pspOrder?.result_outcome ?? null,
    dotAccidentCount,
    hasDotApp: opts.hasDotApp,
    attestedChips: attestedFacts.map((f) => ({
      id: f.factType,
      label: f.label,
      attested: true,
      tier: f.provenOnMidnight ? ('midnight' as const) : undefined,
    })),
    licenseProof,
    accioRecord: accio
      ? {
          licenseClass: accio.licenseClass,
          endorsements: accio.endorsements,
          restrictions: accio.restrictions,
          medicalCertStatus: accio.medicalCertStatus,
          medicalCertExpiration: accio.medicalCertExpiration,
          licenseExpiration: accio.licenseExpiration,
        }
      : null,
    dkimProofs: (dkimRows.data ?? []).map((row) => ({
      id: String(row.id),
      employerName: String(row.previous_employer_name ?? ''),
      dkimDomain: String(row.dkim_domain ?? ''),
      startDate: (row.claimed_start_date as string | null) ?? null,
      endDate: (row.claimed_end_date as string | null) ?? null,
      verifiedAt: (row.verified_at as string | null) ?? null,
    })),
  })

  const filled = opts.structuredData.employments.filter(
    (job) => job.companyName?.trim() || job.position?.trim(),
  )
  const summary = await writeResumeSummary({
    licenseLabel: licenseProof?.label ?? null,
    endorsements: opts.structuredData.cdlInfo.endorsements,
    mvr: opts.mvrSummary
      ? {
          violationCount: opts.mvrSummary.violationCount,
          licenseStatus: opts.mvrSummary.licenseStatus,
        }
      : null,
    jobs: packet.experience.map((row, index) => ({
      titleLine: row.titleLine,
      dateRange: row.dateRange,
      bullets: row.bullets,
      miles: filled[index]?.milesDriven?.trim() || null,
    })),
  })
  return { ...packet, summary }
}

/** Class and state from a confirmed barcode. Not a state record. */
export async function loadLicenseProof(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ label: string; expirationDate: string | null } | null> {
  const scan = await getLicenseScan(supabase, userId)
  if (!scan?.confirmed_at || !isLicenseScanFields(scan.parsed_fields)) return null
  const classRaw = scan.parsed_fields.licenseClass.trim()
  const state = scan.parsed_fields.state.trim()
  const classLabel = classRaw
    ? `Class ${classRaw.replace(/^class\s+/i, '')}`
    : ''
  const label = [classLabel, state].filter(Boolean).join(' · ')
  return {
    label: label || 'Barcode read',
    expirationDate: scan.parsed_fields.expirationDate || null,
  }
}
