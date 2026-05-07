import type { SupabaseClient } from '@supabase/supabase-js'

export type EmployerBlockAuditAction = 'installed' | 'removed'
export type EmployerBlockActorKind = 'storm_admin' | 'company_owner' | 'company_admin'

export async function logEmployerBlockAudit(
  supabase: SupabaseClient,
  params: {
    companyId: string
    blockType: string
    action: EmployerBlockAuditAction
    actorUserId: string | null
    actorKind: EmployerBlockActorKind
    reason?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('employer_block_audit').insert({
    company_id: params.companyId,
    block_type: params.blockType,
    action: params.action,
    actor_user_id: params.actorUserId,
    actor_kind: params.actorKind,
    reason: params.reason?.trim() || null,
  })
  if (error) {
    console.error('[EMPLOYER_BLOCK_AUDIT] insert failed:', error.message)
  }
}
