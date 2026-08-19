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
  if (snapshot.cdl?.expiration) {
    const exp = new Date(snapshot.cdl.expiration)
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      flags.push({
        severity: 'warn',
        title: 'CDL looks expired',
        detail: `Expiration on file is ${snapshot.cdl.expiration}. Update it if you've renewed.`,
      })
    }
  }
  if (!snapshot.profile.name) {
    flags.push({
      severity: 'info',
      title: 'Name missing',
      detail: 'Finish your profile so the career card and packet share the same name.',
    })
  }

  const priority = snapshot.dqItems.find(
    (i) => i.status === 'requested' || i.status === 'failed' || i.status === 'in_progress' || i.status === 'missing',
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

export function parseDqCoachReview(text: string, fallback: DqCoachReview): DqCoachReview {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/u, '')
    .trim()
  try {
    const raw = JSON.parse(trimmed) as Partial<DqCoachReview>
    const target =
      raw.next && typeof raw.next.target === 'string' && TARGETS.has(raw.next.target)
        ? (raw.next.target as DqCoachTarget)
        : raw.next
          ? null
          : null
    return {
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
            .slice(0, 6)
            .map((f) => ({
              severity: f.severity === 'warn' ? 'warn' : 'info',
              title: f.title,
              detail: typeof f.detail === 'string' ? f.detail : '',
            }))
        : fallback.flags,
      clear: Array.isArray(raw.clear)
        ? raw.clear.filter((s): s is string => typeof s === 'string').slice(0, 5)
        : fallback.clear,
    }
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
- flags: up to 6 { severity: "warn"|"info", title, detail } — mismatches, expired creds, date gaps, employer requests
- clear: up to 4 short strings of what's solid (only if true)

Rules:
- Only third-party facts (MVR, PSP, employer confirmations) are "verified". Self-reported DOT/resume is never "proven".
- Prefer the next actionable hole in a complete DQ file.
- Be specific (state codes, dates, company names from the snapshot). Do not invent facts.

Installed blocks: ${blockLabels.join(', ') || 'none'}
Snapshot:
${JSON.stringify(snapshot)}`
}
