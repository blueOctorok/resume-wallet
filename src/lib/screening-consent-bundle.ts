import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScreeningConsentBundleRow {
  id: string
  driver_user_id: string
  company_id: string
  status: string
  completed_at: string | null
  created_at: string
  bgcheck_consent_id: string | null
  psp_consent_id: string | null
  cdlis_signed_at: string | null
}

/** True when `psp_consents.form_data.cdlisWrittenConsent` has the minimum fields. */
export function hasCdlisWrittenConsent(formData: Record<string, unknown> | null | undefined): boolean {
  const c = formData?.cdlisWrittenConsent as Record<string, unknown> | undefined
  if (!c || typeof c !== 'object') return false
  return Boolean(
    String(c.typedSignature ?? '').trim() &&
      String(c.printFirstName ?? '').trim() &&
      String(c.printLastName ?? '').trim() &&
      String(c.consentDateIso ?? '').trim(),
  )
}

export async function getLatestScreeningConsentBundle(
  supabase: SupabaseClient,
  driverUserId: string,
  companyId: string,
): Promise<ScreeningConsentBundleRow | null> {
  const { data } = await supabase
    .from('screening_consent_bundles')
    .select(
      'id, driver_user_id, company_id, status, completed_at, created_at, bgcheck_consent_id, psp_consent_id, cdlis_signed_at',
    )
    .eq('driver_user_id', driverUserId)
    .eq('company_id', companyId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return (data as ScreeningConsentBundleRow | null) ?? null
}
