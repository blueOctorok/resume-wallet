import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { evaluateEmployerRequest } from '@/lib/ava-employer-eval'

/**
 * POST /api/employer/access-request
 *
 * Submit a request to set up a company on StormChain.
 * AvA evaluates the request in real-time:
 *   - approve  → company + owner created instantly
 *   - flag     → stored for human review
 *   - block    → denied with explanation
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { name, companyName, description, email } = body

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
    }
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Please describe your role and authorization' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // ── Conflict checks ─────────────────────────────────────────
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (existingUser?.role === 'employer') {
      return NextResponse.json({ error: 'You already have employer access' }, { status: 409 })
    }

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

      const { data: existingMembership } = await supabase
        .from('company_members')
        .select('id')
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

    // Also block if they have any pending/flagged request already
    const { data: existingRequest } = await supabase
      .from('employer_access_requests')
      .select('id, status')
      .ilike('wallet_address', walletAddress)
      .in('status', ['pending', 'flagged'])
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'You already have a pending request',
          details: 'Your request is being reviewed. You will be notified when it is processed.',
        },
        { status: 409 }
      )
    }

    // ── AvA evaluation ──────────────────────────────────────────
    const emailDomain = email ? email.split('@')[1]?.toLowerCase() ?? null : null

    // Fetch existing company names so AvA can detect duplicates
    const { data: companies } = await supabase
      .from('companies')
      .select('company_name')
      .limit(200)

    const existingCompanyNames = (companies ?? []).map(c => c.company_name).filter(Boolean)

    const evalResult = await evaluateEmployerRequest(
      {
        requesterName: name.trim(),
        companyName: companyName.trim(),
        description: description.trim(),
        emailDomain,
      },
      existingCompanyNames
    )

    console.log(`[ACCESS REQUEST] AvA verdict for "${companyName}": ${evalResult.decision} (${evalResult.confidence}) — ${evalResult.reason}`)

    // ── Handle: BLOCK ───────────────────────────────────────────
    if (evalResult.decision === 'block') {
      await supabase.from('employer_access_requests').insert({
        wallet_address: walletAddress.toLowerCase(),
        email: email?.toLowerCase() || null,
        name: name.trim(),
        company_name: companyName.trim(),
        description: description.trim(),
        status: 'blocked',
        ai_decision: evalResult.decision,
        ai_reason: evalResult.reason,
        ai_confidence: evalResult.confidence,
      })

      return NextResponse.json({
        success: false,
        blocked: true,
        message: evalResult.reason,
      })
    }

    // ── Handle: FLAG ────────────────────────────────────────────
    if (evalResult.decision === 'flag') {
      const { data: flaggedReq } = await supabase
        .from('employer_access_requests')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          email: email?.toLowerCase() || null,
          name: name.trim(),
          company_name: companyName.trim(),
          description: description.trim(),
          status: 'flagged',
          ai_decision: evalResult.decision,
          ai_reason: evalResult.reason,
          ai_confidence: evalResult.confidence,
        })
        .select()
        .single()

      console.log(`[ACCESS REQUEST] Flagged for review: ${name} for ${companyName}`)

      return NextResponse.json({
        success: true,
        message: 'Your request has been submitted and is under review.',
        request: {
          id: flaggedReq?.id,
          companyName: companyName.trim(),
          status: 'flagged',
        },
      })
    }

    // ── Handle: APPROVE ─────────────────────────────────────────
    // Same logic as admin approval — create user/company/membership

    // 1. Get or create user
    let userId: string
    if (existingUser) {
      await supabase
        .from('users')
        .update({ role: 'employer', name: name.trim(), email: email?.toLowerCase() || undefined })
        .eq('id', existingUser.id)
      userId = existingUser.id
    } else {
      const { data: newUser, error: createUserErr } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          email: email?.toLowerCase() || null,
          name: name.trim(),
          role: 'employer',
        })
        .select('id')
        .single()

      if (createUserErr || !newUser) {
        console.error('[ACCESS REQUEST] Create user error:', createUserErr)
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
      }
      userId = newUser.id
    }

    // 2. Create company
    const { data: newCompany, error: companyErr } = await supabase
      .from('companies')
      .insert({
        company_name: companyName.trim(),
        employer_user_id: userId,
        designated_owner_email: email?.toLowerCase() || null,
        status: 'active',
        approved_at: new Date().toISOString(),
        onboarding_completed: false,
      })
      .select('id')
      .single()

    if (companyErr || !newCompany) {
      console.error('[ACCESS REQUEST] Create company error:', companyErr)
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
    }

    // 3. Add owner to company_members
    await supabase.from('company_members').insert({
      company_id: newCompany.id,
      user_id: userId,
      role: 'owner',
      invite_email: email?.toLowerCase() || null,
      accepted_at: new Date().toISOString(),
      is_active: true,
    })

    // 4. Audit trail
    await supabase.from('employer_access_requests').insert({
      wallet_address: walletAddress.toLowerCase(),
      email: email?.toLowerCase() || null,
      name: name.trim(),
      company_name: companyName.trim(),
      description: description.trim(),
      status: 'auto_approved',
      reviewed_at: new Date().toISOString(),
      ai_decision: evalResult.decision,
      ai_reason: evalResult.reason,
      ai_confidence: evalResult.confidence,
    })

    console.log(`[ACCESS REQUEST] Auto-approved: ${companyName} -> Company ID: ${newCompany.id}`)

    return NextResponse.json({
      success: true,
      autoApproved: true,
      message: `${companyName.trim()} has been approved. Welcome to StormChain!`,
      company: { id: newCompany.id, name: companyName.trim() },
    })

  } catch (error) {
    console.error('[ACCESS REQUEST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/employer/access-request
 *
 * Check if current user has a pending/flagged request.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Check for pending OR flagged (both mean "waiting for review" from user's perspective)
    const { data: pendingRequest } = await supabase
      .from('employer_access_requests')
      .select('id, company_name, status, created_at')
      .ilike('wallet_address', walletAddress)
      .in('status', ['pending', 'flagged'])
      .maybeSingle()

    return NextResponse.json({
      success: true,
      hasPendingRequest: !!pendingRequest,
      request: pendingRequest,
    })

  } catch (error) {
    console.error('[ACCESS REQUEST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
