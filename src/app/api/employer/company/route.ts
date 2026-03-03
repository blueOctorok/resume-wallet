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
    } = body

    if (!companyName || !dotNumber || !addressStreet || !addressCity || !addressState || !addressZip || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve the user by wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
      dot_number: dotNumber,
      mc_number: mcNumber || null,
      address_street: addressStreet,
      address_city: addressCity,
      address_state: addressState,
      address_zip: addressZip,
      phone,
      email,
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

      if (updateError) throw updateError
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

      if (insertError || !newCompany) throw insertError ?? new Error('Failed to create company')
      companyId = newCompany.id
    }

    // Ensure the owner has a company_members row.
    // upsert so this is idempotent (safe to call more than once).
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

    if (memberError) throw memberError

    return NextResponse.json({ success: true, companyId })
  } catch (error) {
    console.error('[EMPLOYER COMPANY SETUP] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
