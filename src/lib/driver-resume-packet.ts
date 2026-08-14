/**
 * Premium “DOT packet” resume model — layout matching docs/midnight/example_resume.png.
 *
 * Green-dot chips are issuer-backed / structured claims ready for Phase 3 ZK.
 * Label as Provven-verified — never “proven on Midnight” until proofs are live.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { hasValidMedicalCert } from '@/lib/accio-xml-parser'
import { loadCardAttestedFacts } from '@/lib/card-attested-facts'
import { getAppBaseUrl } from '@/lib/app-url'
import type { ResumeBuilderData } from '@/lib/profile-mapper'

/** Minimal MVR rollup — avoids circular import with resume-projection */
export interface PacketMvrSummary {
  licenseState: string | null
  licenseStatus: string | null
  totalPoints: number
  violationCount: number
}

export interface DriverResumeProofChip {
  id: string
  label: string
}

export interface DriverResumeExperienceRow {
  titleLine: string
  dateRange: string
  bullets: string[]
}

export interface DriverResumePacket {
  fullName: string
  /** e.g. "CDL Class A • Indianapolis, IN" */
  tagline: string
  /** e.g. "email · phone" */
  contactLine: string
  proofChips: DriverResumeProofChip[]
  asOfLabel: string
  expiresLabel: string
  verifyUrl: string
  /** Host + path for footer display (no protocol) */
  verifyDisplayPath: string
  credentials: string[]
  experience: DriverResumeExperienceRow[]
  /** Driver-stated safety line; omit section when null */
  safetySummary: string | null
  qrLabelTop: string
  footerTitle: string
  footerBody: string
  /** Shown when packet is nearly empty */
  thinStateHint: string | null
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

function normalizeEndorsements(raw: string[]): { labels: string[]; hasHazmat: boolean; hasTanker: boolean } {
  const labels: string[] = []
  let hasHazmat = false
  let hasTanker = false
  for (const e of raw) {
    const t = e.trim()
    if (!t) continue
    const lower = t.toLowerCase()
    const isHazmat =
      lower === 'h' || lower.includes('hazmat') || lower.includes('hazardous')
    const isTanker = lower === 'n' || lower.includes('tanker') || lower.includes('tank')
    if (isHazmat) hasHazmat = true
    if (isTanker) hasTanker = true
    if (isHazmat || isTanker) continue
    labels.push(t)
  }
  return { labels, hasHazmat, hasTanker }
}

function isLicenseValidStatus(status: string | null | undefined): boolean {
  if (!status?.trim()) return false
  const s = status.trim().toLowerCase()
  if (s.includes('valid') || s.includes('eligible') || s === 'ok' || s === 'active') return true
  if (s.includes('suspend') || s.includes('revok') || s.includes('disqual') || s.includes('cancel')) {
    return false
  }
  return false
}

function isPspNoDq(outcome: string | null | undefined): boolean {
  if (!outcome) return false
  const o = outcome.toLowerCase()
  return o === 'clear' || o === 'no_hits' || o === 'pass'
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
  medicalCertStatus?: string | null
  medicalCertExpiration?: string | null
  pspResultOutcome?: string | null
  /** DOT Form 2 accidents array length when known */
  dotAccidentCount?: number | null
  attestedChips?: DriverResumeProofChip[]
  hasDotApp: boolean
}

/**
 * Pure builder — call after data fetch + share token ensure.
 */
export function buildDriverResumePacket(input: BuildPacketInput): DriverResumePacket {
  const pi = input.structuredData.personalInfo
  const cdl = input.structuredData.cdlInfo
  const fullName =
    [pi.firstName, pi.lastName].filter(Boolean).join(' ').trim() || 'Your name'

  const cdlClass = cdl.cdlClass?.trim()
  const location = [pi.city, pi.state].filter(Boolean).join(', ')
  const taglineParts: string[] = []
  if (cdlClass) taglineParts.push(`CDL Class ${cdlClass}`)
  if (location) taglineParts.push(location)
  const tagline = taglineParts.join(' • ')

  const contactLine = [pi.email, pi.phone].filter(Boolean).join(' · ')

  const endorsements = Array.isArray(cdl.endorsements) ? cdl.endorsements : []
  const { labels: otherEndorsements, hasHazmat, hasTanker } = normalizeEndorsements(endorsements)

  const attestedIds = new Set((input.attestedChips ?? []).map((c) => c.id))
  const proofChips: DriverResumeProofChip[] = [...(input.attestedChips ?? [])]
  const hasAttestedClass = attestedIds.has('cdl_class') || attestedIds.has('cdl_class_a')
  if (
    cdlClass &&
    !hasAttestedClass &&
    !proofChips.some((c) => c.id === 'cdl-class' || c.id.startsWith('cdl_class'))
  ) {
    proofChips.push({ id: 'cdl-class', label: `CDL Class ${cdlClass}` })
  }
  if (!attestedIds.has('cdl_endorsements')) {
    if (hasHazmat && hasTanker) {
      proofChips.push({ id: 'endorsements-ht', label: 'Hazmat + Tanker' })
    } else if (hasHazmat) {
      proofChips.push({ id: 'endorsements-h', label: 'Hazmat' })
    } else if (hasTanker) {
      proofChips.push({ id: 'endorsements-n', label: 'Tanker' })
    }
  }

  const medOk = hasValidMedicalCert(input.medicalCertStatus, input.medicalCertExpiration)
  if (medOk && !attestedIds.has('med_cert_valid')) {
    proofChips.push({ id: 'med-card', label: 'Med card current' })
  }

  if (isPspNoDq(input.pspResultOutcome)) {
    proofChips.push({ id: 'psp-no-dq', label: 'PSP: no DQ' })
  }

  const licenseStatus =
    input.mvrSummary?.licenseStatus || null
  if (isLicenseValidStatus(licenseStatus)) {
    proofChips.push({ id: 'license-valid', label: 'License valid' })
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

  const credentials: string[] = []
  if (cdlClass) {
    const endBits: string[] = []
    if (hasTanker) endBits.push('tanker')
    if (hasHazmat) endBits.push('hazmat')
    for (const o of otherEndorsements.slice(0, 3)) endBits.push(o)
    const endPhrase = endBits.length ? ` — ${endBits.join(' & ')} endorsements` : ''
    const state = cdl.cdlState?.trim()
    const exp = cdl.expirationDate?.trim()
    let expBit = ''
    if (exp) {
      try {
        const d = new Date(exp)
        expBit = Number.isNaN(d.getTime())
          ? `, exp ${exp}`
          : `, exp ${d.toISOString().slice(0, 7)}`
      } catch {
        expBit = `, exp ${exp}`
      }
    }
    credentials.push(
      `CDL Class ${cdlClass}${endPhrase}${state ? ` (${state}${expBit})` : expBit ? ` (${expBit.replace(/^, /, '')})` : ''}`,
    )
  }
  if (medOk) {
    credentials.push('DOT medical certificate — current')
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

  const thin =
    proofChips.length === 0 && credentials.length === 0 && experience.length === 0

  return {
    fullName,
    tagline,
    contactLine,
    proofChips,
    asOfLabel: formatShortDate(asOf),
    expiresLabel: formatShortDate(expires),
    verifyUrl,
    verifyDisplayPath,
    credentials,
    experience,
    safetySummary,
    qrLabelTop: 'DOT application packet',
    footerTitle: 'Full career card on Provven',
    footerBody:
      'Open the link (or scan the QR with a phone). Driver-controlled Candidate Card — proved claims + attestation metadata. Does not include raw MVR/PSP.',
    thinStateHint: thin
      ? 'Start your DOT application to fill this packet — credentials and experience appear as you go.'
      : null,
    hasVerifiedClaims: proofChips.length > 0,
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

  const [{ data: mvrExtra }, { data: pspOrder }, attestedFacts] = await Promise.all([
    supabase
      .from('mvr_results')
      .select(
        'medical_cert_status, medical_cert_expiration, license_status, received_at, result_status',
      )
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
  ])

  const accidents = opts.applicationData?.form2?.accidents
  const dotAccidentCount = Array.isArray(accidents) ? accidents.length : null

  return buildDriverResumePacket({
    structuredData: opts.structuredData,
    mvrSummary: opts.mvrSummary,
    shareToken,
    asOfCandidates: [
      mvrExtra?.received_at,
      opts.dotUpdatedAt,
      pspOrder?.completed_at,
    ],
    medicalCertStatus: mvrExtra?.medical_cert_status ?? null,
    medicalCertExpiration: mvrExtra?.medical_cert_expiration ?? null,
    pspResultOutcome: pspOrder?.result_outcome ?? null,
    dotAccidentCount,
    hasDotApp: opts.hasDotApp,
    attestedChips: attestedFacts.map((f) => ({ id: f.factType, label: f.label })),
  })
}
