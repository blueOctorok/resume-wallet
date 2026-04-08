import Anthropic from '@anthropic-ai/sdk'
import type { AdzunaJobNormalized } from '@/lib/adzuna-server'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

/** ~24 jobs × ~180 chars/object was truncating at 4096 and breaking JSON */
const JOB_MATCH_MAX_TOKENS = 12_000

export interface ScoredJob {
  id: string
  score: number
  reason: string
}

function joinAssistantText(content: Anthropic.Message['content']): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

/** First top-level `[` … `]` balance, respecting JSON string quotes (avoids greedy-regex mistakes). */
function extractBalancedJsonArray(raw: string): string | null {
  const start = raw.indexOf('[')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function tryParseScoredJobsJson(text: string): unknown | null {
  const stripped = stripCodeFences(text)
  const variants = [stripped, extractBalancedJsonArray(stripped), extractBalancedJsonArray(text)].filter(
    (s): s is string => Boolean(s?.length),
  )
  const unique = [...new Set(variants)]
  for (const raw of unique) {
    try {
      return JSON.parse(raw)
    } catch {
      /* try next */
    }
  }
  return null
}

function neutralScores(jobs: AdzunaJobNormalized[]): ScoredJob[] {
  return jobs.map(j => ({
    id: String(j.id),
    score: 50,
    reason: 'Ranking unavailable',
  }))
}

/**
 * Ask the model to score each job 1–100 for the candidate. Returns sorted highest first.
 */
export async function scoreJobsForCandidate(params: {
  candidateBrief: string
  jobs: AdzunaJobNormalized[]
  model: 'sonnet' | 'haiku'
}): Promise<ScoredJob[]> {
  const apiKey = process.env.AVA_BRAIN
  if (!apiKey) throw new Error('AVA_BRAIN not configured')

  const anthropic = new Anthropic({ apiKey })
  const model = params.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

  const jobLines = params.jobs.map((j, i) => {
    const desc = j.description
      ? j.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
      : ''
    return `[${i}] id=${String(j.id)} | ${j.title} at ${j.company} | ${j.location} | ${desc}`
  })

  const system = `You match job listings to a candidate profile for a hiring app.
Return ONLY valid JSON: a single array of objects with keys id, score, reason (no markdown, no prose).
Each object: {"id":string,"score":number,"reason":string}
- id must match the job id from the listing exactly (string).
- score: integer 1-100 (fit for this candidate).
- reason: max 90 chars, single line, no double-quotes inside the reason.
Include every job id exactly once. Compact JSON (minimal spaces).`

  const user = `Candidate profile:\n${params.candidateBrief}\n\nJobs:\n${jobLines.join('\n')}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: JOB_MATCH_MAX_TOKENS,
    system: system,
    messages: [{ role: 'user', content: user }],
  })

  const text = joinAssistantText(response.content)
  const parsed = tryParseScoredJobsJson(text)

  if (!Array.isArray(parsed)) {
    console.error('[JOB_MATCH_AI] JOB_MATCH_PARSE snippet:', text.slice(0, 500))
    return neutralScores(params.jobs).sort((a, b) => b.score - a.score)
  }

  const out: ScoredJob[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as { id?: unknown }).id ?? '')
    const score = Number((row as { score?: unknown }).score)
    const reason = String((row as { reason?: unknown }).reason ?? '').slice(0, 160)
    if (!id || !Number.isFinite(score)) continue
    out.push({ id, score: Math.min(100, Math.max(1, Math.round(score))), reason })
  }

  return out.sort((a, b) => b.score - a.score)
}
