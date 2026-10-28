import type { SupabaseClient } from '@supabase/supabase-js'
import { isMidnightPredicateProof } from '@/lib/card-fact-display'
import { nextUnprovedDriver, type ProofQueueOrder } from '@/lib/mvr-proof-queue'
import { proveCompletedMvrFacts } from '@/lib/prove-mvr-facts'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const PAGE = 30
const IDLE_MS = 30_000
const COOLDOWN_MS = 15 * 60 * 1000

interface ResultEmbed {
  license_class: string | null
}

function licenseClassFromEmbed(value: ResultEmbed | ResultEmbed[] | null): string | null {
  const row = Array.isArray(value) ? value[0] : value
  const raw = row?.license_class
  return typeof raw === 'string' && raw.trim() ? raw : null
}

async function loadPage(
  supabase: SupabaseClient,
  before: string | null,
): Promise<ProofQueueOrder[]> {
  let query = supabase
    .from('mvr_orders')
    .select('driver_user_id, completed_at, mvr_results(license_class)')
    .eq('status', 'completed')
    .is('ordered_by_company_id', null)
    .not('driver_user_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(PAGE)

  if (before) query = query.lt('completed_at', before)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).flatMap((row) => {
    const userId = typeof row.driver_user_id === 'string' ? row.driver_user_id : ''
    const completedAt = typeof row.completed_at === 'string' ? row.completed_at : ''
    if (!userId || !completedAt) return []
    return [
      {
        userId,
        completedAt,
        licenseClass: licenseClassFromEmbed(
          row.mvr_results as ResultEmbed | ResultEmbed[] | null,
        ),
      },
    ]
  })
}

async function provedDrivers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const proved = new Set<string>()
  if (userIds.length === 0) return proved

  const { data, error } = await supabase
    .from('attestations')
    .select('candidate_user_id, proof_artifact')
    .in('candidate_user_id', userIds)
    .eq('fact_type', 'cdl_class')
    .is('superseded_by', null)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (!isMidnightPredicateProof(row.proof_artifact)) continue
    const userId = typeof row.candidate_user_id === 'string' ? row.candidate_user_id : ''
    if (userId) proved.add(userId)
  }
  return proved
}

function activeCooldowns(cooldowns: Map<string, number>, now: number): Set<string> {
  const cooling = new Set<string>()
  for (const [userId, until] of cooldowns) {
    if (until > now) cooling.add(userId)
    else cooldowns.delete(userId)
  }
  return cooling
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Long-running loop. Fly keeps this process up next to the proof server.
 * Each pass proves one driver, then looks again. An empty pass waits.
 */
export async function runMvrProofWorker(signal: { stopping: boolean }): Promise<void> {
  const supabase = await getAdminSupabaseClient()
  const cooldowns = new Map<string, number>()
  let before: string | null = null

  console.log('[MVR PROOF WORKER] watching completed driver-owned MVRs')

  while (!signal.stopping) {
    const page = await loadPage(supabase, before)
    if (page.length === 0) {
      before = null
      await sleep(IDLE_MS)
      continue
    }

    const proved = await provedDrivers(
      supabase,
      page.map((order) => order.userId),
    )
    const userId = nextUnprovedDriver(page, proved, activeCooldowns(cooldowns, Date.now()))

    if (!userId) {
      const oldest = page.reduce(
        (min, order) => (order.completedAt < min ? order.completedAt : min),
        page[0].completedAt,
      )
      before = oldest !== before ? oldest : null
      if (!before) await sleep(IDLE_MS)
      continue
    }

    const label = userId.slice(0, 8)
    try {
      const result = await proveCompletedMvrFacts(userId)
      console.log(
        `[MVR PROOF WORKER] ${label} proved=${result.proven.join(',') || 'none'} skipped=${result.skipped.join(',') || 'none'}`,
      )
      if (result.proven.length === 0) cooldowns.set(userId, Date.now() + COOLDOWN_MS)
    } catch (err) {
      console.warn(
        `[MVR PROOF WORKER] ${label} failed:`,
        err instanceof Error ? err.message : err,
      )
      cooldowns.set(userId, Date.now() + COOLDOWN_MS)
    }
  }
}
