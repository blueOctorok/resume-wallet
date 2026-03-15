import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/employer/company
 *
 * Called once by the company owner during Motor Carrier onboarding.
 * Creates the company record + owner membership, then marks onboarding complete.
 *
 * If the company was pre-created by an admin (onboarding_completed = false),
 * this updates the existing record instead of inserting a new one.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      companyName,
      dotNumber,
      mcNumber,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
      phone,
      email,
      hiringCategories,
    } = body

    if (!companyName || !addressStreet || !addressCity || !addressState || !addressZip || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve or create user by wallet address (first-time employer may not have a row yet)
    let user: { id: string; email: string | null } | null = null
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (userError) {
      console.error('[EMPLOYER COMPANY SETUP] User lookup error:', userError)
      return NextResponse.json(
        { error: userError.message || 'Failed to look up user' },
        { status: 500 }
      )
    }

    if (existingUser) {
      user = existingUser
    } else {
      // Create user so the employer can complete onboarding (e.g. first login before other APIs created them)
      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress.toLowerCase().trim(),
          email: email || null,
          role: 'employer',
        })
        .select('id, email')
        .single()

      if (createErr || !newUser) {
        console.error('[EMPLOYER COMPANY SETUP] Create user error:', createErr)
        return NextResponse.json(
          { error: createErr?.message || 'Failed to create user account' },
          { status: 500 }
        )
      }
      user = newUser
    }

    // Check for a pre-created company (admin set up a company with designated_owner_email)
    const { data: existingByEmail } = await supabase
      .from('companies')
      .select('id, onboarding_completed')
      .ilike('designated_owner_email', user.email ?? '')
      .maybeSingle()

    // Also check legacy employer_user_id ownership
    const { data: existingByUserId } = await supabase
      .from('companies')
      .select('id, onboarding_completed')
      .eq('employer_user_id', user.id)
      .maybeSingle()

    const existingCompany = existingByEmail ?? existingByUserId

    const companyFields = {
      company_name: companyName,
      dot_number: dotNumber || null,
      mc_number: mcNumber || null,
      address_street: addressStreet,
      address_city: addressCity,
      address_state: addressState,
      address_zip: addressZip,
      phone,
      email,
      hiring_categories: Array.isArray(hiringCategories) ? hiringCategories : [],
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }

    let companyId: string

    if (existingCompany) {
      // Update the pre-created company record
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyFields)
        .eq('id', existingCompany.id)

      if (updateError) {
        console.error('[EMPLOYER COMPANY SETUP] Update company error:', updateError)
        return NextResponse.json(
          { error: updateError.message || 'Failed to update company' },
          { status: 500 }
        )
      }
      companyId = existingCompany.id
    } else {
      // Create a brand new company record
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          ...companyFields,
          employer_user_id: user.id,
        })
        .select('id')
        .single()

      if (insertError || !newCompany) {
        console.error('[EMPLOYER COMPANY SETUP] Insert company error:', insertError)
        return NextResponse.json(
          { error: insertError?.message || 'Failed to create company' },
          { status: 500 }
        )
      }
      companyId = newCompany.id
    }

    // Ensure the owner has a company_members row (upsert = insert or update if conflict).
    const { error: memberError } = await supabase
      .from('company_members')
      .upsert(
        {
          company_id: companyId,
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

    return NextResponse.json({ success: true, companyId })
  } catch (error) {
    console.error('[EMPLOYER COMPANY SETUP] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
