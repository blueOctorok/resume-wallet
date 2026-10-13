/**
 * Contact research for employment-verification packets.
 *
 * The single biggest leak in the EV funnel is a packet with no employer
 * address: it sits at attempt 0 forever. Two sources fix most of that:
 *
 *   1. FMCSA QCMobile (free, official) — every registered carrier's listed
 *      phone and physical address, by name or USDOT number. No email, though.
 *   2. Claude + web search — finds a safety / HR / DQ-file email on the
 *      carrier's own domain when one is public.
 *
 * Research only PROPOSES contacts. Nothing is sent until the driver confirms,
 * because a guessed address would leak the driver's employment claim to a
 * stranger. See /api/candidate/verification/[id]/set-contact.
 *
 * Env: FMCSA_WEBKEY (https://mobile.fmcsa.dot.gov/QCDevsite), ANTHROPIC_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'

export interface FmcsaCarrierMatch {
  dotNumber: number
  legalName: string
  dbaName: string | null
  phone: string | null
  address: string | null
  state: string | null
  /** 0–1 token overlap between the driver's employer name and this record. */
  matchScore: number
}

export interface EmailCandidate {
  email: string
  sourceUrl: string | null
  confidence: 'high' | 'medium' | 'low'
  note: string | null
}

export interface EvrContactResearch {
  researchedAt: string
  fmcsa: FmcsaCarrierMatch[]
  emailCandidates: EmailCandidate[]
  sources: string[]
}

// ── FMCSA QCMobile ──────────────────────────────────────────────────────────

const FMCSA_BASE = 'https://mobile.fmcsa.dot.gov/qc/services'

/** Shape of one carrier object inside QCMobile's `content` payload (fields we use). */
interface QcCarrier {
  dotNumber?: number | string
  legalName?: string | null
  dbaName?: string | null
  telephone?: string | null
  phyStreet?: string | null
  phyCity?: string | null
  phyState?: string | null
  phyZipcode?: string | null
}

const NOISE_TOKENS = new Set(['inc', 'llc', 'corp', 'co', 'company', 'the', 'of', 'and', 'ltd', 'lp'])

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !NOISE_TOKENS.has(t))
}

/** Jaccard-style overlap on meaningful tokens; "Swift Transportation" vs "SWIFT TRANSPORTATION CO OF ARIZONA LLC" ≈ 1. */
function scoreName(query: string, candidate: string): number {
  const q = new Set(nameTokens(query))
  if (q.size === 0) return 0
  const c = new Set(nameTokens(candidate))
  let hits = 0
  for (const t of q) if (c.has(t)) hits++
  return hits / q.size
}

function toMatch(c: QcCarrier, query: string): FmcsaCarrierMatch | null {
  const dot = Number(c.dotNumber)
  const legal = c.legalName?.trim()
  if (!dot || !legal) return null
  const addressParts = [c.phyStreet, [c.phyCity, c.phyState].filter(Boolean).join(', '), c.phyZipcode]
    .map((p) => (p ?? '').toString().trim())
    .filter(Boolean)
  const best = Math.max(scoreName(query, legal), c.dbaName ? scoreName(query, c.dbaName) : 0)
  return {
    dotNumber: dot,
    legalName: legal,
    dbaName: c.dbaName?.trim() || null,
    phone: c.telephone?.trim() || null,
    address: addressParts.length ? addressParts.join(' · ') : null,
    state: c.phyState?.trim() || null,
    matchScore: Number(best.toFixed(2)),
  }
}

/** QCMobile wraps results as `{ content: [{ carrier }] }` for searches and `{ content: { carrier } }` for a single DOT. */
function extractCarriers(payload: unknown): QcCarrier[] {
  const content = (payload as { content?: unknown })?.content
  const items = Array.isArray(content) ? content : content ? [content] : []
  return items
    .map((item) => (item as { carrier?: QcCarrier })?.carrier ?? (item as QcCarrier))
    .filter((c): c is QcCarrier => Boolean(c && typeof c === 'object'))
}

