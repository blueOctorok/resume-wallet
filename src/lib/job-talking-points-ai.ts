import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

const MODEL_SONNET = ANTHROPIC_MODEL_SONNET
const MODEL_HAIKU = ANTHROPIC_MODEL_HAIKU

/**
 * Honest bullets the candidate can say in an application or interview — derived only from their profile + JD.
 */
export async function generateJobTalkingPoints(params: {
  candidateBrief: string
  jobTitle: string
  company: string
  jobDescriptionExcerpt?: string
  model: 'sonnet' | 'haiku'
}): Promise<string> {
  const apiKey = process.env.AVA_BRAIN
  if (!apiKey) throw new Error('AVA_BRAIN not configured')

  const anthropic = new Anthropic({ apiKey })
  const model = params.model === 'sonnet' ? MODEL_SONNET : MODEL_HAIKU

  const jd = params.jobDescriptionExcerpt?.trim()
    ? `\nJob description excerpt:\n${params.jobDescriptionExcerpt.slice(0, 2000)}`
    : ''

  const system = `You help candidates prepare honest talking points for a **specific job they are applying to** (application or interview for a new role).
Rules:
- Plain text, short numbered list: 3–5 bullets maximum.
- Each bullet must be defensible from the candidate profile — no invented employers, degrees, or skills.
- Tie strengths to the role when the profile supports it; otherwise say what they could truthfully highlight and what gap to address.
- Tone: direct, professional. No cover-letter fluff.`

  const user = `Candidate profile:\n${params.candidateBrief.slice(0, 5000)}\n\nRole: ${params.jobTitle}\nCompany: ${params.company}${jd}\n\nNumbered talking points only.`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 900,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  return text.slice(0, 3500)
}
