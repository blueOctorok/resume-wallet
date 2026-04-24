/**
 * Job-Fit Computation
 *
 * Given a job and the candidate's installed blocks / projected card, returns:
 *   - score: 0–100 "requirements coverage"
 *   - matchedRequirements / missingRequirements: structured items the user can read
 *   - recommendedBlocks: which blocks to install next to close the biggest gaps
 *
 * Two requirement sources (used exclusively, never merged):
 *   1. **External structured requirements** — LLM-extracted via
 *      `/api/ai/extract-job-requirements` and cached in
 *      `external_job_requirements`. Higher fidelity, covers skills/credentials
 *      the heuristic vocab can't catch. Preferred when available.
 *   2. **Heuristic fallback** — regex over title + description to block hints.
 *      Good enough for instant scoring before the LLM pass completes.
 *
 * Scoring is intentionally deterministic — no LLM at scoring time, only at
 * extraction time. The score is labelled "requirements coverage" everywhere.
 * NEVER framed as "likelihood to land this job" — that overpromises.
 */

import { BLOCK_DEFINITIONS, type BlockDefinition } from '@/lib/block-registry'
import type { ProjectedCareerCard, SectionBlockType } from '@/types/career-card'
import type { SelectedJobSnapshot } from '@/stores/simple-mode-store'
import type { CareerCardLens } from '@/lib/career-card-lenses'

export interface Requirement {
  /** Stable key — e.g. block id or canonical skill keyword */
  id: string
  /** Display label e.g. "STORM Resume", "CDL Class A", "TWIC card" */
  label: string
  /** Optional kind tag for UI grouping */
  kind: 'block' | 'skill' | 'credential'
  /** When kind=block, which block satisfies it */
  blockId?: string
}

/**
 * Shape returned by `/api/ai/extract-job-requirements`. Each item is an
 * LLM-extracted hiring requirement for an external job listing.
 */
export interface ExternalRequirement {
  id: string
  label: string
  kind: 'skill' | 'credential' | 'experience' | 'other'
}

export interface JobFitResult {
  /** 0–100. Use the labelled string in UI ("requirements coverage"). */
  score: number
  matchedRequirements: Requirement[]
  missingRequirements: Requirement[]
  /** Blocks to install next, ranked by biggest gap closed. */
  recommendedBlocks: BlockDefinition[]
  /** Tone band Stormi should adopt for this score — see plan §Phase 3. */
  toneBand: 'confident' | 'coach' | 'mentor' | 'redirect'
  /** Plain-English label so we don't repeat the math in 4 places. */
  label: string
}

// ── Heuristic vocab ──────────────────────────────────────────────────────────
// Every entry: (regex over normalized text) → required block id.
// Keep this small, additive, and biased toward HIGH PRECISION matches —
// false positives kill trust faster than false negatives.

interface BlockHint {
  blockId: string
  label: string
  /** Match if any pattern hits the normalized job text. */
  patterns: RegExp[]
}

const BLOCK_HINTS: BlockHint[] = [
  {
    blockId: 'storm-resume',
    label: 'Resume',
    patterns: [/\bresume\b/, /\bcv\b/, /work history/, /employment history/],
  },
  {
    blockId: 'driver-cdl-credentials',
    label: 'CDL credentials',
    patterns: [/\bcdl\b/, /commercial driver/, /class a\b/, /class b\b/],
  },
  {
    blockId: 'driver-mvr',
    label: 'Motor Vehicle Record (MVR)',
    patterns: [/\bmvr\b/, /motor vehicle record/, /driving record/, /clean driving/],
  },
  {
    blockId: 'driver-dot-application',
    label: 'DOT application',
    patterns: [/\bdot\b/, /\bfmcsa\b/, /motor carrier/, /driver qualification file/, /\bdqf\b/],
  },
  {
    blockId: 'developer-github',
    label: 'GitHub activity',
    patterns: [/\bgithub\b/, /open[- ]source/, /pull request/],
  },
  {
    blockId: 'developer-portfolio',
    label: 'Portfolio',
    patterns: [/\bportfolio\b/, /\bcase stud(y|ies)\b/, /sample of your work/],
  },
  {
    blockId: 'developer-projects',
    label: 'Projects',
    patterns: [/\bside project/, /\bpersonal project/, /shipped product/],
  },
]

function normalize(text: string | null | undefined): string {
  return (text ?? '').toLowerCase()
}

/** Hard floor: every job benefits from a resume — surface it even if not in the description. */
const ALWAYS_REQUIRED_BLOCK_IDS = new Set<string>(['storm-resume'])

