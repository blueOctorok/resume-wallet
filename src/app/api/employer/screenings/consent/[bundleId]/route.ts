import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'

export const dynamic = 'force-dynamic'

/** Remove SSN from any form payload before it leaves the server. */
function stripSsnFromFormData(formData: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!formData || typeof formData !== 'object') return {}
  const { ssn: _omit, ...rest } = formData
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value == null) continue
    out[key] = typeof value === 'string' ? value : String(value)
  }
  return out
}

/**
 * GET /api/employer/screenings/consent/[bundleId]
 *
 * Returns the signed FCRA + FMCSA PSP + CDLIS consent package for employer review.
 * Company-scoped: bundle must belong to the caller's company. Writes consent_access_log.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> },
) {
  try {
    const { bundleId } = await params

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: authUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', userId)
      .maybeSingle()

    if (!authUser?.wallet_address) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const ctx = await resolveEmployerCompanyForWallet(supabase, authUser.wallet_address)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const { data: bundle, error: bundleError } = await supabase
      .from('screening_consent_bundles')
      .select(
        'id, status, completed_at, created_at, driver_user_id, company_id, bgcheck_consent_id, psp_consent_id, cdlis_signed_name, cdlis_signed_at, cdlis_form_data',
      )
      .eq('id', bundleId)
      .maybeSingle()

    if (bundleError || !bundle) {
      return NextResponse.json({ error: 'Consent package not found' }, { status: 404 })
    }

    if (bundle.company_id !== ctx.companyId) {
      return NextResponse.json({ error: 'Consent package not found' }, { status: 404 })
    }

    const driverUserId = bundle.driver_user_id as string
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', driverUserId)
      .maybeSingle()

    const candidateName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || null

    let fcra: {
      signedName: string
      signedAt: string
      companyName: string
      formData: Record<string, string>
    } | null = null

    if (bundle.bgcheck_consent_id) {
      const { data: bg } = await supabase
        .from('bgcheck_consents')
        .select('signed_name, signed_at, company_name, form_data')
        .eq('id', bundle.bgcheck_consent_id as string)
        .maybeSingle()

      if (bg) {
        fcra = {
          signedName: (bg.signed_name as string) ?? '',
          signedAt: (bg.signed_at as string) ?? '',
          companyName: (bg.company_name as string) || 'Unknown Company',
          formData: stripSsnFromFormData(bg.form_data as Record<string, unknown>),
        }
      }
    }

    let psp: {
      signedName: string
      signedAt: string
      companyName: string
      formData: Record<string, string>
      formVersion: string | null
    } | null = null

    if (bundle.psp_consent_id) {
      const { data: pspRow } = await supabase
        .from('psp_consents')
        .select('signed_name, signed_at, company_name, form_data, form_version')
        .eq('id', bundle.psp_consent_id as string)
        .maybeSingle()

      if (pspRow) {
        psp = {
          signedName: (pspRow.signed_name as string) ?? '',
          signedAt: (pspRow.signed_at as string) ?? '',
          companyName: (pspRow.company_name as string) || 'Unknown Company',
          formData: stripSsnFromFormData(pspRow.form_data as Record<string, unknown>),
          formVersion: (pspRow.form_version as string | null) ?? null,
        }
      }
    }

    const cdlisFormRaw = bundle.cdlis_form_data as Record<string, unknown> | null
    const cdlis =
      bundle.cdlis_signed_at || bundle.cdlis_signed_name || cdlisFormRaw
        ? {
            signedName: (bundle.cdlis_signed_name as string | null) ?? null,
            signedAt: (bundle.cdlis_signed_at as string | null) ?? null,
            formData: stripSsnFromFormData(cdlisFormRaw),
          }
        : null

    const { error: auditError } = await supabase.from('consent_access_log').insert({
      bundle_id: bundleId,
      company_id: ctx.companyId,
      viewer_user_id: userId,
    })

    if (auditError) {
      console.error('[EMPLOYER CONSENT VIEW] audit insert failed:', auditError.message)
    }

    return NextResponse.json({
      success: true,
      bundle: {
        id: bundle.id as string,
        status: bundle.status as string,
        completedAt: (bundle.completed_at as string | null) ?? null,
        createdAt: bundle.created_at as string,
        candidateName,
      },
      fcra,
      psp,
      cdlis,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMPLOYER CONSENT VIEW]', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
