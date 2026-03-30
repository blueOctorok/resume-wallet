import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'
import type { StormiInterviewPrepPayload } from '@/lib/stormi-interactive-types'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

/**
 * Generates one interview practice MCQ from the candidate brief. Sonnet when model allows, else Haiku.
 * Output is JSON only — parsed and validated here.
 */
export async function generateInterviewPrepMcq(params: {
  candidateBrief: string
  focus?: string
  model: 'sonnet' | 'haiku'
}): Promise<StormiInterviewPrepPayload> {
  const apiKey = process.env.AVA_BRAIN
  if (!apiKey) throw new Error('AVA_BRAIN not configured')

  const anthropic = new Anthropic({ apiKey })
  const model = params.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

  const focus =
    params.focus?.trim() ||
    'General interview practice grounded in their real profile — not live-interview cheating.'

  const system = `You create ONE interview practice question for someone preparing to interview for a **new role** (job search / offer stage).
Rules:
- Ethical prep only: practice before the interview, NOT real-time answers during a live interview.
- Output a single JSON object ONLY, no markdown fences, no extra text.
- Schema:
  {
    "topic": string (short label, e.g. "behavioral", "technical screening"),
    "question": string (clear interview-style question),
    "choices": [ { "id": "a"|"b"|"c"|"d", "text": string, "feedback": string } ],
    "recommendedChoiceId": string (id of the strongest answer for an interview)
- Exactly 4 choices, ids must be "a","b","c","d".
- Each "feedback" is 2–4 sentences: what works, what to improve, tie to their profile when relevant.
- Do not invent employers, degrees, or certifications not implied by the profile.
- Question should fit their background when the profile gives enough signal; otherwise use a solid generic question for their stated goals.`

  const user = `Candidate context:\n${params.candidateBrief.slice(0, 6000)}\n\nFocus: ${focus}\n\nReturn JSON only.`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1800,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const parsed = parseMcqJson(raw)
  if (!parsed) throw new Error('Invalid interview prep JSON from model')
  return parsed
}

function parseMcqJson(raw: string): StormiInterviewPrepPayload | null {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  }
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const question = typeof o.question === 'string' ? o.question.trim() : ''
    const topic = typeof o.topic === 'string' ? o.topic.trim() : undefined
    const recommendedChoiceId =
      typeof o.recommendedChoiceId === 'string' ? o.recommendedChoiceId.trim() : ''
    const arr = o.choices
    if (!question || !recommendedChoiceId || !Array.isArray(arr) || arr.length !== 4) return null

    const choices: StormiInterviewPrepPayload['choices'] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id.trim() : ''
      const text = typeof rec.text === 'string' ? rec.text.trim() : ''
      const feedback = typeof rec.feedback === 'string' ? rec.feedback.trim() : ''
      if (!id || !text || !feedback) return null
      choices.push({ id, text, feedback })
    }
    const ids = new Set(choices.map((c) => c.id))
    if (ids.size !== 4) return null
    if (!choices.some((c) => c.id === recommendedChoiceId)) return null

    return {
      kind: 'interview_prep_mcq',
      topic,
      question,
      choices,
      recommendedChoiceId,
    }
  } catch {
    return null
  }
}
