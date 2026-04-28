/**
 * Career Card Lenses — server-side helpers.
 *
 * Lenses live in `career_card_lenses`. Each user has one default "Full profile"
 * lens (created by migration 068 and a trigger) plus any number of user-defined
 * lenses. A lens is PRESENTATION only: filter (`visible_block_types`), emphasis
 * order (`emphasized_block_types`), and optional `custom_summary`.
 *
 * NEVER query `career_card_lenses` directly from API routes. Use these helpers
 * so the shape + ensure-default semantics stay consistent with the projection
 * layer.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { CARD_PAGE_MAX } from '@/lib/hub-block-config'

/** Reserved name for the one-and-only default lens per user. UI forbids reuse. */
export const FULL_PROFILE_LENS_NAME = 'Full profile'

/** Soft nudge threshold — past this count the manage modal suggests merging. */
export const SOFT_LENS_LIMIT = 6
/** Hard create block — matches "Storm is not a spam-apply tool" product stance. */
export const HARD_LENS_LIMIT = 10

/** Row shape as stored. snake_case mirrors the column names. */
export interface CareerCardLensRow {
  id: string
  user_id: string
  name: string
  is_default: boolean
  /** NULL = show all installed blocks. Empty array = show none. */
  visible_block_types: string[] | null
  /** Sections emphasized (rendered first) in the order given. */
  emphasized_block_types: string[] | null
  custom_summary: string | null
  created_at: string
  updated_at: string
}

/** Client-safe projection. Never leak `user_id` outside owner-scoped responses. */
export interface CareerCardLens {
  id: string
  name: string
  isDefault: boolean
  visibleBlockTypes: string[] | null
  emphasizedBlockTypes: string[]
  customSummary: string | null
  createdAt: string
  updatedAt: string
}

export function rowToLens(row: CareerCardLensRow): CareerCardLens {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    visibleBlockTypes: row.visible_block_types,
    emphasizedBlockTypes: row.emphasized_block_types ?? [],
    customSummary: row.custom_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Idempotent: guarantees the user has exactly one default lens, creating one
 * if the trigger somehow missed it (belt-and-braces for users who existed
 * before migration 068 was applied on a branch).
 */
export async function ensureDefaultLensForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CareerCardLensRow> {
  const existing = await supabase
    .from('career_card_lenses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (existing.data) return existing.data as CareerCardLensRow

  const inserted = await supabase
    .from('career_card_lenses')
    .insert({
      user_id: userId,
      name: FULL_PROFILE_LENS_NAME,
      is_default: true,
      visible_block_types: null,
      emphasized_block_types: null,
      custom_summary: null,
    })
    .select('*')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(`Failed to ensure default lens: ${inserted.error?.message ?? 'unknown error'}`)
  }
  return inserted.data as CareerCardLensRow
}

/**
 * List every lens for a user, default-first, then by created_at asc so the
 * manage modal shows a stable order.
 */
export async function listLensesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CareerCardLensRow[]> {
  await ensureDefaultLensForUser(supabase, userId)
  const { data, error } = await supabase
    .from('career_card_lenses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) {
    throw new Error(`Failed to list lenses: ${error.message}`)
  }
  return (data ?? []) as CareerCardLensRow[]
}

/**
 * Look up a specific lens for a user. If `lensId` is null/missing or doesn't
 * belong to the user, falls back to the default. This is intentional — we
 * NEVER want a bad `?lens=` param to 500 the career card; worst case the
 * candidate sees their full profile.
 */
export async function getLensOrDefault(
  supabase: SupabaseClient,
  userId: string,
  lensId: string | null | undefined,
): Promise<CareerCardLensRow> {
  if (lensId) {
    const { data } = await supabase
      .from('career_card_lenses')
      .select('*')
      .eq('id', lensId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) return data as CareerCardLensRow
  }
  return ensureDefaultLensForUser(supabase, userId)
}

/**
 * Reshape a list of CareerCardSections through a lens:
 *   1. Filter to `visibleBlockTypes` (unless null — meaning "all")
 *   2. Move emphasized sections to the front, in the order given
 *   3. Keep relative order of non-emphasized sections
 *
 * Returns a new array; never mutates the input.
 */
export function applyLensOrderAndFilter<T extends { blockType: string }>(
  sections: T[],
  lens: Pick<CareerCardLensRow, 'visible_block_types' | 'emphasized_block_types'>,
): T[] {
  const visible = lens.visible_block_types
  const filtered =
    visible == null ? sections : sections.filter((s) => visible.includes(s.blockType))

  const emph = lens.emphasized_block_types ?? []
  if (emph.length === 0) return filtered

  const emphIndex = new Map(emph.map((bt, i) => [bt, i]))
  const emphasized = filtered.filter((s) => emphIndex.has(s.blockType))
  const rest = filtered.filter((s) => !emphIndex.has(s.blockType))
  emphasized.sort((a, b) => {
    const ai = emphIndex.get(a.blockType) ?? 0
    const bi = emphIndex.get(b.blockType) ?? 0
    return ai - bi
  })
  return [...emphasized, ...rest]
}

/**
 * Apply lens filter + emphasis order **within each card page** only, then
 * concatenate pages in ascending order. Keeps pagination boundaries intact
 * when a lens would otherwise pull a page-2 block ahead of page-1 content.
 */
export function applyLensOrderAndFilterPerPage<T extends { blockType: string; cardPage?: number }>(
  sections: T[],
  lens: Pick<CareerCardLensRow, 'visible_block_types' | 'emphasized_block_types'>,
): T[] {
  const byPage = new Map<number, T[]>()
  for (const s of sections) {
    const raw = s.cardPage
    const p = Math.min(CARD_PAGE_MAX, Math.max(1, typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 1))
    if (!byPage.has(p)) byPage.set(p, [])
    byPage.get(p)!.push(s)
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b)
  return pages.flatMap((p) => applyLensOrderAndFilter(byPage.get(p)!, lens))
}
