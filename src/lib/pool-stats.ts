import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous pool teaser counts for a shared career card.
 *
 * Counts only — never names, ids, or EV material. Employment-verification
 * tables and the `previous_employer_verified` fact are excluded so this
 * surface cannot become an EV browse/aggregate (employer Terms A.3).
 */

export interface PoolStats {
  /** `state` when the candidate has a profile state; otherwise platform-wide. */
  scope: 'state' | 'platform'
  state: string | null
  /** Normalized class letter when we could read one (e.g. "A"). */
  cdlClass: string | null
  driverCount: number
  cleanDrivingRecordCount: number
  /** Active non-EV attestations among the counted drivers. */
  activeAttestationCount: number
}

const CLEAN_MVR = ['clear', 'no_hits']
const EV_FACT = 'previous_employer_verified'

export function normalizeCdlClass(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = raw.toUpperCase().match(/\b([ABC])\b/)
  return match ? match[1] : raw.trim().toUpperCase()
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function selectInChunks(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (const idsChunk of chunk(ids, 150)) {
    const { data, error } = await supabase.from(table).select(columns).in(column, idsChunk)
    if (error) {
      console.warn(`[POOL STATS] ${table} lookup skipped:`, error.message)
      continue
    }
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]))
  }
  return rows
}

export async function loadPoolStatsForShareToken(
  supabase: SupabaseClient,
  shareToken: string,
): Promise<PoolStats | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('share_token', shareToken)
    .maybeSingle()
  if (!user) return null

  const [{ data: profile }, { data: cdl }] = await Promise.all([
    supabase.from('user_profiles').select('state').eq('user_id', user.id).maybeSingle(),
    supabase.from('block_driver_cdl').select('cdl_class').eq('user_id', user.id).maybeSingle(),
  ])

  const state = (profile?.state as string | null)?.trim() || null
  const cdlClass = normalizeCdlClass(cdl?.cdl_class as string | null)

  const { data: cdlRows, error: cdlError } = await supabase
    .from('block_driver_cdl')
    .select('user_id, cdl_class')
    .not('cdl_class', 'is', null)
    .limit(5000)

  if (cdlError || !cdlRows?.length) {
    return emptyStats(state, cdlClass)
  }

  const classMatched = cdlRows.filter((row) => {
    if (!cdlClass) return true
    return normalizeCdlClass(row.cdl_class as string | null) === cdlClass
  })
  const classIds = [...new Set(classMatched.map((row) => row.user_id as string))]
  if (classIds.length === 0) return emptyStats(state, cdlClass)

  const blockRows = await selectInChunks(
    supabase,
    'hub_blocks',
    'user_id, block_type',
    'user_id',
    classIds,
  )
  const driverIds = new Set(
    blockRows
      .filter((row) => String(row.block_type ?? '').startsWith('driver-'))
      .map((row) => String(row.user_id)),
  )

  let scopedIds = classIds.filter((id) => driverIds.has(id))
  let scope: PoolStats['scope'] = 'platform'

  if (state) {
    const profileRows = await selectInChunks(
      supabase,
      'user_profiles',
      'user_id, state',
      'user_id',
      scopedIds,
    )
    const inState = new Set(
      profileRows
        .filter((row) => String(row.state ?? '').trim().toLowerCase() === state.toLowerCase())
        .map((row) => String(row.user_id)),
    )
    scopedIds = scopedIds.filter((id) => inState.has(id))
    scope = 'state'
  }

  if (scopedIds.length === 0) return emptyStats(state, cdlClass, scope)

  const [mvrRows, attestationRows] = await Promise.all([
    selectInChunks(supabase, 'mvr_orders', 'driver_user_id, result_outcome', 'driver_user_id', scopedIds),
    selectInChunks(
      supabase,
      'attestations',
      'candidate_user_id, fact_type, superseded_by',
      'candidate_user_id',
      scopedIds,
    ),
  ])

  const cleanDrivers = new Set(
    mvrRows
      .filter((row) => CLEAN_MVR.includes(String(row.result_outcome ?? '')))
      .map((row) => String(row.driver_user_id)),
  )
  const attestedDrivers = new Set(
    attestationRows
      .filter((row) => row.superseded_by == null && row.fact_type !== EV_FACT)
      .map((row) => String(row.candidate_user_id)),
  )

  return {
    scope,
    state: scope === 'state' ? state : null,
    cdlClass,
    driverCount: scopedIds.length,
    cleanDrivingRecordCount: [...cleanDrivers].filter((id) => scopedIds.includes(id)).length,
    activeAttestationCount: [...attestedDrivers].filter((id) => scopedIds.includes(id)).length,
  }
}

function emptyStats(
  state: string | null,
  cdlClass: string | null,
  scope: PoolStats['scope'] = state ? 'state' : 'platform',
): PoolStats {
  return {
    scope,
    state: scope === 'state' ? state : null,
    cdlClass,
    driverCount: 0,
    cleanDrivingRecordCount: 0,
    activeAttestationCount: 0,
  }
}
