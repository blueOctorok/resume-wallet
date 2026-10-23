import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'
import {
  RECRUITER_STATUS_SYSTEM,
  recruiterStatusFallback,
  recruiterStatusPrompt,
  type RecruiterStatusItem,
} from '@/lib/recruiter-status-note'

const ITEM_IDS = new Set<DqItemId>([
  'cdlis_consent',
  'mvr',
  'psp',
  'dl_images',
  'dot_application',
  'employment_verification',
])

const STATUSES = new Set<DqItemStatus>([
  'missing',
  'requested',
  'in_progress',
  'processing',
  'complete',
  'failed',
  'needs_driver',
  'needs_key',
  'needs_gov',
  'needs_employer',
  'coming_soon',
])

function readItems(value: unknown): RecruiterStatusItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return null
  const items: RecruiterStatusItem[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') return null
    const candidate = row as { id?: unknown; status?: unknown; line?: unknown }
    if (typeof candidate.id !== 'string' || !ITEM_IDS.has(candidate.id as DqItemId)) return null
    if (typeof candidate.status !== 'string' || !STATUSES.has(candidate.status as DqItemStatus)) return null
    if (typeof candidate.line !== 'string') return null
    const line = candidate.line.trim().slice(0, 500)
    if (!line) return null
    items.push({ id: candidate.id as DqItemId, status: candidate.status as DqItemStatus, line })
  }
  return items
}

/**
 * POST /api/employer/dq-monitor/status-note
 *
 * One short paragraph about a single driver, from the status lines the board
 * already computed. Haiku rephrases them. If the model is down, the same
 * facts are returned in a plain sentence.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, userId)
    if (!ctx) return NextResponse.json({ error: 'No company access' }, { status: 403 })

    const body = (await request.json().catch(() => null)) as { name?: unknown; items?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const items = readItems(body?.items)
    if (!name || !items) return NextResponse.json({ error: 'Pick a driver first' }, { status: 400 })

    const fallback = recruiterStatusFallback(name, items)
    if (!process.env.AVA_BRAIN) {
      console.warn('[DQ STATUS NOTE] AVA_BRAIN missing — plain sentence')
      return NextResponse.json({ message: fallback })
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL_HAIKU,
        max_tokens: 220,
        system: RECRUITER_STATUS_SYSTEM,
        messages: [{ role: 'user', content: recruiterStatusPrompt(name, items) }],
      })
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
      return NextResponse.json({ message: text.slice(0, 800) || fallback })
    } catch (err) {
      console.error('[DQ STATUS NOTE] Anthropic failed — plain sentence:', err)
      return NextResponse.json({ message: fallback })
    }
  } catch (err) {
    console.error('[DQ STATUS NOTE]', err)
    return NextResponse.json({ error: 'Could not write the update' }, { status: 500 })
  }
}
