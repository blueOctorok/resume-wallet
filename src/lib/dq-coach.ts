/**
 * DQ file watcher — Anthropic reviews the driver's blocks + card facts.
 * Not a chat: one structured brief (next step + mismatches) for the Build board.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCdlData, getDriverEmployment, getMvrData, getPspData } from '@/lib/block-data'
import { loadDriverDqSnapshot } from '@/lib/dq-file-load'
import { getBlockDefinition } from '@/lib/block-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

export type DqCoachTarget =
  | 'profile'
  | 'dotapp'
  | 'mvr'
  | 'psp'
  | 'screening-consent'
  | 'employment-verification'
  | null

export interface DqCoachFlag {
  severity: 'warn' | 'info'
  title: string
  detail: string
}

export interface DqCoachReview {
  watching: string
  next: { title: string; detail: string; target: DqCoachTarget } | null
  flags: DqCoachFlag[]
  clear: string[]
}

export interface DqCoachSnapshot {
  profile: {
    name: string | null
    city: string | null
    state: string | null
    hasPhone: boolean
    hasEmail: boolean
  }
  blocks: string[]
  dqItems: Array<{ id: string; label: string; status: DqItemStatus }>
  cdl: {
    state: string | null
    class: string | null
    expiration: string | null
    endorsements: string[]
  } | null
  mvr: {
    licenseStatus: string | null
    points: number
    violationCount: number
    lastOrderedAt: string | null
  } | null
  psp: {
    reportStatus: string | null
    crashCount: number | null
    inspectionCount: number | null
  } | null
  employment: Array<{
    company: string
    position: string
    start: string
    end: string
    current: boolean
  }>
}

const TARGETS = new Set<string>([
  'profile',
  'dotapp',
  'mvr',
  'psp',
  'screening-consent',
  'employment-verification',
])

const DQ_TO_TARGET: Record<string, DqCoachTarget> = {
  mvr: 'mvr',
  psp: 'psp',
  dot_application: 'dotapp',
  cdlis_consent: 'screening-consent',
  employment_verification: 'employment-verification',
}

export async function buildDqCoachSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<DqCoachSnapshot> {
  const [
    { data: profile },
    { data: hubBlocks },
    dqFile,
    cdl,
    employment,
    mvr,
    psp,
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name, display_name, city, state, phone, email')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('hub_blocks').select('block_type').eq('user_id', userId),
    loadDriverDqSnapshot(supabase, userId),
    getCdlData(supabase, userId),
    getDriverEmployment(supabase, userId),
    getMvrData(supabase, userId),
    getPspData(supabase, userId),
  ])

  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : ''
  const last = typeof profile?.last_name === 'string' ? profile.last_name.trim() : ''
  const display = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  const name = [first, last].filter(Boolean).join(' ') || display || null

  return {
    profile: {
      name,
      city: typeof profile?.city === 'string' ? profile.city : null,
      state: typeof profile?.state === 'string' ? profile.state : null,
      hasPhone: Boolean(profile?.phone),
      hasEmail: Boolean(profile?.email),
    },
    blocks: (hubBlocks ?? []).map((b) => String(b.block_type)),
    dqItems: dqFile.items.map((i) => ({ id: i.id, label: i.label, status: i.status })),
    cdl: cdl
      ? {
          state: cdl.cdl_state,
          class: cdl.cdl_class,
          expiration: cdl.cdl_expiration,
          endorsements: cdl.endorsements ?? [],
        }
      : null,
    mvr: mvr
      ? {
          licenseStatus: mvr.license_status,
          points: mvr.total_points,
          violationCount: mvr.violation_count,
          lastOrderedAt: mvr.last_ordered_at,
        }
      : null,
    psp: psp
      ? {
          reportStatus: psp.report_status,
          crashCount: psp.crash_count,
          inspectionCount: psp.inspection_count,
        }
      : null,
    employment: employment
      .filter((e) => e.companyName || e.position)
      .slice(0, 12)
      .map((e) => ({
        company: e.companyName,
        position: e.position,
        start: e.startDate,
        end: e.endDate,
        current: e.isCurrent,
      })),
  }
}

function parseDay(raw: string | null | undefined): Date | null {
  if (!raw) return null
  // Date-only strings are UTC midnight — compare calendar days, not local clock.
  const day = raw.slice(0, 10)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? new Date(`${day}T12:00:00`)
    : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function employmentGapFlags(
  jobs: DqCoachSnapshot['employment'],
): DqCoachFlag[] {
  const dated = jobs
    .map((j) => {
      const start = parseDay(j.start)
      const end = j.current ? new Date() : parseDay(j.end)
      if (!start || !end) return null
      return { ...j, start, end }
    })
    .filter((j): j is NonNullable<typeof j> => j !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const flags: DqCoachFlag[] = []
  for (let i = 1; i < dated.length; i++) {
    const prev = dated[i - 1]
    const cur = dated[i]
    const gapDays = (cur.start.getTime() - prev.end.getTime()) / 86_400_000
    if (gapDays > 31) {
      flags.push({
        severity: 'info',
        title: `Employment gap · ${prev.company || 'prior job'}`,
        detail: `${Math.round(gapDays)} days between ${prev.company || 'a job'} and ${cur.company || 'the next role'}. DOT asks you to explain gaps.`,
      })
    }
  }
  return flags
}

export function heuristicDqReview(snapshot: DqCoachSnapshot): DqCoachReview {
  const flags: DqCoachFlag[] = []
  const profileState = snapshot.profile.state?.trim().toUpperCase() || null
  const cdlState = snapshot.cdl?.state?.trim().toUpperCase() || null
  if (profileState && cdlState && profileState !== cdlState) {
    flags.push({
      severity: 'warn',
      title: 'License state vs profile',
      detail: `Profile lists ${profileState} but CDL is ${cdlState}. Carriers notice that.`,
    })
  }
  const exp = parseDay(snapshot.cdl?.expiration ?? null)
  if (exp && exp.getTime() < Date.now()) {
    flags.push({
      severity: 'warn',
      title: 'CDL looks expired',
      detail: `Expiration on file is ${snapshot.cdl?.expiration}. Update it if you've renewed.`,
    })
  }
  if (!snapshot.profile.name) {
    flags.push({
      severity: 'info',
      title: 'Name missing',
      detail: 'Finish your profile so the career card and packet share the same name.',
    })
  }
  if (!snapshot.profile.hasPhone || !snapshot.profile.hasEmail) {
    flags.push({
      severity: 'info',
      title: 'Contact incomplete',
      detail: [
        !snapshot.profile.hasPhone ? 'No phone' : null,
        !snapshot.profile.hasEmail ? 'No email' : null,
      ]
        .filter(Boolean)
        .join(' · ') + ' on the profile.',
    })
  }

  // One card per DQ hole — this is the floor. The model only adds extra wording.
  for (const item of snapshot.dqItems) {
    if (
      item.status === 'complete' ||
      item.status === 'processing' ||
      item.status === 'coming_soon' ||
      item.status === 'needs_gov' ||
      item.status === 'needs_employer'
    ) {
      continue
    }
    if (item.status === 'needs_driver' || item.status === 'needs_key') {
      flags.push({
        severity: 'info',
        title: `${item.label} waiting on you`,
        detail:
          item.status === 'needs_key'
            ? 'A key or consent step is still open before this can complete.'
            : 'This item needs a driver action before it can go on the card.',
      })
      continue
    }
    if (item.status === 'requested') {
      flags.push({
        severity: 'warn',
        title: `${item.label} requested`,
        detail: 'An employer asked for this — finish it before they move on.',
      })
      continue
    }
    if (item.status === 'failed') {
      flags.push({
        severity: 'warn',
        title: `${item.label} failed`,
        detail: 'The last attempt did not complete. Open it and retry.',
      })
      continue
    }
    flags.push({
      severity: item.status === 'in_progress' ? 'info' : 'warn',
      title:
        item.status === 'in_progress' ? `${item.label} in progress` : `${item.label} not on file`,
      detail:
        item.status === 'in_progress'
          ? 'Pick up where you left off so the career card can show it.'
          : 'A complete DQ file includes this. Open the tile to start.',
    })
  }

  if (snapshot.mvr && !snapshot.mvr.licenseStatus && snapshot.mvr.lastOrderedAt) {
    flags.push({
      severity: 'info',
      title: 'MVR result incomplete',
      detail: 'An order is on file but we do not have a license status yet.',
    })
  }
  if (snapshot.cdl?.endorsements?.length) {
    flags.push({
      severity: 'info',
      title: 'Endorsements on file',
      detail: snapshot.cdl.endorsements.join(', ') + ' — confirm they still match your license.',
    })
  }
  flags.push(...employmentGapFlags(snapshot.employment))

  const priority = snapshot.dqItems.find((i) =>
    ['requested', 'failed', 'in_progress', 'missing', 'needs_driver', 'needs_key'].includes(
      i.status,
    ),
  )
  const next = priority
    ? {
        title:
          priority.status === 'requested'
            ? `An employer asked for ${priority.label}`
            : priority.status === 'failed'
              ? `Retry ${priority.label}`
              : priority.status === 'in_progress'
                ? `Finish ${priority.label}`
                : `Add ${priority.label}`,
        detail: 'This is the next hole in a complete DQ file.',
        target: DQ_TO_TARGET[priority.id] ?? null,
      }
    : snapshot.profile.name
      ? null
      : {
          title: 'Finish your profile',
          detail: 'Name and contact feed every block and the career card.',
          target: 'profile' as DqCoachTarget,
        }

  const done = snapshot.dqItems.filter((i) => i.status === 'complete').map((i) => i.label)
  return {
    watching: 'Scanning your DQ file and career-card blocks for gaps and mismatches.',
    next,
    flags,
    clear: done.slice(0, 4),
  }
}

/** Claude often wraps JSON in prose or fences — take the first object. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return text.slice(start, end + 1)
}

export function mergeDqReviews(base: DqCoachReview, extra: DqCoachReview): DqCoachReview {
  const seen = new Set(base.flags.map((f) => f.title.toLowerCase()))
  const flags = [...base.flags]
  for (const flag of extra.flags) {
    const key = flag.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    flags.push(flag)
  }
  return {
    watching: extra.watching || base.watching,
    next: extra.next ?? base.next,
    flags: flags.slice(0, 10),
    clear: extra.clear.length > 0 ? extra.clear : base.clear,
  }
}

export function parseDqCoachReview(text: string, fallback: DqCoachReview): DqCoachReview {
  const blob = extractJsonObject(text)
  if (!blob) return fallback
  try {
    const raw = JSON.parse(blob) as Partial<DqCoachReview>
    const target =
      raw.next && typeof raw.next.target === 'string' && TARGETS.has(raw.next.target)
        ? (raw.next.target as DqCoachTarget)
        : raw.next
          ? null
          : null
    const parsed: DqCoachReview = {
      watching:
        typeof raw.watching === 'string' && raw.watching.trim()
          ? raw.watching.trim()
          : fallback.watching,
      next:
        raw.next && typeof raw.next.title === 'string'
          ? {
              title: raw.next.title,
              detail: typeof raw.next.detail === 'string' ? raw.next.detail : '',
              target,
            }
          : fallback.next,
      flags: Array.isArray(raw.flags)
        ? raw.flags
            .filter((f) => f && typeof f.title === 'string')
            .map((f) => ({
              severity: f.severity === 'warn' ? 'warn' : 'info',
              title: f.title,
              detail: typeof f.detail === 'string' ? f.detail : '',
            }))
        : [],
      clear: Array.isArray(raw.clear)
        ? raw.clear.filter((s): s is string => typeof s === 'string').slice(0, 5)
        : [],
    }
    // Rule-based flags are the floor — the model must not erase holes it skipped.
    return mergeDqReviews(fallback, parsed)
  } catch {
    return fallback
  }
}

export function dqCoachSystemPrompt(snapshot: DqCoachSnapshot): string {
  const blockLabels = snapshot.blocks.map((id) => getBlockDefinition(id)?.label ?? id)
  return `You watch a truck driver's DQ (driver qualification) file on Provven. You are not a chatbot. You do not greet, joke, or offer to chat.

Write a JSON object only (no markdown) with:
- watching: one sentence on what you just checked
- next: { title, detail, target } or null. target is one of: profile, dotapp, mvr, psp, screening-consent, employment-verification
- flags: { severity: "warn"|"info", title, detail } for every real hole or mismatch in the snapshot
- clear: up to 4 short strings of what's solid (only if true)

Rules:
- Only third-party facts (MVR, PSP, employer confirmations) are "verified". Self-reported DOT/resume is never "proven".
- Prefer the next actionable hole in a complete DQ file.
- Be specific (state codes, dates, company names from the snapshot). Do not invent facts.
- List each missing DQ item (MVR, PSP, CDLIS/consent, etc.) as its own flag. Do not collapse them into watching.

Installed blocks: ${blockLabels.join(', ') || 'none'}
Snapshot:
${JSON.stringify(snapshot)}`
}
