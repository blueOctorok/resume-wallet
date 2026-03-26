import Anthropic from '@anthropic-ai/sdk'
import type { AdzunaJobNormalized } from '@/lib/adzuna-server'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

export interface ScoredJob {
  id: string
  score: number
  reason: string
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
      ? j.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
      : ''
    return `[${i}] id=${String(j.id)} | ${j.title} at ${j.company} | ${j.location} | ${desc}`
  })

  const system = `You match job listings to a candidate profile for a hiring app.
Return ONLY valid JSON: an array of objects {"id":string,"score":number,"reason":string}
- id must match the job id from the listing exactly (string).
- score: integer 1-100 (fit for this candidate).
- reason: max 120 chars, no line breaks.
Include every job id exactly once. Sort is not required (server sorts).`

  const user = `Candidate profile:\n${params.candidateBrief}\n\nJobs:\n${jobLines.join('\n')}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: system,
    messages: [{ role: 'user', content: user }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const fenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const jsonMatch = fenced.match(/\[[\s\S]*\]/)
  const raw = jsonMatch ? jsonMatch[0] : fenced

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('JOB_MATCH_PARSE')
  }

  if (!Array.isArray(parsed)) throw new Error('JOB_MATCH_SHAPE')

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
