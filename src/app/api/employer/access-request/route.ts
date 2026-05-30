import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { evaluateEmployerRequest } from '@/lib/ava-employer-eval'
import { emailDomainAllowsEmployerJoin } from '@/lib/employer-domain-match'

/**
 * POST /api/employer/access-request
 *
 * Submit a request to set up or join a company on Storm.
 * Stormi evaluates the request in real-time:
 *   - approve (new company)        -> company + owner created instantly
 *   - approve (existing company)   -> domain-verified auto-join, or flag if mismatch
 *   - flag                         -> stored for human review
 *   - block                        -> denied with explanation
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const body = await request.json()
    const { firstName, lastName, companyName, description, email } = body

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Please select your role and authorization' }, { status: 400 })
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid company email is required' }, { status: 400 })
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const supabase = await getAdminSupabaseClient()

    const { data: authUser } = await supabase
      .from('users')
      .select('id, role, wallet_address')
      .eq('id', userId)
      .maybeSingle()

    const walletAddress = authUser?.wallet_address
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const existingUser = authUser

    // ── Conflict checks ─────────────────────────────────────────

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

    // ── Stormi evaluation ──────────────────────────────────────────
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

    console.log(`[ACCESS REQUEST] Stormi verdict for "${companyName}": ${evalResult.decision} (${evalResult.confidence}) — ${evalResult.reason} | existingMatch: ${evalResult.existingMatch ?? 'none'}`)

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

    // Helper: insert audit row, retry without new columns if migration hasn't run yet
    async function insertAuditRow(extraFields: Record<string, unknown>) {
      const payload = { ...auditFields, ...extraFields }
      console.log('[ACCESS REQUEST] Inserting audit row:', JSON.stringify({ status: payload.status, company: payload.company_name, email: payload.email }))
      const { error } = await supabase.from('employer_access_requests').insert(payload)
      if (error) {
        console.error('[ACCESS REQUEST] Audit insert failed:', error.code, error.message)
        // If first_name/last_name columns don't exist yet, retry without them
        if (error.message?.includes('first_name') || error.message?.includes('last_name') || error.code === '42703') {
          const { first_name, last_name, ...fallback } = payload
          const { error: retryErr } = await supabase.from('employer_access_requests').insert(fallback)
          if (retryErr) console.error('[ACCESS REQUEST] Audit insert retry failed:', retryErr)
          else console.log('[ACCESS REQUEST] Audit insert succeeded on retry (without name columns)')
        }
      } else {
        console.log('[ACCESS REQUEST] Audit row inserted successfully')
      }
    }

    // ── Handle: BLOCK ───────────────────────────────────────────
    if (evalResult.decision === 'block') {
      await insertAuditRow({ status: 'blocked' })

      return NextResponse.json({
        success: false,
        blocked: true,
        message: evalResult.reason,
      })
    }

    // ── Handle: EXISTING COMPANY MATCH ──────────────────────────
    // Stormi detected the requested company name matches one already on Storm.
    // We verify the email domain before auto-joining.
    if (evalResult.existingMatch && evalResult.decision !== 'block') {
      const { data: matchedCompany } = await supabase
        .from('companies')
        .select('id, company_name, email, designated_owner_email')
        .ilike('company_name', evalResult.existingMatch)
        .maybeSingle()

      if (matchedCompany) {
        const companyEmail = matchedCompany.email || matchedCompany.designated_owner_email

        // Exact domain match OR (weak/missing company email + name-aligned work domain, e.g. Pace Drivers + @pacedrivers.com)
        const domainAllowsJoin = emailDomainAllowsEmployerJoin(
          matchedCompany.company_name,
          emailDomain,
          companyEmail,
        )

        if (domainAllowsJoin) {
          await supabase
            .from('users')
            .update({ role: 'employer', email: email.toLowerCase() })
            .eq('id', userId)

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
          await insertAuditRow({ status: 'auto_approved', reviewed_at: new Date().toISOString() })

          console.log(
            `[ACCESS REQUEST] Auto-joined: ${fullName} -> ${matchedCompany.company_name} (@${emailDomain})`,
          )

          return NextResponse.json({
            success: true,
            autoJoined: true,
            message: `You've been added to ${matchedCompany.company_name}. Welcome!`,
            company: { id: matchedCompany.id, name: matchedCompany.company_name },
          })
        }

        const onFileDomain =
          companyEmail?.includes('@') === true
            ? (companyEmail.split('@')[1]?.toLowerCase() ?? 'none')
            : 'none on file'

        // Domain mismatch -> flag for human review regardless of Stormi decision
        await insertAuditRow({
          status: 'flagged',
          ai_reason: `Company "${matchedCompany.company_name}" already exists. Requester @${emailDomain ?? 'unknown'} could not be auto-verified (on-file domain: ${onFileDomain}).`,
        })

        console.log(`[ACCESS REQUEST] Flagged (domain mismatch): ${fullName} for ${matchedCompany.company_name}`)

        return NextResponse.json({
          success: true,
          reviewRequired: true,
          message: `${matchedCompany.company_name} already exists on Storm. Your request to join has been submitted for review.`,
          reviewNote: `We could not automatically verify your work email against this company's record. A reviewer will verify before you are added. If your company email should qualify, ask the owner to set the company email in Storm to your corporate domain.`,
          request: {
            companyName: matchedCompany.company_name,
            status: 'flagged',
          },
        })
      }
    }

    // ── Handle: FLAG (no existing match) ─────────────────────────
    if (evalResult.decision === 'flag') {
      await insertAuditRow({ status: 'flagged' })

      console.log(`[ACCESS REQUEST] Flagged for review: ${fullName} for ${companyName}`)

      return NextResponse.json({
        success: true,
        reviewRequired: true,
        message:
          'Your request was not auto-approved. A team member will review it—you do not have employer access until then.',
        reviewNote: evalResult.reason,
        request: {
          companyName: companyName.trim(),
          status: 'flagged',
        },
      })
    }

    // ── Handle: APPROVE (new company) ────────────────────────────
    // Important: do not set users.role = 'employer' until the company row exists.
    // Otherwise a failed insert (e.g. duplicate name) leaves an orphan employer with no company,
    // and the user hits Company onboarding → POST /api/employer/company → 409 with no admin request.

    await supabase.from('users').update({ email: email.toLowerCase() }).eq('id', userId)

    await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.toLowerCase(),
      },
      { onConflict: 'user_id' }
    )

    const { data: newCompany, error: companyErr } = await supabase
      .from('companies')
      .insert({
        company_name: companyName.trim(),
        employer_user_id: userId,
        email: email.toLowerCase(),
        designated_owner_email: email.toLowerCase(),
        status: 'active',
        approved_at: new Date().toISOString(),
        onboarding_completed: true,
      })
      .select('id')
      .single()

    if (companyErr || !newCompany) {
      console.error('[ACCESS REQUEST] Create company error:', companyErr)
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
    }

    const { error: roleErr } = await supabase
      .from('users')
      .update({ role: 'employer' })
      .eq('id', userId)
    if (roleErr) {
      console.error('[ACCESS REQUEST] Set employer role error:', roleErr)
    }

    await supabase.from('company_members').insert({
      company_id: newCompany.id,
      user_id: userId,
      role: 'owner',
      invite_email: email.toLowerCase(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    })

    await insertAuditRow({ status: 'auto_approved', reviewed_at: new Date().toISOString() })

    console.log(`[ACCESS REQUEST] Auto-approved: ${companyName} -> Company ID: ${newCompany.id}`)

    return NextResponse.json({
      success: true,
      autoApproved: true,
      message: `${companyName.trim()} has been approved. Welcome to Storm!`,
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

    const walletAddress = authUser?.wallet_address
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const { data: pendingRequest } = await supabase
      .from('employer_access_requests')
      .select('id, company_name, status, created_at, ai_reason')
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
