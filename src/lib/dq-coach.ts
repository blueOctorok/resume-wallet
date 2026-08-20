/**
 * DQ file watcher — Anthropic reviews the driver's blocks + card facts.
 * Not a chat: one structured brief (next step + mismatches) for the Build board.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCdlData, getDriverEmployment, getMvrData, getPspData } from '@/lib/block-data'
import { loadDriverDqSnapshot } from '@/lib/dq-file-load'
import { getBlockDefinition } from '@/lib/block-registry'
import { getDqItemDefinition } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { loadPspDotProjection } from '@/lib/psp-form2-projection'
import { collectDiscrepancyFlags, nextFromDiscrepancies } from '@/lib/dq-coach-compare'

export { personNameParts, personNamesConflict, PROFILE_MVR_NAME_FLAG } from '@/lib/dq-coach-compare'

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
  target?: DqCoachTarget
}

export interface DqCoachReview {
  watching: string
  next: { title: string; detail: string; target: DqCoachTarget } | null
  flags: DqCoachFlag[]
}

export interface DqCoachStep {
  title: string
  detail: string
  target: Exclude<DqCoachTarget, null>
  severity: 'warn' | 'info'
}

const MAX_ACTION_STEPS = 6

/** One clickable queue — next first, then leftover warns, then info with a target. */
export function buildDqActionSteps(review: DqCoachReview): DqCoachStep[] {
  const steps: DqCoachStep[] = []
  const seenTarget = new Set<string>()

  const push = (
    title: string,
    detail: string,
    target: DqCoachTarget,
    severity: 'warn' | 'info',
  ) => {
    if (!target || seenTarget.has(target) || steps.length >= MAX_ACTION_STEPS) return
    seenTarget.add(target)
    steps.push({ title, detail, target, severity })
  }

  if (review.next) {
    push(review.next.title, review.next.detail, review.next.target, 'warn')
  }
  const warns = review.flags.filter((f) => f.severity === 'warn')
  const infos = review.flags.filter((f) => f.severity === 'info' && f.target)
  for (const flag of [...warns, ...infos]) {
    push(flag.title, flag.detail, flag.target ?? null, flag.severity)
  }
  return steps
}

