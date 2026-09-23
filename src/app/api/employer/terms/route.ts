import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { can } from '@/lib/employer-permissions'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import { companyHasCurrentEmployerTerms } from '@/lib/company-terms'
import { getRequestMeta, hashEvDocument } from '@/lib/ev-share'

/**
 * GET /api/employer/terms — whether this company still owes the current
 * Employment Verification schedule.
 * POST — owner/admin records acceptance. One row covers the organization.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ required: false, accepted: true, canAccept: false })
    }

    const accepted = await companyHasCurrentEmployerTerms(supabase, access.companyId)
    return NextResponse.json({
      required: !accepted,
      accepted,
      canAccept: can(access.companyRole, 'manageCompany'),
      version: EV_EMPLOYER_TERMS.version,
      title: EV_EMPLOYER_TERMS.title,
      sections: EV_EMPLOYER_TERMS.sections,
      checkboxLabel: EV_EMPLOYER_TERMS.checkboxLabel,
    })
  } catch (error) {
    console.error('[EMPLOYER TERMS] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    if (body.accepted !== true) {
      return NextResponse.json({ error: 'Terms must be accepted' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access || !can(access.companyRole, 'manageCompany')) {
      return NextResponse.json(
        { error: 'Only an owner or admin can accept terms for the company' },
        { status: 403 },
      )
    }

    if (await companyHasCurrentEmployerTerms(supabase, access.companyId)) {
      return NextResponse.json({ success: true, alreadyAccepted: true })
    }

    const { data: user } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
    const meta = getRequestMeta(request)
    const { error } = await supabase.from('company_terms_acceptances').insert({
      company_id: access.companyId,
      accepted_by_user_id: userId,
      accepted_email: user?.email ?? null,
      document_version: EV_EMPLOYER_TERMS.version,
      document_sha256: hashEvDocument(EV_EMPLOYER_TERMS),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    })

    if (error) {
      console.error('[EMPLOYER TERMS] Insert failed:', error)
      return NextResponse.json({ error: 'Could not record acceptance' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EMPLOYER TERMS] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