export async function lookupFmcsaCarriers(
  employerName: string,
  preferredState?: string | null,
): Promise<FmcsaCarrierMatch[]> {
  const webKey = process.env.FMCSA_WEBKEY
  if (!webKey) {
    console.warn('[EVR RESEARCH] FMCSA_WEBKEY not set — skipping carrier lookup')
    return []
  }
  const name = employerName.trim()
  if (!name) return []

  const url = `${FMCSA_BASE}/carriers/name/${encodeURIComponent(name)}?webKey=${encodeURIComponent(webKey)}&size=25`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.warn('[EVR RESEARCH] FMCSA lookup failed:', res.status)
    return []
  }

  const state = preferredState?.trim().toUpperCase() || null
  return extractCarriers(await res.json())
    .map((c) => toMatch(c, name))
    .filter((m): m is FmcsaCarrierMatch => Boolean(m && m.matchScore >= 0.5))
    .sort((a, b) => {
      // Same-state records first, then by name overlap.
      const sa = state && a.state === state ? 1 : 0
      const sb = state && b.state === state ? 1 : 0
      return sb - sa || b.matchScore - a.matchScore
    })
    .slice(0, 3)
}

// ── Email discovery via Claude web search ───────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailFinderInput {
  employerName: string
  city?: string | null
  state?: string | null
  dotNumber?: number | null
}

export async function findEmployerEmail(input: EmailFinderInput): Promise<EmailCandidate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const where = [input.city, input.state].filter(Boolean).join(', ')
  const prompt = [
    `Find a publicly listed email address for the safety, HR, driver qualification, or employment verification department of the trucking company "${input.employerName}"${where ? ` in ${where}` : ''}${input.dotNumber ? ` (USDOT ${input.dotNumber})` : ''}.`,
    'Rules: only return addresses that appear on the company\'s own website or a page clearly about this company. Never invent or pattern-guess an address. Prefer role mailboxes (safety@, hr@, verifications@) over personal ones.',
    'Respond with ONLY a JSON array (max 3 items) of {"email": string, "sourceUrl": string, "confidence": "high"|"medium"|"low", "note": string}. Return [] if nothing verifiable is found.',
  ].join('\n')

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL_HAIKU,
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: [{ role: 'user', content: prompt }],
    })

    // The final text block carries the JSON; earlier blocks are search traffic.
    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    const jsonStart = text.indexOf('[')
    const jsonEnd = text.lastIndexOf(']')
    if (jsonStart < 0 || jsonEnd <= jsonStart) return []

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): EmailCandidate | null => {
        const email = String((item as { email?: unknown })?.email ?? '').trim().toLowerCase()
        if (!EMAIL_RE.test(email)) return null
        const conf = String((item as { confidence?: unknown })?.confidence ?? 'low')
        return {
          email,
          sourceUrl: ((item as { sourceUrl?: unknown })?.sourceUrl as string | undefined) ?? null,
          confidence: conf === 'high' || conf === 'medium' ? conf : 'low',
          note: ((item as { note?: unknown })?.note as string | undefined) ?? null,
        }
      })
      .filter((c): c is EmailCandidate => c !== null)
      .slice(0, 3)
  } catch (err) {
    console.warn('[EVR RESEARCH] Email finder failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ── Orchestration ───────────────────────────────────────────────────────────

/** Pull "OH" out of "Columbus, OH 43215" style free-text addresses. */
function stateFromAddress(address: string | null | undefined): string | null {
  const m = String(address ?? '').match(/\b([A-Z]{2})\b(?:\s+\d{5})?\s*$/)
  return m ? m[1] : null
}

/**
 * Run both sources for a packet and persist the result. Returns the research
 * payload the UI renders for driver confirmation.
 */
export async function researchEmployerContact(
  supabase: SupabaseClient,
  requestId: string,
): Promise<EvrContactResearch> {
  const { data: row } = await supabase
    .from('employment_verification_requests')
    .select('id, previous_employer_name, previous_employer_address')
    .eq('id', requestId)
    .single()

  const employerName = String(row?.previous_employer_name ?? '')
  const address = (row?.previous_employer_address as string | null) ?? null
  const fmcsa = await lookupFmcsaCarriers(employerName, stateFromAddress(address))
  const best = fmcsa[0]
  const emailCandidates = await findEmployerEmail({
    employerName: best?.legalName ?? employerName,
    state: best?.state ?? stateFromAddress(address),
    dotNumber: best?.dotNumber ?? null,
  })

  const research: EvrContactResearch = {
    researchedAt: new Date().toISOString(),
    fmcsa,
    emailCandidates,
    sources: [
      ...(fmcsa.length ? ['FMCSA QCMobile carrier registry'] : []),
      ...(emailCandidates.length ? ['Web search (Claude) — company-domain email'] : []),
    ],
  }

  await supabase
    .from('employment_verification_requests')
    .update({
      contact_research: research,
      contact_research_status: fmcsa.length || emailCandidates.length ? 'found' : 'not_found',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  return research
}
