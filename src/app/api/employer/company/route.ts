import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/employer/company
 *
 * Completes onboarding for a company a Provven admin already created. The owner
 * fills in address/phone/contact details; the company row itself must already
 * exist with them as `designated_owner_email` or `employer_user_id`.
 *
 * This route used to be a second self-serve signup door: it ran the same AI
 * plausibility eval as the deleted access-request route, auto-joined the caller
 * to any company whose name fuzzy-matched when their email domain looked close
 * enough, created brand-new companies, and queued flagged access requests. All
 * of that is gone. Employer accounts originate from /api/admin/companies only,
 * and the role is granted by resolveEmployerLink from the verified session email.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      companyName,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
      phone,
      email,
    } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!companyName || !addressStreet || !addressCity || !addressState || !addressZip || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // The company must already exist and belong to this user — either claimed
    // already, or pre-created by an admin who named them designated owner.
    // Matching on the users table email (which mirrors the verified auth email),
    // never an address typed into this form.
    const { data: ownedCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .maybeSingle()

    const { data: preCreatedCompany } = user.email
      ? await supabase
          .from('companies')
          .select('id')
          .ilike('designated_owner_email', user.email)
          .is('employer_user_id', null)
          .maybeSingle()
      : { data: null }

    const company = ownedCompany ?? preCreatedCompany

    if (!company) {
      console.warn(`[EMPLOYER COMPANY SETUP] No company for user ${user.id} — rejecting setup`)
      return NextResponse.json(
        {
          error: 'No company is associated with this account',
          details:
            'Employer accounts are set up by Provven. Contact us if you expected access to a company here.',
        },
        { status: 403 }
      )
    }

    const { error: updateError } = await supabase
      .from('companies')
      .update({
        company_name: companyName.trim(),
        address_street: addressStreet,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
        phone,
        email,
        employer_user_id: user.id,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id)

    if (updateError) {
      console.error('[EMPLOYER COMPANY SETUP] Update company error:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update company' },
        { status: 500 }
      )
    }

    await supabase.from('user_profiles').upsert(
      {
        user_id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        email: email || undefined,
        phone: phone || undefined,
      },
      { onConflict: 'user_id' }
    )

    const { error: memberError } = await supabase.from('company_members').upsert(
      {
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        is_active: true,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' }
    )

    if (memberError) {
      console.error('[EMPLOYER COMPANY SETUP] Company member upsert error:', memberError)
      return NextResponse.json(
        { error: memberError.message || 'Failed to link owner to company' },
        { status: 500 }
      )
    }

    console.log(`[EMPLOYER COMPANY SETUP] User ${user.id} completed onboarding for company ${company.id}`)

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (error) {
    console.error('[EMPLOYER COMPANY SETUP] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
