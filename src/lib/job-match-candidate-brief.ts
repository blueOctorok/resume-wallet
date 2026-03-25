/**
 * Compact text summary of a candidate for job-matching / cover-letter AI (no PII beyond profile fields).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockDefinition } from '@/lib/block-registry'
import {
  getCdlData,
  getDevGithub,
  getDevPortfolio,
  getEducation,
  getSkills,
} from '@/lib/block-data'

export async function buildJobMatchCandidateBrief(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const [{ data: profile }, { data: onboarding }, { data: hubBlocks }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name, headline, professional_summary, city, state')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('hub_onboarding').select('occupation').eq('user_id', userId).maybeSingle(),
    supabase.from('hub_blocks').select('block_type').eq('user_id', userId).order('position', { ascending: true }),
  ])

  const [cdl, skills, education, portfolio, github] = await Promise.all([
    getCdlData(supabase, userId),
    getSkills(supabase, userId),
    getEducation(supabase, userId),
    getDevPortfolio(supabase, userId),
    getDevGithub(supabase, userId),
  ])

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const lines: string[] = []

  if (name) lines.push(`Name: ${name}`)
  const occ = profile?.headline?.trim() || onboarding?.occupation?.trim()
  if (occ) lines.push(`Headline / occupation: ${occ}`)
  if (profile?.city || profile?.state) {
    lines.push(`Location: ${[profile?.city, profile?.state].filter(Boolean).join(', ')}`)
  }
  if (profile?.professional_summary?.trim()) {
    const s = profile.professional_summary.trim()
    lines.push(`Summary: ${s.length > 600 ? `${s.slice(0, 600)}…` : s}`)
  }

  const blockLabels = (hubBlocks ?? [])
    .map((b) => getBlockDefinition(b.block_type as string)?.label)
    .filter(Boolean) as string[]
  if (blockLabels.length) lines.push(`Hub blocks: ${blockLabels.join(', ')}`)

  if (cdl?.cdl_class) {
    lines.push(`CDL: Class ${cdl.cdl_class}, state ${cdl.cdl_state ?? 'n/a'}`)
  }
  if (skills.length) {
    const names = skills
      .map((s) => s.name)
      .filter(Boolean)
      .slice(0, 25)
    if (names.length) lines.push(`Skills: ${names.join(', ')}`)
  }
  if (education.length) {
    lines.push(`Education entries: ${education.length}`)
  }
  if (portfolio?.portfolio_url) lines.push(`Portfolio: ${portfolio.portfolio_url}`)
  if (github?.username) lines.push(`GitHub: ${github.username}`)

  if (lines.length === 0) return 'Limited profile data; infer fit from job titles only.'
  return lines.join('\n')
}
