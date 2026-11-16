import type { SupabaseClient } from '@supabase/supabase-js'
import { isMidnightPredicateProof } from '@/lib/card-fact-display'
import { factsStillOpen, nextUnprovedDriver, type ProofQueueOrder } from '@/lib/mvr-proof-queue'
import { MVR_CARD_FACTS, proveCompletedMvrFacts, type MvrFactProveResult } from '@/lib/prove-mvr-facts'
import type { ShippedFactType } from '@/lib/fact-registry'
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

function isCardFact(value: string): value is ShippedFactType {
  return (MVR_CARD_FACTS as readonly string[]).includes(value)
}

async function provedFacts(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Set<ShippedFactType>>> {
  const proved = new Map<string, Set<ShippedFactType>>()
  if (userIds.length === 0) return proved

  const { data, error } = await supabase
    .from('attestations')
    .select('candidate_user_id, fact_type, proof_artifact')
    .in('candidate_user_id', userIds)
    .in('fact_type', [...MVR_CARD_FACTS])
    .is('superseded_by', null)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (!isMidnightPredicateProof(row.proof_artifact)) continue
    const userId = typeof row.candidate_user_id === 'string' ? row.candidate_user_id : ''
    const factType = typeof row.fact_type === 'string' ? row.fact_type : ''
    if (!userId || !isCardFact(factType)) continue
    const facts = proved.get(userId) ?? new Set<ShippedFactType>()
    facts.add(factType)
    proved.set(userId, facts)
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
function doneDrivers(
  page: ProofQueueOrder[],
  proved: Map<string, Set<ShippedFactType>>,
  permanentSkips: Map<string, Set<ShippedFactType>>,
): Set<string> {
  const done = new Set<string>()
  for (const order of page) {
    const have = proved.get(order.userId) ?? new Set<string>()
    const skips = permanentSkips.get(order.userId) ?? new Set<string>()
    // A driver with no proofs and no skips still has work. One with every
    // fact either proved or permanently skipped does not.
    if (have.size === 0 && skips.size === 0) continue
    if (factsStillOpen(MVR_CARD_FACTS, have, skips).length === 0) done.add(order.userId)
  }
  return done
}

export async function runMvrProofWorker(
  signal: { stopping: boolean },
  proveDriver: (
    userId: string,
    alreadySettled: readonly ShippedFactType[],
  ) => Promise<MvrFactProveResult> = (userId, alreadySettled) =>
    proveCompletedMvrFacts(userId, { alreadySettled }),
): Promise<void> {
  const supabase = await getAdminSupabaseClient()
  const cooldowns = new Map<string, number>()
  const permanentSkips = new Map<string, Set<ShippedFactType>>()
  let before: string | null = null

  console.log('[MVR PROOF WORKER] watching completed driver-owned MVRs')

  while (!signal.stopping) {
    const page = await loadPage(supabase, before)
    if (page.length === 0) {
      before = null
      await sleep(IDLE_MS)
      continue
    }

    const proved = await provedFacts(
      supabase,
      page.map((order) => order.userId),
    )
    const userId = nextUnprovedDriver(
      page,
      doneDrivers(page, proved, permanentSkips),
      activeCooldowns(cooldowns, Date.now()),
    )

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
    const have = proved.get(userId) ?? new Set<ShippedFactType>()
    const skips = permanentSkips.get(userId) ?? new Set<ShippedFactType>()
    try {
      const result = await proveDriver(userId, [...have, ...skips])
      console.log(
        `[MVR PROOF WORKER] ${label} proved=${result.proven.join(',') || 'none'} skipped=${result.skipped.join(',') || 'none'} failed=${result.failed.join(',') || 'none'}`,
      )
      for (const fact of result.skipped) skips.add(fact)
      permanentSkips.set(userId, skips)
      if (result.failed.length > 0) cooldowns.set(userId, Date.now() + COOLDOWN_MS)
    } catch (err) {
      console.warn(
        `[MVR PROOF WORKER] ${label} failed:`,
        err instanceof Error ? err.message : err,
      )
      cooldowns.set(userId, Date.now() + COOLDOWN_MS)
    }
  }
}
