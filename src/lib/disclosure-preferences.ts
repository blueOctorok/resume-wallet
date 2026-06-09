import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttestationInput } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { listShippedFacts, type ShippedFactType } from '@/lib/fact-registry'

export interface DisclosureAudience {
  companyId: string
  companyName: string
}

export interface DisclosureFactPreference {
  factType: ShippedFactType
  label: string
  description: string
  allowed: boolean
}

export interface DisclosureAudiencePreferences {
  companyId: string
  companyName: string
  facts: DisclosureFactPreference[]
}

/**
 * Default posture: shareable unless a row exists with allowed=false.
 */
export async function isFactDisclosedToAudience(
  supabase: SupabaseClient,
  candidateUserId: string,
  audienceId: string,
  factType: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('disclosure_preferences')
    .select('allowed')
    .eq('candidate_user_id', candidateUserId)
    .eq('audience_id', audienceId)
    .eq('fact_type', factType)
    .maybeSingle()

  if (error) {
    throw new AttestationError(`Failed to load disclosure preference: ${error.message}`)
  }

  if (!data) return true
  return data.allowed === true
}

export async function loadDisclosureDenylistForAudience(
  supabase: SupabaseClient,
  candidateUserId: string,
  audienceId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('disclosure_preferences')
    .select('fact_type')
    .eq('candidate_user_id', candidateUserId)
    .eq('audience_id', audienceId)
    .eq('allowed', false)

  if (error) {
    throw new AttestationError(`Failed to load disclosure denylist: ${error.message}`)
  }

  return new Set((data ?? []).map((row) => String(row.fact_type)))
}

/** Refuse audience-scoped prove when the candidate toggled this fact off for that employer. */
export async function assertDisclosureAllowsProve(
  supabase: SupabaseClient,
  input: AttestationInput,
): Promise<void> {
  if (!input.audienceId) return

  const allowed = await isFactDisclosedToAudience(
    supabase,
    input.candidateUserId,
    input.audienceId,
    input.factType,
  )

  if (!allowed) {
    throw new AttestationError(
      `Fact "${input.factType}" is not shared with this employer`,
    )
  }
}

export async function listCandidateDisclosureAudiences(
  supabase: SupabaseClient,
  candidateUserId: string,
): Promise<DisclosureAudience[]> {
  const companyIds = new Set<string>()

  const [{ data: requests }, { data: invites }, { data: apps }, { data: bundles }] =
    await Promise.all([
      supabase
        .from('candidate_requests')
        .select('company_id')
        .eq('candidate_user_id', candidateUserId),
      supabase
        .from('application_invites')
        .select('company_id')
        .eq('candidate_user_id', candidateUserId),
      supabase
        .from('applications')
        .select('job_posting:job_postings(company_id)')
        .eq('applicant_user_id', candidateUserId),
      supabase
        .from('screening_consent_bundles')
        .select('company_id')
        .eq('driver_user_id', candidateUserId),
    ])

  for (const row of requests ?? []) {
    if (row.company_id) companyIds.add(String(row.company_id))
  }
  for (const row of invites ?? []) {
    if (row.company_id) companyIds.add(String(row.company_id))
  }
  for (const row of bundles ?? []) {
    if (row.company_id) companyIds.add(String(row.company_id))
  }
  for (const row of apps ?? []) {
    const posting = row.job_posting as { company_id?: string } | null
    if (posting?.company_id) companyIds.add(String(posting.company_id))
  }

  if (companyIds.size === 0) return []

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, company_name')
    .in('id', [...companyIds])

  if (error) {
    throw new AttestationError(`Failed to load disclosure audiences: ${error.message}`)
  }

  return (companies ?? [])
    .map((c) => ({
      companyId: String(c.id),
      companyName: String(c.company_name ?? 'Employer'),
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName))
}

export async function buildDisclosurePreferencesPayload(
  supabase: SupabaseClient,
  candidateUserId: string,
): Promise<DisclosureAudiencePreferences[]> {
  const audiences = await listCandidateDisclosureAudiences(supabase, candidateUserId)
  const shipped = listShippedFacts()

  if (audiences.length === 0) return []

  const audienceIds = audiences.map((a) => a.companyId)
  const { data: prefRows, error } = await supabase
    .from('disclosure_preferences')
    .select('audience_id, fact_type, allowed')
    .eq('candidate_user_id', candidateUserId)
    .in('audience_id', audienceIds)

  if (error) {
    throw new AttestationError(`Failed to load disclosure preferences: ${error.message}`)
  }

  const prefMap = new Map<string, boolean>()
  for (const row of prefRows ?? []) {
    prefMap.set(`${row.audience_id}:${row.fact_type}`, row.allowed === true)
  }

  return audiences.map((audience) => ({
    companyId: audience.companyId,
    companyName: audience.companyName,
    facts: shipped.map((def) => {
      const key = `${audience.companyId}:${def.factType}`
      const stored = prefMap.get(key)
      return {
        factType: def.factType,
        label: def.label,
        description: def.description,
        allowed: stored === undefined ? true : stored,
      }
    }),
  }))
}

export async function setDisclosurePreference(
  supabase: SupabaseClient,
  candidateUserId: string,
  audienceId: string,
  factType: ShippedFactType,
  allowed: boolean,
): Promise<void> {
  if (allowed) {
    const { error } = await supabase
      .from('disclosure_preferences')
      .delete()
      .eq('candidate_user_id', candidateUserId)
      .eq('audience_id', audienceId)
      .eq('fact_type', factType)

    if (error) {
      throw new AttestationError(`Failed to clear disclosure preference: ${error.message}`)
    }
    return
  }

  const { error } = await supabase.from('disclosure_preferences').upsert(
    {
      candidate_user_id: candidateUserId,
      audience_id: audienceId,
      fact_type: factType,
      allowed: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'candidate_user_id,audience_id,fact_type' },
  )

  if (error) {
    throw new AttestationError(`Failed to save disclosure preference: ${error.message}`)
  }
}
