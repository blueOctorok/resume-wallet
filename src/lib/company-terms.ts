import type { SupabaseClient } from '@supabase/supabase-js'
import { EV_EMPLOYER_TERMS_VERSION } from '@/lib/ev-consent-documents'

/** True when the company has accepted the current employer-terms version. */
export async function companyHasCurrentEmployerTerms(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('company_terms_acceptances')
    .select('id')
    .eq('company_id', companyId)
    .eq('document_version', EV_EMPLOYER_TERMS_VERSION)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[COMPANY TERMS] Lookup failed:', error.message)
    return false
  }
  return Boolean(data)
}
