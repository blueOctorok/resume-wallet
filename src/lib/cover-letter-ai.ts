import Anthropic from '@anthropic-ai/sdk'

import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

export function stripHtmlToText(html: string, maxLen: number): string {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
}

/**
 * Tailored cover letter for apply modal (max ~1000 chars to match UI limit).
 */
export async function generateCoverLetter(params: {
  candidateBrief: string
  jobTitle: string
  company: string
  location?: string
  jobDescription?: string
  model: 'sonnet' | 'haiku'
}): Promise<string> {
  const apiKey = process.env.AVA_BRAIN
  if (!apiKey) throw new Error('AVA_BRAIN not configured')

  const anthropic = new Anthropic({ apiKey })
  const model = params.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

  const system = `You write concise, professional cover letters for job applications.
Rules:
- Plain text only, no greeting placeholder like "Dear Hiring Manager" required (optional one short line OK).
- 2–4 short paragraphs, total under 950 characters.
- Tie the candidate's background to this role specifically.
- No invented employers, degrees, or certifications not implied by the profile.
- Confident but not arrogant.`

  const jobDesc = params.jobDescription
    ? `\nJob description excerpt:\n${stripHtmlToText(params.jobDescription, 1200)}`
    : ''

  const user = `Candidate profile:\n${params.candidateBrief}\n\nRole: ${params.jobTitle}\nCompany: ${params.company}\nLocation: ${params.location ?? 'n/a'}${jobDesc}\n\nWrite the cover letter.`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  return text.slice(0, 1000)
}