function deriveRequirementsFromJob(snap: SelectedJobSnapshot): Requirement[] {
  const text = `${normalize(snap.title)} ${normalize(snap.description)}`
  const reqs: Requirement[] = []
  const seen = new Set<string>()

  for (const hint of BLOCK_HINTS) {
    const matched = hint.patterns.some((p) => p.test(text))
    if (matched && !seen.has(hint.blockId)) {
      seen.add(hint.blockId)
      reqs.push({
        id: hint.blockId,
        label: hint.label,
        kind: 'block',
        blockId: hint.blockId,
      })
    }
  }

  for (const blockId of ALWAYS_REQUIRED_BLOCK_IDS) {
    if (!seen.has(blockId)) {
      const def = BLOCK_DEFINITIONS.find((b) => b.id === blockId)
      seen.add(blockId)
      reqs.push({
        id: blockId,
        label: def?.label ?? 'Resume',
        kind: 'block',
        blockId,
      })
    }
  }

  return reqs
}

function tone(score: number): JobFitResult['toneBand'] {
  if (score >= 85) return 'confident'
  if (score >= 60) return 'coach'
  if (score >= 40) return 'mentor'
  return 'redirect'
}

function labelFor(score: number): string {
  if (score >= 85) return 'Strong match'
  if (score >= 60) return 'Good match — close a few gaps'
  if (score >= 40) return 'Stretch role — Stormi can help'
  return 'Long shot — try a closer fit'
}

// ── External → internal mapping ─────────────────────────────────────────────
// Maps LLM-extracted requirement ids/labels to Storm block ids so the scorer
// can match them against installed blocks. Falls back to kind-based mapping
// when the extracted id doesn't directly match a known block.

const EXTERNAL_ID_TO_BLOCK: Record<string, string> = {
  resume: 'storm-resume',
  cdl: 'driver-cdl-credentials',
  mvr: 'driver-mvr',
  dot: 'driver-dot-application',
  github: 'developer-github',
  portfolio: 'developer-portfolio',
  projects: 'developer-projects',
}

const EXTERNAL_LABEL_PATTERNS: { pattern: RegExp; blockId: string }[] = [
  { pattern: /\bresume\b|\bcv\b|work history/i, blockId: 'storm-resume' },
  { pattern: /\bcdl\b|commercial driver|class [ab]\b/i, blockId: 'driver-cdl-credentials' },
  { pattern: /\bmvr\b|motor vehicle|driving record/i, blockId: 'driver-mvr' },
  { pattern: /\bdot\b|\bfmcsa\b|driver qualification/i, blockId: 'driver-dot-application' },
  { pattern: /\bgithub\b|open.?source/i, blockId: 'developer-github' },
  { pattern: /\bportfolio\b|case stud/i, blockId: 'developer-portfolio' },
]

function externalToRequirements(ext: ExternalRequirement[]): Requirement[] {
  const reqs: Requirement[] = []
  const seen = new Set<string>()

  for (const e of ext) {
    let blockId = EXTERNAL_ID_TO_BLOCK[e.id]
    if (!blockId) {
      const match = EXTERNAL_LABEL_PATTERNS.find((p) => p.pattern.test(e.label))
      if (match) blockId = match.blockId
    }

    if (blockId) {
      if (seen.has(blockId)) continue
      seen.add(blockId)
      reqs.push({ id: blockId, label: e.label, kind: 'block', blockId })
    } else {
      const kind: Requirement['kind'] =
        e.kind === 'credential' ? 'credential' : 'skill'
      if (seen.has(e.id)) continue
      seen.add(e.id)
      reqs.push({ id: e.id, label: e.label, kind })
    }
  }

  // Always include a resume requirement even if the LLM didn't extract one
  for (const blockId of ALWAYS_REQUIRED_BLOCK_IDS) {
    if (!seen.has(blockId)) {
      const def = BLOCK_DEFINITIONS.find((b) => b.id === blockId)
      seen.add(blockId)
      reqs.push({ id: blockId, label: def?.label ?? 'Resume', kind: 'block', blockId })
    }
  }

  return reqs
}

interface ComputeJobFitInput {
  job: SelectedJobSnapshot
  installedBlockTypes: string[]
  card?: ProjectedCareerCard | null
  /**
   * LLM-extracted structured requirements from `/api/ai/extract-job-requirements`.
   * When provided, replaces the heuristic fallback for richer scoring.
   */
  externalRequirements?: ExternalRequirement[] | null
}

/**
 * Pure function. Add inputs to the signature, never read globals — this
 * function is called both client-side (live UI) and tested in isolation.
 */
