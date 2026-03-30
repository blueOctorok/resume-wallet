import Anthropic from '@anthropic-ai/sdk'

export interface EmployerEvalRequest {
  requesterName: string
  companyName: string
  description: string
  emailDomain: string | null
}

export interface EmployerEvalResult {
  decision: 'approve' | 'flag' | 'block'
  reason: string
  confidence: number
  /** If the requested company name matches an existing company, this is the exact name from the DB */
  existingMatch: string | null
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 512

const anthropic = new Anthropic({
  apiKey: process.env.AVA_BRAIN,
})

function buildEvalPrompt(existingCompanyNames: string[]): string {
  const companiesList = existingCompanyNames.length > 0
    ? existingCompanyNames.map(n => `  - ${n}`).join('\n')
    : '  (none yet)'

  return `You are a gatekeeper for StormChain, a professional career management platform. Your job is to evaluate employer access requests and decide whether the company should be auto-approved, flagged for human review, or blocked.

StormChain serves all industries — trucking, tech, manufacturing, retail, healthcare, etc. Any legitimate business that hires people is a valid employer.

## Duplicate company detection (CRITICAL)

Before making any decision, compare the requested company name against the existing companies list below. Use fuzzy matching — ignore case, whitespace, punctuation, and common suffixes like "LLC", "Inc", "Corp", "Co", "Ltd". Examples:
- "Pace Drivers" matches "Pace Drivers LLC"
- "acme trucking" matches "Acme Trucking Inc."
- "STARS" matches "Stars"

If you detect a match, you MUST set "existingMatch" to the EXACT name from the existing companies list (copy it character-for-character). A match is NOT grounds for blocking — it means this person likely works for that company and wants to join it. Still evaluate legitimacy normally.

## Decision criteria

**APPROVE** when ALL of these are true:
- Company name sounds like a real business (not gibberish, test data, or a person's name)
- Description demonstrates the requester is authorized (mentions role like owner, HR, recruiter, hiring manager)
- Confidence >= 0.7

**FLAG** when any of these are true:
- You're uncertain about legitimacy (confidence 0.3–0.7)
- Company name is very generic or common (could be a duplicate)
- Description is vague but not obviously spam
- Email domain is a free provider (gmail, yahoo, hotmail) — not disqualifying but worth review

**BLOCK** when any of these are true:
- Company name is gibberish, profanity, or clearly fake
- Description is nonsensical, promotional spam, or copy-pasted boilerplate
- Obvious test/dummy data ("test company", "asdf", "123")
- Confidence < 0.3

## Existing companies on StormChain
${companiesList}

## Response format

Return ONLY valid JSON with no markdown formatting:
{"decision":"approve","reason":"Brief explanation","confidence":0.85,"existingMatch":null}

decision must be exactly one of: approve, flag, block
reason must be a single sentence explaining why
confidence must be a number between 0 and 1
existingMatch must be null OR the exact company name string copied from the existing companies list above`
}

/**
 * Calls Claude to evaluate an employer access request.
 * Falls back to "flag" if AI call fails — safe default that requires human review.
 */
export async function evaluateEmployerRequest(
  request: EmployerEvalRequest,
  existingCompanyNames: string[]
): Promise<EmployerEvalResult> {
  try {
    const systemPrompt = buildEvalPrompt(existingCompanyNames)

    const userMessage = [
      `Requester: ${request.requesterName}`,
      `Company: ${request.companyName}`,
      `Description: ${request.description}`,
      `Email domain: ${request.emailDomain ?? 'unknown'}`,
    ].join('\n')

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    const parsed = JSON.parse(cleaned) as {
      decision?: string
      reason?: string
      confidence?: number
      existingMatch?: string | null
    }

    const validDecisions = ['approve', 'flag', 'block'] as const
    const decision = validDecisions.includes(parsed.decision as typeof validDecisions[number])
      ? (parsed.decision as EmployerEvalResult['decision'])
      : 'flag'

    return {
      decision,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'Unable to determine reason',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      existingMatch: typeof parsed.existingMatch === 'string' ? parsed.existingMatch : null,
    }
  } catch (error) {
    console.error('[Stormi Employer Eval] Error:', error)
    return {
      decision: 'flag',
      reason: 'AI evaluation unavailable — flagged for manual review',
      confidence: 0,
      existingMatch: null,
    }
  }
}
