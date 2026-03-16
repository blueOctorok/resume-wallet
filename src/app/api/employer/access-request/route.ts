import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { evaluateEmployerRequest } from '@/lib/ava-employer-eval'

/**
 * POST /api/employer/access-request
 *
 * Submit a request to set up or join a company on StormChain.
 * AvA evaluates the request in real-time:
 *   - approve (new company)        -> company + owner created instantly
 *   - approve (existing company)   -> domain-verified auto-join, or flag if mismatch
 *   - flag                         -> stored for human review
 *   - block                        -> denied with explanation
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { firstName, lastName, companyName, description, email } = body

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Please describe your role and authorization' }, { status: 400 })
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid company email is required' }, { status: 400 })
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`
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
    const emailDomain = email.split('@')[1]?.toLowerCase() ?? null

    const { data: companies } = await supabase
      .from('companies')
      .select('company_name')
      .limit(200)

    const existingCompanyNames = (companies ?? []).map(c => c.company_name).filter(Boolean)

    const evalResult = await evaluateEmployerRequest(
      {
        requesterName: fullName,
        companyName: companyName.trim(),
        description: description.trim(),
        emailDomain,
      },
      existingCompanyNames
    )

    console.log(`[ACCESS REQUEST] AvA verdict for "${companyName}": ${evalResult.decision} (${evalResult.confidence}) — ${evalResult.reason} | existingMatch: ${evalResult.existingMatch ?? 'none'}`)

    // Shared fields for audit trail inserts
    const auditFields = {
      wallet_address: walletAddress.toLowerCase(),
      email: email.toLowerCase(),
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      company_name: companyName.trim(),
      description: description.trim(),
      ai_decision: evalResult.decision,
      ai_reason: evalResult.reason,
      ai_confidence: evalResult.confidence,
    }

    // ── Handle: BLOCK ───────────────────────────────────────────
    if (evalResult.decision === 'block') {
      await supabase.from('employer_access_requests').insert({
        ...auditFields,
        status: 'blocked',
      })

      return NextResponse.json({
        success: false,
        blocked: true,
        message: evalResult.reason,
      })
    }

    // ── Handle: EXISTING COMPANY MATCH ──────────────────────────
    // AvA detected the requested company name matches one already on StormChain.
    // We verify the email domain before auto-joining.
    if (evalResult.existingMatch && evalResult.decision !== 'block') {
      const { data: matchedCompany } = await supabase
        .from('companies')
        .select('id, company_name, email')
        .ilike('company_name', evalResult.existingMatch)
        .maybeSingle()

      if (matchedCompany) {
        const companyEmailDomain = matchedCompany.email?.split('@')[1]?.toLowerCase() ?? null

        // Domain match -> auto-join as recruiter
        if (emailDomain && companyEmailDomain && emailDomain === companyEmailDomain) {
          // Get or create user
          let userId: string
          if (existingUser) {
            await supabase
              .from('users')
              .update({ role: 'employer', name: fullName, email: email.toLowerCase() })
              .eq('id', existingUser.id)
            userId = existingUser.id
          } else {
            const { data: newUser, error: createErr } = await supabase
              .from('users')
              .insert({
                wallet_address: walletAddress.toLowerCase(),
                email: email.toLowerCase(),
                name: fullName,
                role: 'employer',
              })
              .select('id')
              .single()

            if (createErr || !newUser) {
              console.error('[ACCESS REQUEST] Create user error:', createErr)
              return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
            }
            userId = newUser.id
          }

          // Upsert user_profiles so hub header shows correct name
          await supabase.from('user_profiles').upsert(
            {
              user_id: userId,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.toLowerCase(),
            },
            { onConflict: 'user_id' }
          )

          // Add as team member (recruiter role — owner must promote if needed)
          await supabase.from('company_members').insert({
            company_id: matchedCompany.id,
            user_id: userId,
            role: 'recruiter',
            invite_email: email.toLowerCase(),
            accepted_at: new Date().toISOString(),
            is_active: true,
          })

          // Audit trail
          await supabase.from('employer_access_requests').insert({
            ...auditFields,
            status: 'auto_approved',
            reviewed_at: new Date().toISOString(),
          })

          console.log(`[ACCESS REQUEST] Auto-joined: ${fullName} -> ${matchedCompany.company_name} (domain match: @${emailDomain})`)

          return NextResponse.json({
            success: true,
            autoJoined: true,
            message: `You've been added to ${matchedCompany.company_name}. Welcome!`,
            company: { id: matchedCompany.id, name: matchedCompany.company_name },
          })
        }

        // Domain mismatch -> flag for human review regardless of AvA decision
        await supabase.from('employer_access_requests').insert({
          ...auditFields,
          status: 'flagged',
          ai_reason: `Company "${matchedCompany.company_name}" already exists. Requester email domain @${emailDomain ?? 'unknown'} does not match company domain @${companyEmailDomain ?? 'unknown'}.`,
        })

        console.log(`[ACCESS REQUEST] Flagged (domain mismatch): ${fullName} for ${matchedCompany.company_name}`)

        return NextResponse.json({
          success: true,
          message: `${matchedCompany.company_name} already exists on StormChain. Your request to join has been submitted for review. Please ensure you use a @${companyEmailDomain ?? 'company'} email address for instant access.`,
          request: {
            companyName: matchedCompany.company_name,
            status: 'flagged',
          },
        })
      }
    }

    // ── Handle: FLAG (no existing match) ─────────────────────────
    if (evalResult.decision === 'flag') {
      const { data: flaggedReq } = await supabase
        .from('employer_access_requests')
        .insert({
          ...auditFields,
          status: 'flagged',
        })
        .select()
        .single()

      console.log(`[ACCESS REQUEST] Flagged for review: ${fullName} for ${companyName}`)

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

    // ── Handle: APPROVE (new company) ────────────────────────────

    // 1. Get or create user
    let userId: string
    if (existingUser) {
      await supabase
        .from('users')
        .update({ role: 'employer', name: fullName, email: email.toLowerCase() })
        .eq('id', existingUser.id)
      userId = existingUser.id
    } else {
      const { data: newUser, error: createUserErr } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          email: email.toLowerCase(),
          name: fullName,
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

    // 2. Upsert user_profiles
    await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.toLowerCase(),
      },
      { onConflict: 'user_id' }
    )

    // 3. Create company
    const { data: newCompany, error: companyErr } = await supabase
      .from('companies')
      .insert({
        company_name: companyName.trim(),
        employer_user_id: userId,
        designated_owner_email: email.toLowerCase(),
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

    // 4. Add owner to company_members
    await supabase.from('company_members').insert({
      company_id: newCompany.id,
      user_id: userId,
      role: 'owner',
      invite_email: email.toLowerCase(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    })

    // 5. Audit trail
    await supabase.from('employer_access_requests').insert({
      ...auditFields,
      status: 'auto_approved',
      reviewed_at: new Date().toISOString(),
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
