import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'
import type { ParsedResumeExtraction } from '@/types/resume-extraction'

const MAX_RESUME_TEXT_CHARS = 28_000

/**
 * Extract structured career data from plain resume text (from PDF).
 * Returns JSON only — caller validates shape lightly.
 */
export async function extractResumeWithAi(params: {
  resumeText: string
  model: 'sonnet' | 'haiku'
}): Promise<ParsedResumeExtraction> {
  const apiKey = process.env.AVA_BRAIN
  if (!apiKey) throw new Error('AVA_BRAIN not configured')

  const text = params.resumeText.slice(0, MAX_RESUME_TEXT_CHARS)
  const anthropic = new Anthropic({ apiKey })
  const model = params.model === 'sonnet' ? ANTHROPIC_MODEL_SONNET : ANTHROPIC_MODEL_HAIKU

  const system = `You extract structured data from a resume for a career wallet app.
Return ONLY valid JSON (no markdown fences). Use null or omit fields when unknown.
Schema:
{
  "personalInfo": { "firstName", "lastName", "email", "phone", "city", "state", "zipCode", "professionalSummary" },
  "cdlInfo": { "cdlClass", "cdlState", "cdlNumber", "cdlExpiration", "endorsements": string[] },
  "employments": [{ "companyName", "position", "location", "startDate", "endDate", "isCurrent", "responsibilities": string[] }],
  "educations": [{ "school", "degree", "field", "year", "certifications": string[] }],
  "skills": [{ "name", "category": "equipment"|"route"|"technology"|"safety"|"other" }],
  "references": [{ "name", "phone", "email", "relationship", "title", "company" }]
}
Rules:
- Dates as ISO strings (YYYY-MM) or best effort from resume text.
- Do not invent employers, degrees, or CDL numbers not clearly implied.
- If the resume is not trucking-related, cdlInfo can be omitted.
- skills.category defaults to "other" when unsure.`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: `Resume text:\n\n${text}` }],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected AI response shape')
  }

  let raw = block.text.trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('AI returned non-JSON resume extraction')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid extraction root')
  }

  return parsed as ParsedResumeExtraction
}