export interface DqCoachSnapshot {
  profile: {
    name: string | null
    city: string | null
    state: string | null
    dateOfBirth: string | null
    phone: string | null
    hasPhone: boolean
    hasEmail: boolean
  }
  blocks: string[]
  dqItems: Array<{ id: string; label: string; status: DqItemStatus }>
  cdl: {
    number: string | null
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
    subjectName: string | null
    dateOfBirth: string | null
    phone: string | null
    city: string | null
    state: string | null
    licenseNumber: string | null
    licenseState: string | null
    licenseClass: string | null
    licenseExpiration: string | null
    hasDiscrepancyAlert: boolean
    accidents: Array<{ date: string; nature: string }>
    convictions: Array<{ date: string; violation: string; state: string }>
  } | null
  psp: {
    reportStatus: string | null
    crashCount: number | null
    inspectionCount: number | null
    subjectName: string | null
    crashDates: string[]
  } | null
  /** Latest DOT draft — null until they start the app. */
  dot: {
    started: boolean
    complete: boolean
    name: string | null
    dateOfBirth: string | null
    phone: string | null
    city: string | null
    state: string | null
    licenseNumber: string | null
    licenseState: string | null
    licenseClass: string | null
    licenseExpiration: string | null
    accidentDates: string[]
    convictionDates: string[]
    hasNoAccidents: boolean
    hasNoConvictions: boolean
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

function formatPersonName(first?: string | null, last?: string | null): string | null {
  const name = [first?.trim(), last?.trim()].filter(Boolean).join(' ')
  return name || null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function strField(obj: Record<string, unknown> | null, key: string): string | null {
  const v = obj?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function license0(form1: Record<string, unknown> | null): Record<string, unknown> | null {
  const licenses = form1?.currentLicenses
  if (!Array.isArray(licenses) || licenses.length === 0) return null
  return asRecord(licenses[0])
}

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
    mvrProj,
    pspProj,
    { data: latestDot },
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name, display_name, city, state, phone, email, date_of_birth')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('hub_blocks').select('block_type').eq('user_id', userId),
    loadDriverDqSnapshot(supabase, userId),
    getCdlData(supabase, userId),
    getDriverEmployment(supabase, userId),
    getMvrData(supabase, userId),
    getPspData(supabase, userId),
    loadMvrDotProjection(supabase, userId),
    loadPspDotProjection(supabase, userId),
    supabase
      .from('driver_applications')
      .select('is_complete, application_data')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : ''
  const last = typeof profile?.last_name === 'string' ? profile.last_name.trim() : ''
  const display = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  const name = [first, last].filter(Boolean).join(' ') || display || null
  const subjectName = formatPersonName(
    mvrProj?.parsed.subject?.firstName,
    mvrProj?.parsed.subject?.lastName,
  )
  const mvrForm1 = (mvrProj?.form1Data as Record<string, unknown> | undefined) ?? null
  const mvrLicense = license0(mvrForm1)
  const appData = asRecord(latestDot?.application_data)
  const form1 = asRecord(appData?.form1)
  const form2 = asRecord(appData?.form2)
  const dotLicense = license0(form1)
  const mailing = asRecord(form1?.currentMailing)
  const accidents = Array.isArray(form2?.accidents) ? form2.accidents : []
  const convictions = Array.isArray(form2?.convictions) ? form2.convictions : []

  return {
    profile: {
      name,
      city: typeof profile?.city === 'string' ? profile.city : null,
      state: typeof profile?.state === 'string' ? profile.state : null,
      dateOfBirth: typeof profile?.date_of_birth === 'string' ? profile.date_of_birth : null,
      phone: typeof profile?.phone === 'string' ? profile.phone : null,
      hasPhone: Boolean(profile?.phone),
      hasEmail: Boolean(profile?.email),
    },
    blocks: (hubBlocks ?? []).map((b) => String(b.block_type)),
    dqItems: dqFile.items.map((i) => ({ id: i.id, label: i.label, status: i.status })),
    cdl: cdl
      ? {
          number: cdl.cdl_number,
          state: cdl.cdl_state,
          class: cdl.cdl_class,
          expiration: cdl.cdl_expiration,
          endorsements: cdl.endorsements ?? [],
        }
      : null,
    mvr:
      mvr || subjectName || mvrProj
        ? {
            licenseStatus: mvr?.license_status ?? null,
            points: mvr?.total_points ?? 0,
            violationCount: mvr?.violation_count ?? 0,
            lastOrderedAt: mvr?.last_ordered_at ?? null,
            subjectName,
            dateOfBirth: strField(mvrForm1, 'dateOfBirth') ?? mvrProj?.parsed.subject?.dateOfBirth ?? null,
            phone: strField(mvrForm1, 'phone') ?? mvrProj?.parsed.subject?.phone ?? null,
            city: mvrProj?.parsed.subject?.city ?? null,
            state: mvrProj?.parsed.subject?.state ?? null,
            licenseNumber:
              strField(mvrLicense, 'licenseNumber') ?? mvrProj?.parsed.licenseNumber ?? null,
            licenseState: strField(mvrLicense, 'state') ?? mvrProj?.parsed.licenseState ?? null,
            licenseClass: strField(mvrLicense, 'typeClass') ?? null,
            licenseExpiration:
              strField(mvrLicense, 'expirationDate') ??
              mvrProj?.parsed.licenseExpirationDate ??
              null,
            hasDiscrepancyAlert:
              mvrProj?.parsed.filledCode?.trim().toLowerCase() === 'discrepancy',
            accidents: (mvrProj?.mvrAccidents ?? []).map((a) => ({
              date: a.date,
              nature: a.nature,
            })),
            convictions: (mvrProj?.mvrConvictions ?? []).map((c) => ({
              date: c.dateConvicted,
              violation: c.violation,
              state: c.stateOfViolation,
            })),
          }
        : null,
    psp:
      psp || pspProj
        ? {
            reportStatus: psp?.report_status ?? null,
            crashCount: psp?.crash_count ?? pspProj?.crashCount ?? null,
            inspectionCount: psp?.inspection_count ?? pspProj?.inspectionCount ?? null,
            subjectName: pspProj?.subjectName ?? null,
            crashDates: (pspProj?.pspCrashesAsAccidents ?? [])
              .map((c) => c.date)
              .filter(Boolean),
          }
        : null,
    dot: latestDot
      ? {
          started: true,
          complete: Boolean(latestDot.is_complete),
          name: formatPersonName(strField(form1, 'firstName'), strField(form1, 'lastName')),
          dateOfBirth: strField(form1, 'dateOfBirth'),
          phone: strField(form1, 'phone'),
          city: strField(mailing, 'city'),
          state: strField(mailing, 'state'),
          licenseNumber: strField(dotLicense, 'licenseNumber'),
          licenseState: strField(dotLicense, 'state'),
          licenseClass: strField(dotLicense, 'typeClass'),
          licenseExpiration: strField(dotLicense, 'expirationDate'),
          accidentDates: accidents
            .map((row) => strField(asRecord(row), 'date'))
            .filter((d): d is string => Boolean(d)),
          convictionDates: convictions
            .map((row) => strField(asRecord(row), 'dateConvicted'))
            .filter((d): d is string => Boolean(d)),
          hasNoAccidents: form2?.hasNoAccidents === true,
          hasNoConvictions: form2?.hasNoConvictions === true,
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
  const flags: DqCoachFlag[] = collectDiscrepancyFlags(snapshot)
  const discrepancyNext = nextFromDiscrepancies(flags)
  const exp = parseDay(snapshot.cdl?.expiration ?? null)
  if (exp && exp.getTime() < Date.now()) {
    flags.push({
      severity: 'warn',
      title: 'CDL looks expired',
      detail: `Expiration on file is ${snapshot.cdl?.expiration}. Update it if you've renewed.`,
      target: 'profile',
    })
  }
  if (!snapshot.profile.name) {
    flags.push({
      severity: 'info',
      title: 'Name missing',
      detail: 'Finish your profile so the career card and packet share the same name.',
      target: 'profile',
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
      target: 'profile',
    })
  }

  // One card per live DQ hole. Placeholders stay in the packet list, not Next.
  for (const item of snapshot.dqItems) {
    if (!getDqItemDefinition(item.id).blocksOverallCompletion) continue
    if (
      item.status === 'complete' ||
      item.status === 'processing' ||
      item.status === 'coming_soon' ||
      item.status === 'needs_gov' ||
      item.status === 'needs_employer'
    ) {
      continue
    }
    const target = DQ_TO_TARGET[item.id] ?? null
    if (item.status === 'needs_driver' || item.status === 'needs_key') {
      flags.push({
        severity: 'info',
        title: `${item.label} waiting on you`,
        detail:
          item.status === 'needs_key'
            ? 'A key or consent step is still open before this can complete.'
            : 'This item needs a driver action before it can go on the card.',
        target,
      })
      continue
    }
    if (item.status === 'requested') {
      flags.push({
        severity: 'warn',
        title: `${item.label} requested`,
        detail: 'An employer asked for this — finish it before they move on.',
        target,
      })
      continue
    }
    if (item.status === 'failed') {
      flags.push({
        severity: 'warn',
        title: `${item.label} failed`,
        detail: 'The last attempt did not complete. Open it and retry.',
        target,
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
          : 'A complete DQ file includes this. Open it to start.',
      target,
    })
  }

  if (snapshot.mvr && !snapshot.mvr.licenseStatus && snapshot.mvr.lastOrderedAt) {
    flags.push({
      severity: 'info',
      title: 'MVR result incomplete',
      detail: 'An order is on file but we do not have a license status yet.',
      target: 'mvr',
    })
  }
  flags.push(...employmentGapFlags(snapshot.employment))

  const priority = snapshot.dqItems.find((i) =>
    ['requested', 'failed', 'in_progress', 'missing', 'needs_driver', 'needs_key'].includes(
      i.status,
    ),
  )
  const next = discrepancyNext
    ? discrepancyNext
    : priority
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

  return {
    watching: 'Checking your file for unfinished work and anything that does not match.',
    next,
    flags,
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
  // Discrepancies are the floor — the model must not bury them under "add PSP".
  const floorNext = nextFromDiscrepancies(flags)
  return {
    watching: extra.watching || base.watching,
    next: floorNext ?? extra.next ?? base.next,
    flags: flags.slice(0, 16),
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
              target:
                typeof f.target === 'string' && TARGETS.has(f.target)
                  ? (f.target as DqCoachTarget)
                  : undefined,
            }))
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
  return `You review a truck driver's DQ file the way a carrier safety clerk would. You are not a chatbot. No greetings.

Write a JSON object only (no markdown) with:
- watching: one sentence on what you compared
- next: { title, detail, target } or null. target is one of: profile, dotapp, mvr, psp, screening-consent, employment-verification
- flags: { severity: "warn"|"info", title, detail, target } — only unfinished work and real mismatches. Include target so the driver can open that page. At most 6 flags.
- Do not list completed items as action flags. Those already live on the career card.
- dqItems is the full DQ packet, including pieces not built in product yet (coming_soon / needs_key / needs_gov). You may name them as not available yet. Do not give them a target or treat them as the driver's next click.

Your job:
1. What is not done (missing / in-progress DQ tiles, empty required profile fields).
2. What is done but does not match another source they have actually filled.

Compare only fields that exist on both sides. An empty DOT application is not a name mismatch — it is unfinished. Once they typed a name, DOB, phone, or license, it must agree with the MVR. Same for the CDL block vs MVR.

If the MVR or PSP lists accidents, convictions, or crashes and the DOT application says none (or omits those dates), that is a warn.

Residence state ≠ CDL/MVR license state is often legal — info, not an identity fail.

mvr.hasDiscrepancyAlert means the report itself flagged a violation or identity issue. That is separate from profile name vs the name on the report.

Write like a safety clerk talking to a driver. Never say filledCode, Accio, CRA, XML, Form 1, Form 2, or vendor field names.

Rules:
- Only MVR, PSP, and employer confirmations are "verified". Self-reported DOT/resume is never "proven".
- Do not invent violations, crashes, employers, or dates.
- Be specific (names, state codes, dates from the snapshot).
- List each missing DQ item as its own flag. Do not collapse them into watching.
- Identity and report-vs-form mismatches beat a missing optional tile for next.

Installed blocks: ${blockLabels.join(', ') || 'none'}
Snapshot:
${JSON.stringify(snapshot)}`
}
