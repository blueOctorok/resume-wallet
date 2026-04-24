import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'

/**
 * POST /api/ai/extract-job-requirements
 *
 * Idempotent cache: reads `external_job_requirements` first; on miss, runs a
 * single Haiku pass to extract checklist-style requirements, then upserts.
 *
 * Body: { jobId: string, source: string, title: string, description?: string | null }
 */

interface RequirementRow {
  id: string
  label: string
  kind: 'skill' | 'credential' | 'experience' | 'other'
}

function heuristicRequirements(title: string, description: string): RequirementRow[] {
  const text = `${title} ${description}`.toLowerCase()
  const out: RequirementRow[] = []
  if (/\bcdl\b|commercial driver|class a/.test(text)) {
    out.push({ id: 'cdl', label: 'Valid CDL (Class A or as stated)', kind: 'credential' })
  }
  if (/\bmvr\b|driving record|clean driving/.test(text)) {
    out.push({ id: 'mvr', label: 'Motor vehicle record / clean driving history', kind: 'credential' })
  }
  if (/\bdot\b|fmcsa|dqf/.test(text)) {
    out.push({ id: 'dot', label: 'DOT / FMCSA compliance documentation', kind: 'credential' })
  }
  if (/\breact\b|typescript|node|python|java\b/.test(text)) {
    out.push({ id: 'tech', label: 'Technical skills stated in posting', kind: 'skill' })
  }
  out.push({ id: 'resume', label: 'Resume / work history', kind: 'experience' })
  return out
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

    if (!jobId || !title) {
      return NextResponse.json({ error: 'jobId and title are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { data: cached } = await supabase
      .from('external_job_requirements')
      .select('requirements_json, extracted_at')
      .eq('job_id', jobId)
      .eq('source', source)
      .maybeSingle()

    if (cached?.requirements_json) {
      return NextResponse.json({
        success: true,
        cached: true,
        requirements: cached.requirements_json,
        extractedAt: cached.extracted_at,
      })
    }

    let requirements: RequirementRow[] = []

    if (process.env.AVA_BRAIN) {
      const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
      const prompt = `Extract 4–12 concrete hiring requirements from this job as JSON array only (no markdown): [{"id":"slug","label":"short label","kind":"skill|credential|experience|other"}]

Title: ${title}
Description (may be HTML; infer): ${description.slice(0, 8000)}`

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL_HAIKU,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      const text =
        resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as unknown
          if (Array.isArray(parsed)) {
            requirements = parsed
              .filter((x): x is RequirementRow => {
                if (!x || typeof x !== 'object') return false
                const o = x as Record<string, unknown>
                return typeof o.id === 'string' && typeof o.label === 'string' && typeof o.kind === 'string'
              })
              .slice(0, 20)
          }
        } catch {
          requirements = heuristicRequirements(title, description)
        }
      } else {
        requirements = heuristicRequirements(title, description)
      }
    } else {
      requirements = heuristicRequirements(title, description)
    }

    if (requirements.length === 0) {
      requirements = heuristicRequirements(title, description)
    }

    const { error: upsertErr } = await supabase.from('external_job_requirements').upsert(
      {
        job_id: jobId,
        source,
        requirements_json: requirements,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: 'job_id,source' },
    )

    if (upsertErr) {
      console.error('[extract-job-requirements] upsert:', upsertErr)
      return NextResponse.json(
        { success: true, cached: false, requirements, warning: 'cache_write_failed' },
        { status: 200 },
      )
    }

    return NextResponse.json({ success: true, cached: false, requirements })
  } catch (e) {
    console.error('[extract-job-requirements]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