export function computeJobFit({
  job,
  installedBlockTypes,
  card,
  externalRequirements,
}: ComputeJobFitInput): JobFitResult {
  // Prefer LLM-extracted structured requirements; fall back to heuristic
  const requirements =
    externalRequirements && externalRequirements.length > 0
      ? externalToRequirements(externalRequirements)
      : deriveRequirementsFromJob(job)
  const installedSet = new Set(installedBlockTypes)

  // A block requirement is matched iff the candidate has the block installed
  // AND (when the projected card has loaded) the corresponding section has
  // real data. We check the card defensively because installed-but-empty
  // blocks shouldn't pass as "matched".
  const cardSectionTypes = new Set<string>(
    (card?.sections ?? []).map((s) => s.blockType as string),
  )

  const matched: Requirement[] = []
  const missing: Requirement[] = []

  for (const req of requirements) {
    if (req.kind !== 'block' || !req.blockId) {
      missing.push(req)
      continue
    }
    const installed = installedSet.has(req.blockId)
    const hasCardSection = cardSectionTypes.has(req.blockId as SectionBlockType)
    // If the card hasn't loaded yet, fall back to "installed === matched".
    const isMatched = card ? installed && hasCardSection : installed
    if (isMatched) matched.push(req)
    else missing.push(req)
  }

  // Score: 1.0 means every requirement matched. We also reward extra
  // installed blocks lightly so a fully-loaded candidate isn't capped at
  // exactly the requirement count — this matters when the heuristic misses
  // a relevant skill. Cap the bonus so it doesn't dominate.
  const total = requirements.length || 1
  const matchRatio = matched.length / total
  const extraInstalled = Math.max(0, installedBlockTypes.length - matched.length)
  const bonus = Math.min(0.1, extraInstalled * 0.02)
  const score = Math.round(Math.min(100, (matchRatio + bonus) * 100))

  const recommendedBlocks: BlockDefinition[] = missing
    .filter((r) => r.kind === 'block' && r.blockId)
    .map((r) => BLOCK_DEFINITIONS.find((b) => b.id === r.blockId))
    .filter((b): b is BlockDefinition => Boolean(b))

  return {
    score,
    matchedRequirements: matched,
    missingRequirements: missing,
    recommendedBlocks,
    toneBand: tone(score),
    label: labelFor(score),
  }
}

// ── Lens picker ─────────────────────────────────────────────────────────────

export interface LensFitEvaluation {
  lensId: string
  lensName: string
  score: number
  toneBand: JobFitResult['toneBand']
}

export interface PickBestLensResult {
  /** Lens that scored highest; null if no lenses are provided. */
  best: LensFitEvaluation | null
  /** Score of the second-place lens, 0 if only one lens exists. */
  runnerUpScore: number
  /** `best.score - runnerUpScore`. Used to decide whether to suggest a draft. */
  margin: number
  /** Every lens evaluation — useful for the manage modal preview. */
  evaluations: LensFitEvaluation[]
}

/**
 * Score every lens against a job and return the best pick.
 *
 * "Score" here is `computeJobFit` with the lens's `visibleBlockTypes` treated
 * as the candidate's installed set. This mirrors the real projection —
 * requirements only count as matched if the lens actually shows that block.
 *
 * `null` visible_block_types = "all blocks visible" → uses `installedBlockTypes`
 * unchanged, same as the default lens.
 */
export function pickBestLens({
  lenses,
  installedBlockTypes,
  job,
  externalRequirements,
}: {
  lenses: CareerCardLens[]
  installedBlockTypes: string[]
  job: SelectedJobSnapshot
  externalRequirements?: ExternalRequirement[] | null
}): PickBestLensResult {
  if (lenses.length === 0) {
    return { best: null, runnerUpScore: 0, margin: 0, evaluations: [] }
  }

  const evaluations: LensFitEvaluation[] = lenses.map((lens) => {
    // "installed" for this lens = what the lens SHOWS. Missing visibleBlockTypes
    // is the sentinel for "show all" (default/Full profile lens).
    const lensVisible =
      lens.visibleBlockTypes == null
        ? installedBlockTypes
        : installedBlockTypes.filter((b) => lens.visibleBlockTypes!.includes(b))

    const fit = computeJobFit({
      job,
      installedBlockTypes: lensVisible,
      externalRequirements,
    })
    return { lensId: lens.id, lensName: lens.name, score: fit.score, toneBand: fit.toneBand }
  })

  // Sort descending; ties broken by lens name for deterministic output.
  const sorted = [...evaluations].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.lensName.localeCompare(b.lensName),
  )
  const best = sorted[0]
  const runnerUpScore = sorted[1]?.score ?? 0
  return {
    best,
    runnerUpScore,
    margin: best.score - runnerUpScore,
    evaluations,
  }
}
