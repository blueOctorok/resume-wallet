import type { SupabaseClient } from '@supabase/supabase-js'
import { BLOCK_DEFINITIONS, getBlockDefinition } from '@/lib/block-registry'
import { ensureHubBlockInstalled as insertHubBlockIfMissing } from '@/lib/block-data'

/**
 * Install a candidate hub block after an employer action (order, request, invite,
 * webhook). Also installs `employerActionCompanionBlocks` from the registry
 * (e.g. screening consent → MVR + PSP tiles).
 *
 * Full CRA report data stays company-private when `ordered_by_company_id` is set;
 * the hub tile is for status-only visibility.
 */
export async function ensureHubBlockInstalled(
  supabase: SupabaseClient,
  userId: string,
  blockType: string,
): Promise<void> {
  if (!getBlockDefinition(blockType)) return

  await insertHubBlockIfMissing(supabase, userId, blockType)

  const companions = getBlockDefinition(blockType)?.employerActionCompanionBlocks
  if (!companions?.length) return

  for (const companion of companions) {
    if (getBlockDefinition(companion)) {
      await insertHubBlockIfMissing(supabase, userId, companion)
    }
  }
}

/**
 * PSP+MVR Accio bundle creates **two** order rows. Ensure both hub tiles exist
 * so My Files / career card sections match the orders.
 */
export async function ensureHubBlocksForPspMvrBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await insertHubBlockIfMissing(supabase, userId, 'driver-mvr')
  await insertHubBlockIfMissing(supabase, userId, 'driver-psp')
}

/**
 * Heal missing hub tiles when employer-initiated work already exists:
 * 1. Registry `employerOrderEvidenceTable` (mvr_orders → driver-mvr, etc.)
 * 2. `candidate_requests.target_block_type` (any employer-requestable block)
 * 3. `application_invites.target_block_type` claimed by this user
 *
 * Future CRA products: set `employerOrderEvidenceTable` on the BlockDefinition
 * and call `ensureHubBlockInstalled` on the order route — hub GET picks up the rest.
 */
export async function ensureHubBlocksForEmployerInitiatedActions(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const toInstall = new Set<string>()

  for (const def of BLOCK_DEFINITIONS) {
    if (!def.employerOrderEvidenceTable) continue
    const { count } = await supabase
      .from(def.employerOrderEvidenceTable)
      .select('id', { count: 'exact', head: true })
      .eq('driver_user_id', userId)
    if ((count ?? 0) > 0) toInstall.add(def.id)
  }

  const [{ data: requests }, { data: invites }] = await Promise.all([
    supabase
      .from('candidate_requests')
      .select('target_block_type')
      .eq('candidate_user_id', userId)
      .not('target_block_type', 'is', null),
    supabase
      .from('application_invites')
      .select('target_block_type')
      .eq('used_by_user_id', userId)
      .not('target_block_type', 'is', null),
  ])

  for (const row of requests ?? []) {
    if (typeof row.target_block_type === 'string') toInstall.add(row.target_block_type)
  }
  for (const row of invites ?? []) {
    if (typeof row.target_block_type === 'string') toInstall.add(row.target_block_type)
  }

  for (const blockType of toInstall) {
    await ensureHubBlockInstalled(supabase, userId, blockType)
  }
}

/** @deprecated Use ensureHubBlocksForEmployerInitiatedActions */
export async function ensureHubBlocksForExistingScreeningOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await ensureHubBlocksForEmployerInitiatedActions(supabase, userId)
}
