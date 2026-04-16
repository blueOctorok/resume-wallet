import type { HubContext } from '@/lib/ava-context'
import type { WalkthroughStep } from '@/lib/walkthrough-config'

const AI_WELCOME_STEP_ID = 'ai-welcome' as const

/**
 * User message for step 1 of the hub walkthrough. Model must return JSON only so we can parse title + body.
 * HubContext is still sent separately — the system prompt already encodes occupation, blocks, and career lanes.
 */
const WALKTHROUGH_JSON_PROMPT = `Walkthrough modal (step 1 of 3): respond with ONLY valid JSON — one object, no markdown fences, no commentary.
Shape: {"title":"string","body":"string"}
Rules:
- title: max 12 words, warm, use their first name from context if you know it.
- body: exactly 2 short paragraphs, separated by \\n\\n inside the JSON string (real newlines in the string value are OK).
- Personalize using occupation, seeking reason, and extra context from the system prompt.
- If their career is clearly outside our specialty lanes (commercial driving / trucking vs software development), say honestly we do not have niche blocks for that path yet; general-purpose resume and verification blocks still build a strong Career Card; they can ask you later about future block types.
- Do NOT suggest CDL, DOT file, MVR, endorsements, or commercial-driving examples unless their context clearly fits trucking or commercial driving.
- Do NOT suggest GitHub, portfolio, or dev-stack examples as the main path unless their context clearly fits software engineering.
- Keep the whole body under 140 words.`

function stripMarkdownCodeFence(text: string): string {
  const t = text.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1].trim() : t
}

function parseWalkthroughJson(reply: string): { title: string; body: string } | null {
  const raw = stripMarkdownCodeFence(reply)
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const body = typeof o.body === 'string' ? o.body.trim() : ''
    if (!title || !body) return null
    return { title, body }
  } catch {
    return null
  }
}

/** Offline welcome when the API fails or returns unparseable JSON — still occupation-aware, not generic fluff. */
export function fallbackStormiWelcomeStep(firstName: string, occupation: string): WalkthroughStep {
  const name = firstName.trim() || 'there'
  const occ = occupation.trim() || 'your field'
  return {
    id: AI_WELCOME_STEP_ID,
    title: `Hey ${name} — welcome to Storm`,
    body:
      `Storm is your career hub: proof and your story in one place so employers see the real you.\n\n` +
      `We don't have niche blocks for every path yet — including paths like ${occ}. General resume and verification blocks still help you build a strong Career Card. Chat with me anytime if you want to see specialty blocks for your lane down the road.`,
  }
}

/**
 * Fetches AI-written step 1 for the candidate hub walkthrough (uses same auth + usage as normal Stormi chat).
 * `walkthroughWelcome: true` skips job-search tools so the model returns compact JSON.
 */
export async function fetchStormiWelcomeStep(
  walletAddress: string,
  hubContext: HubContext,
  firstName: string,
): Promise<WalkthroughStep> {
  const fallback = () => fallbackStormiWelcomeStep(firstName, hubContext.occupation ?? '')

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress,
      },
      body: JSON.stringify({
        message: `${WALKTHROUGH_JSON_PROMPT}\n\nTheir first name (for the title): ${firstName.trim() || 'friend'}.`,
        hubContext,
        audience: 'candidate',
        walkthroughWelcome: true,
      }),
    })

    const data = (await res.json()) as { reply?: string; error?: string }

    if (!res.ok) {
      console.warn('[walkthrough-ai] chat error', res.status, data.error)
      return fallback()
    }

    const reply = typeof data.reply === 'string' ? data.reply : ''
    const parsed = parseWalkthroughJson(reply)
    if (!parsed) {
      console.warn('[walkthrough-ai] unparseable JSON, using fallback')
      return fallback()
    }

    return {
      id: AI_WELCOME_STEP_ID,
      title: parsed.title,
      body: parsed.body,
    }
  } catch (e) {
    console.warn('[walkthrough-ai] fetch failed', e)
    return fallback()
  }
}

/** Placeholder row while step 1 is loading — StormiWalkthrough renders a skeleton when this id is active. */
export const WALKTHROUGH_AI_LOADING_STEP: WalkthroughStep = {
  id: 'ai-welcome-loading',
  title: '',
  body: '',
}
