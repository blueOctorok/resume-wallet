import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'
import { BLOCK_DEFINITIONS, getBlockDefinition } from '@/lib/block-registry'

/**
 * POST /api/ai/draft-lens
 *
 * Body: { jobId: string, source?: string, title?: string, description?: string }
 *
 * Returns a DRAFT lens (not persisted in `career_card_lenses` yet). The
 * client saves it with a confirmation click via the normal lens create API.
 *
 * Caching: per (user_id, job_id, source) in `career_card_lens_drafts` so
 * re-clicking the same job does NOT re-bill Haiku. Drafts never expire —
 * if the user actually saves the lens, it's copied into `career_card_lenses`
 * and the draft row can safely remain.
 *
 * Product guardrail: this is ONE drafted lens per job. Do not add a bulk
 * variant — lenses are a per-application quality tool, never a batch lever.
 */

interface DraftLens {
  name: string
  visibleBlockTypes: string[]
  emphasizedBlockTypes: string[]
  summary: string | null
}

interface RequirementRow {
  id: string
  label: string
  kind: 'skill' | 'credential' | 'experience' | 'other'
}

/**
 * Heuristic fallback when AVA_BRAIN is unavailable. Picks the 4–6 installed
 * blocks whose category or keywords best match the job title, keeps the
 * lens name short and honest, and leaves summary null (user can edit).
 */
function heuristicDraft(jobTitle: string, installed: string[]): DraftLens {
  const titleLower = jobTitle.toLowerCase()

  const categoryPrefix = /driver|cdl|truck|trucking|freight|dot|dispatch|logistics/.test(titleLower)
    ? 'driver-'
    : /developer|engineer|frontend|backend|react|node|python|typescript|software/.test(titleLower)
      ? 'developer-'
      : null

  const ranked = installed
    .map((id) => {
      const def = getBlockDefinition(id)
      let score = 0
      if (categoryPrefix && id.startsWith(categoryPrefix)) score += 10
      if (def?.suggestedFor?.some((kw) => titleLower.includes(kw.toLowerCase()))) score += 5
      if (def?.appearsOnCareerCard) score += 1
      return { id, score }
    })
    .sort((a, b) => b.score - a.score)

  const keepers = ranked.filter((r) => r.score > 0).map((r) => r.id)
  const visible = keepers.length >= 2 ? keepers.slice(0, 8) : installed

  return {
    name: categoryPrefix === 'driver-'
      ? 'Driver'
      : categoryPrefix === 'developer-'
        ? 'Developer'
        : jobTitle.split(/\s+/).slice(0, 2).join(' ') || 'Tailored lens',
    visibleBlockTypes: visible,
    emphasizedBlockTypes: ranked.slice(0, 3).filter((r) => r.score >= 5).map((r) => r.id),
    summary: null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 401 })
    }

    const body = (await request.json()) as {
      jobId?: unknown
      source?: unknown
      title?: unknown
      description?: unknown
    }
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
    const source = typeof body.source === 'string' ? body.source.trim() : 'adzuna'
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Cache hit — never re-call Haiku for the same (user, job, source).
    const cached = await supabase
      .from('career_card_lens_drafts')
      .select('draft_json, created_at')
      .eq('user_id', user.id)
      .eq('job_id', jobId)
      .eq('source', source)
      .maybeSingle()

    if (cached.data?.draft_json) {
      return NextResponse.json({
        success: true,
        cached: true,
        draft: cached.data.draft_json as DraftLens,
      })
    }

    // Installed blocks are the only blocks a lens may show — lenses never
    // "add" blocks, only filter and emphasize what's already there.
    const { data: hubRows } = await supabase
      .from('hub_blocks')
      .select('block_type')
      .eq('user_id', user.id)

    const installed = (hubRows ?? []).map((r) => r.block_type as string)
    if (installed.length === 0) {
      return NextResponse.json(
        { error: 'User has no installed blocks to draft a lens over' },
        { status: 400 },
      )
    }

    // Pull extracted requirements if we've already analyzed this job — free
    // context for Haiku that would otherwise cost a second call.
    const { data: reqRow } = await supabase
      .from('external_job_requirements')
      .select('requirements_json')
      .eq('job_id', jobId)
      .eq('source', source)
      .maybeSingle()
    const requirements = (reqRow?.requirements_json ?? []) as RequirementRow[]

    let draft: DraftLens | null = null

    if (process.env.AVA_BRAIN && title) {
      const installedWithLabels = installed
        .map((id) => {
          const def = getBlockDefinition(id)
          return def ? `${id} (${def.label})` : id
        })
        .join(', ')

      const prompt = `You are helping a job seeker reframe their career card for a specific role. Return ONE JSON object (no markdown, no prose) with the following shape:

{"name": "<2-3 word lens name>", "visible_block_types": ["block-id", ...], "emphasized_block_types": ["block-id", ...], "summary": "<2-sentence summary or null>"}

Rules:
- visible_block_types must be a subset of the installed blocks below (use exact ids)
- emphasized_block_types must be a subset of visible_block_types
- prefer 4–8 visible, 2–3 emphasized
- name should reflect the job (e.g. "Driver", "Backend", "Ops lead") — do NOT name it "Full profile"
- summary is an optional 2-sentence framing in first-person; null if no clear angle

Job title: ${title}
Job description (first ~4k chars): ${description.slice(0, 4000)}
Known requirements: ${requirements.map((r) => r.label).join('; ') || '(none extracted)'}
Installed blocks: ${installedWithLabels}`

      try {
        const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
        const resp = await anthropic.messages.create({
          model: ANTHROPIC_MODEL_HAIKU,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
          const installedSet = new Set(installed)
          const allowedIds = new Set(BLOCK_DEFINITIONS.map((b) => b.id))
          const visible = Array.isArray(parsed.visible_block_types)
            ? (parsed.visible_block_types as unknown[])
                .filter((x): x is string => typeof x === 'string')
                .filter((x) => installedSet.has(x) && allowedIds.has(x))
            : []
          const emphasized = Array.isArray(parsed.emphasized_block_types)
            ? (parsed.emphasized_block_types as unknown[])
                .filter((x): x is string => typeof x === 'string')
                .filter((x) => visible.includes(x))
            : []
          const name = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 40) : ''
          const summary =
            typeof parsed.summary === 'string' && parsed.summary.trim()
              ? parsed.summary.trim().slice(0, 400)
              : null

          if (name && visible.length >= 2) {
            draft = {
              name: name === 'Full profile' ? `${name} (tailored)` : name,
              visibleBlockTypes: visible,
              emphasizedBlockTypes: emphasized,
              summary,
            }
          }
        }
      } catch (e) {
        console.error('[draft-lens] haiku call failed:', e)
      }
    }

    if (!draft) {
      draft = heuristicDraft(title || 'Tailored lens', installed)
    }

    const { error: upsertErr } = await supabase.from('career_card_lens_drafts').upsert(
      {
        user_id: user.id,
        job_id: jobId,
        source,
        draft_json: draft,
      },
      { onConflict: 'user_id,job_id,source' },
    )

    if (upsertErr) {
      console.error('[draft-lens] upsert:', upsertErr)
      return NextResponse.json({ success: true, cached: false, draft, warning: 'cache_write_failed' })
    }

    return NextResponse.json({ success: true, cached: false, draft })
  } catch (e) {
    console.error('[draft-lens]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
