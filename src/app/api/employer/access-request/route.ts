import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/employer/access-request
 * 
 * Submit a request to set up a company on StormChain.
 * This is for company owners/admins who want to onboard their company.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { name, companyName, description, email } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Your name is required' },
        { status: 400 }
      )
    }

    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: 'Please describe your role and authorization' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Check if user already has employer access
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (existingUser?.role === 'employer') {
      return NextResponse.json(
        { error: 'You already have employer access' },
        { status: 409 }
      )
    }

    // Check if user already owns a company
    if (existingUser) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, company_name')
        .eq('employer_user_id', existingUser.id)
        .maybeSingle()

      if (existingCompany) {
        return NextResponse.json(
          { error: `You already own ${existingCompany.company_name}` },
          { status: 409 }
        )
      }

      // Check if user is already a member of a company
      const { data: existingMembership } = await supabase
        .from('company_members')
        .select('id, company_id')
        .eq('user_id', existingUser.id)
        .eq('is_active', true)
        .maybeSingle()

      if (existingMembership) {
        return NextResponse.json(
          { error: 'You are already a member of a company' },
          { status: 409 }
        )
      }
    }

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from('employer_access_requests')
      .select('id, status, created_at')
      .ilike('wallet_address', walletAddress)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        { 
          error: 'You already have a pending request',
          details: 'Your request is being reviewed. You will be notified when it is processed.'
        },
        { status: 409 }
      )
    }

    // Create the access request
    const { data: newRequest, error: insertError } = await supabase
      .from('employer_access_requests')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        email: email?.toLowerCase() || null,
        name: name.trim(),
        company_name: companyName.trim(),
        description: description.trim(),
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[ACCESS REQUEST] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit request' },
        { status: 500 }
      )
    }

    console.log(`[ACCESS REQUEST] New request: ${name} for ${companyName} (${walletAddress})`)

    return NextResponse.json({
      success: true,
      message: 'Your request has been submitted and is pending review.',
      request: {
        id: newRequest.id,
        companyName: newRequest.company_name,
        status: newRequest.status,
      }
    })

  } catch (error) {
    console.error('[ACCESS REQUEST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employer/access-request
 * 
 * Check if current user has a pending request.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: pendingRequest } = await supabase
      .from('employer_access_requests')
      .select('id, company_name, status, created_at')
      .ilike('wallet_address', walletAddress)
      .eq('status', 'pending')
      .maybeSingle()

    return NextResponse.json({
      success: true,
      hasPendingRequest: !!pendingRequest,
      request: pendingRequest,
    })

  } catch (error) {
    console.error('[ACCESS REQUEST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
