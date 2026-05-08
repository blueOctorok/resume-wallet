import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockDefinition } from '@/lib/block-registry'

const BUNDLE_HUB_BLOCKS = ['driver-mvr', 'driver-psp'] as const

/**
 * PSP+MVR Accio bundle creates **two** order rows (`mvr_orders` + `psp_orders`). The hub career
 * card and construct “My Files” only render blocks present in `hub_blocks`. Employer PSP
 * requests historically auto-installed only `driver-psp`, so candidates saw PSP but not MVR
 * even though an MVR order existed. After any successful bundle placement (or PSP consent
 * pipeline request), ensure both blocks exist.
 */
export async function ensureHubBlocksForPspMvrBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const blockType of BUNDLE_HUB_BLOCKS) {
    if (!getBlockDefinition(blockType)) continue

    const { data: existing } = await supabase
      .from('hub_blocks')
      .select('id')
      .eq('user_id', userId)
      .eq('block_type', blockType)
      .maybeSingle()

    if (existing) continue

    const { data: maxPos } = await supabase
      .from('hub_blocks')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('hub_blocks').insert({
      user_id: userId,
      block_type: blockType,
      position: (maxPos?.position ?? -1) + 1,
    })

    if (error) {
      console.error(`[PSP+MVR BUNDLE] hub_blocks install ${blockType}:`, error.message)
    } else {
      console.log(`[PSP+MVR BUNDLE] hub_blocks installed ${blockType} for user ${userId}`)
    }
  }
}
