/**
 * Load a driver's DOT application for whoever is asking — the driver, or an
 * employer whose company is allowed to see it.
 *
 * The JSON preview route and the PDF export route both need the exact same
 * decisions (who may read, which copy they get, log the view, stamp the company),
 * so they live here once. A projection that forgot the redaction step would be
 * an SSN leak, which is why this is one function and not two routes agreeing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { companyCanViewDotApplication, getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { releasesDriverIdentifiers } from '@/lib/company-account-tier'
import { projectDotAppForEmployer } from '@/lib/redact-dot-app'

type Json = Record<string, unknown>

export interface DotAppForViewer {
  id: string
  isComplete: boolean
  currentStep: number | null
  createdAt: string
  updatedAt: string
  form1: Json | null
  form2: Json | null
  form3: Json | null
  redactedFields: readonly string[]
  /** Company this copy is addressed to. Null on the driver's own copy. */
  addressedToCompany: string | null
}

export type DotAppLoadResult =
  | { ok: true; app: DotAppForViewer; isSelf: boolean }
  | { ok: false; status: 403 | 404 | 500; error: string; requestRequired?: true }

export async function loadDotAppForViewer(
  supabase: SupabaseClient,
  requesterUserId: string,
  candidateUserId: string,
  applicationId: string | null,
): Promise<DotAppLoadResult> {
  const isSelf = requesterUserId === candidateUserId
  const companyAccess = isSelf ? null : await getEmployerCompanyAccess(supabase, requesterUserId)

  if (!isSelf && !companyAccess) {
    return { ok: false, status: 403, error: 'Access denied' }
  }

  // Career card is open. The full file is not, unless this company is an
  // agency or this driver already accepted their request to see it.
  if (companyAccess) {
    const allowed = await companyCanViewDotApplication(supabase, companyAccess.companyId, candidateUserId)
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: 'Request this driver qualification file before opening it.',
        requestRequired: true,
      }
    }
  }

  let appQuery = supabase
    .from('driver_applications')
    .select('id, is_complete, current_step, application_data, created_at, updated_at')
    .eq('user_id', candidateUserId)

  appQuery = applicationId
    ? appQuery.eq('id', applicationId)
    : appQuery.order('created_at', { ascending: false }).limit(1)

  const { data: app, error } = await appQuery.maybeSingle()

  if (error) {
    console.error('[DOT APP LOAD] Query error:', error)
    return { ok: false, status: 500, error: 'Failed to fetch DOT application' }
  }
  if (!app) {
    return { ok: false, status: 404, error: 'No DOT application found' }
  }

  const appData = (app.application_data ?? {}) as Json
  const base = {
    id: app.id as string,
    isComplete: Boolean(app.is_complete),
    currentStep: (app.current_step as number | null) ?? null,
    createdAt: app.created_at as string,
    updatedAt: app.updated_at as string,
  }

  if (isSelf) {
    return {
      ok: true,
      isSelf,
      app: {
        ...base,
        form1: (appData.form1 as Json) ?? null,
        form2: (appData.form2 as Json) ?? null,
        form3: (appData.form3 as Json) ?? null,
        redactedFields: [],
        addressedToCompany: null,
      },
    }
  }

  // Log the view so the driver can see which carriers opened their DQ file.
  // This is a candidate-ownership feature, not just an audit control — so a
  // failure to log must not silently hide the access; it's logged loudly and
  // the read still proceeds (mirrors talent/[userId]).
  const { error: viewLogError } = await supabase.from('career_card_views').insert({
    candidate_user_id: candidateUserId,
    viewer_user_id: companyAccess!.employerUserId,
    source: 'dot_app',
  })
  if (viewLogError) {
    console.error('[DOT APP LOAD] View log failed:', viewLogError)
  }

  // The application itself has no company. This copy is addressed to whoever
  // is reading it, so two carriers never share one stamped name.
  const { data: company } = await supabase
    .from('companies')
    .select('company_name')
    .eq('id', companyAccess!.companyId)
    .maybeSingle()

  return {
    ok: true,
    isSelf,
    app: {
      ...base,
      ...projectDotAppForEmployer(
        appData,
        releasesDriverIdentifiers(companyAccess!.accountTier),
      ),
      addressedToCompany: company?.company_name?.trim() || null,
    },
  }
}
