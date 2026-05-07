import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  persistCompanyWalletIfMissing,
  syncCoOwnersAfterWalletCreation,
} from '@/lib/persist-company-wallet'
import { emailDomainAllowsEmployerJoin } from '@/lib/employer-domain-match'
import { evaluateEmployerRequest } from '@/lib/ava-employer-eval'

/**
 * POST /api/employer/company
 *
 * Called once by the company owner during onboarding.
 * Creates the company record + owner membership, then marks onboarding complete.
 * Also upserts user_profiles with the owner's name.
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

    const supabase = await getAdminSupabaseClient()
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const trimmedCompanyName = companyName.trim()
    const emailDomain = email.split('@')[1]?.toLowerCase() ?? null

    // ── Stormi gate (same eval as access-request) — fuzzy duplicate + legitimacy before DB writes ──
    const { data: companiesForEval } = await supabase
      .from('companies')
      .select('company_name')
      .limit(200)
    const existingCompanyNamesForEval = (companiesForEval ?? []).map(c => c.company_name).filter(Boolean)

    const evalResult = await evaluateEmployerRequest(
      {
        requesterName: fullName,
        companyName: trimmedCompanyName,
        description:
          'Company profile setup — authorized representative completing Storm employer onboarding (owner, HR, or authorized signatory).',
        emailDomain,
      },
      existingCompanyNamesForEval,
    )

    console.log(
      `[EMPLOYER COMPANY SETUP] Stormi verdict for "${trimmedCompanyName}": ${evalResult.decision} (${evalResult.confidence}) — ${evalResult.reason} | existingMatch: ${evalResult.existingMatch ?? 'none'}`,
    )

    if (evalResult.decision === 'block') {
      return NextResponse.json({ error: evalResult.reason }, { status: 400 })
    }

    /** Queue admin review without requiring a users row (mirrors access-request flagged inserts). */
    async function insertStormiFlaggedAccessRequest(description: string, aiReason: string) {
      const { data: existingPending } = await supabase
        .from('employer_access_requests')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .in('status', ['pending', 'flagged'])
        .maybeSingle()
      if (existingPending) return
      const payload = {
        wallet_address: walletAddress.toLowerCase(),
        email: email.toLowerCase(),
        name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company_name: trimmedCompanyName,
        description,
        status: 'flagged' as const,
        ai_decision: 'flag' as const,
        ai_reason: aiReason,
        ai_confidence: evalResult.confidence,
      }
      const { error: insErr } = await supabase.from('employer_access_requests').insert(payload)
      if (insErr) {
        console.error('[EMPLOYER COMPANY SETUP] employer_access_requests insert:', insErr)
        if (insErr.message?.includes('first_name') || insErr.message?.includes('last_name') || insErr.code === '42703') {
          const { first_name: _fn, last_name: _ln, ...fallback } = payload
          const { error: retryErr } = await supabase.from('employer_access_requests').insert(fallback)
          if (retryErr) console.error('[EMPLOYER COMPANY SETUP] employer_access_requests retry:', retryErr)
        }
      }
    }

    // Fuzzy duplicate: join if domain verifies, else flag (same rules as POST /api/employer/access-request)
    if (evalResult.existingMatch && evalResult.decision !== 'block') {
      const { data: matchedCompany } = await supabase
        .from('companies')
        .select('id, company_name, email, designated_owner_email')
        .ilike('company_name', evalResult.existingMatch)
        .maybeSingle()

      if (matchedCompany) {
        const companyEmail = matchedCompany.email || matchedCompany.designated_owner_email
        const domainAllowsJoin = emailDomainAllowsEmployerJoin(
          matchedCompany.company_name,
          emailDomain,
          companyEmail,
        )

        if (domainAllowsJoin) {
          let userJoin: { id: string; email: string | null } | null = null
          const { data: existingUserJoin, error: userJoinErr } = await supabase
            .from('users')
            .select('id, email')
            .ilike('wallet_address', walletAddress)
            .maybeSingle()

          if (userJoinErr) {
            console.error('[EMPLOYER COMPANY SETUP] User lookup error (join path):', userJoinErr)
            return NextResponse.json({ error: userJoinErr.message || 'Failed to look up user' }, { status: 500 })
          }

          if (existingUserJoin) {
            userJoin = existingUserJoin
            await supabase.from('users').update({ role: 'employer', email: email.toLowerCase() }).eq('id', userJoin.id)
          } else {
            const { data: newUserJoin, error: createJoinErr } = await supabase
              .from('users')
              .insert({
                wallet_address: walletAddress.toLowerCase().trim(),
                email: email.toLowerCase(),
                role: 'employer',
              })
              .select('id, email')
              .single()
            if (createJoinErr || !newUserJoin) {
              console.error('[EMPLOYER COMPANY SETUP] Create user error (join path):', createJoinErr)
              return NextResponse.json({ error: createJoinErr?.message || 'Failed to create user account' }, { status: 500 })
            }
            userJoin = newUserJoin
          }

          await supabase.from('user_profiles').upsert(
            {
              user_id: userJoin.id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.toLowerCase(),
              phone: phone || undefined,
            },
            { onConflict: 'user_id' },
          )

          const { data: alreadyMember } = await supabase
            .from('company_members')
            .select('id')
            .eq('user_id', userJoin.id)
            .eq('company_id', matchedCompany.id)
            .maybeSingle()

          if (!alreadyMember) {
            const { error: joinErr } = await supabase.from('company_members').insert({
              company_id: matchedCompany.id,
              user_id: userJoin.id,
              role: 'recruiter',
              invite_email: email.toLowerCase(),
              accepted_at: new Date().toISOString(),
              is_active: true,
            })
            if (joinErr) {
              console.error('[EMPLOYER COMPANY SETUP] Join existing company error (Stormi match):', joinErr)
              return NextResponse.json(
                { error: 'Could not add you to this company. Try again or contact support.' },
                { status: 500 },
              )
            }
          }

          console.log(
            `[EMPLOYER COMPANY SETUP] Stormi auto-joined: ${fullName} -> ${matchedCompany.company_name} (@${emailDomain})`,
          )

          return NextResponse.json({
            success: true,
            companyId: matchedCompany.id,
            joinedExisting: true,
            companyWalletAddress: null,
          })
        }

        const onFileDomain =
          companyEmail?.includes('@') === true
            ? (companyEmail.split('@')[1]?.toLowerCase() ?? 'none')
            : 'none on file'

        await insertStormiFlaggedAccessRequest(
          `Company "${matchedCompany.company_name}" already exists on Storm. Requester could not be auto-verified (on-file domain: ${onFileDomain}).`,
          `Company "${matchedCompany.company_name}" already exists. Requester @${emailDomain ?? 'unknown'} could not be auto-verified (on-file domain: ${onFileDomain}).`,
        )

        return NextResponse.json({
          success: true,
          reviewRequired: true,
          message: `${matchedCompany.company_name} already exists on Storm. Your request to join has been submitted for review.`,
          reviewNote: `We could not automatically verify your work email against this company's record. A reviewer will verify before you are added.`,
        })
      }

      await insertStormiFlaggedAccessRequest(
        'Company onboarding: Stormi indicated an existing company match but no matching row was found. Submitted for review.',
        evalResult.reason,
      )

      return NextResponse.json({
        success: true,
        reviewRequired: true,
        message: 'Your company request needs a quick review before you can continue.',
        reviewNote: evalResult.reason,
      })
    }

    if (evalResult.decision === 'flag') {
      await insertStormiFlaggedAccessRequest(
        'Company profile onboarding: Stormi flagged this request for human review (company name or legitimacy).',
        evalResult.reason,
      )
      return NextResponse.json({
        success: true,
        reviewRequired: true,
        message:
          'Your request was not auto-approved. A team member will review it—you do not have employer access until then.',
        reviewNote: evalResult.reason,
      })
    }

    // Resolve or create user by wallet address
    let user: { id: string; email: string | null } | null = null
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (userError) {
      console.error('[EMPLOYER COMPANY SETUP] User lookup error:', userError)
      return NextResponse.json({ error: userError.message || 'Failed to look up user' }, { status: 500 })
    }

    if (existingUser) {
      user = existingUser
      await supabase.from('users').update({ email: email || undefined }).eq('id', user.id)
    } else {
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
        return NextResponse.json({ error: createErr?.message || 'Failed to create user account' }, { status: 500 })
      }
      user = newUser
    }

    // Write identity to user_profiles
    const nameParts = fullName.split(/\s+/)
    await supabase.from('user_profiles').upsert(
      { user_id: user.id, first_name: nameParts[0] || null, last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null, display_name: fullName, email: email || undefined },
      { onConflict: 'user_id' }
    )

    // Upsert user_profiles so the hub header displays the correct name
    await supabase.from('user_profiles').upsert(
      {
        user_id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email || undefined,
        phone: phone || undefined,
      },
      { onConflict: 'user_id' }
    )

    // Duplicate company name (case-insensitive). Another owner already has this name.
    // Most users hit this from Company onboarding after a failed access-request left role=employer
    // with no company — they never went through Stormi eval, so central admin had no row. We either
    // auto-join (domain + name rules), or enqueue employer_access_requests for admin review.
    const { data: dupRows } = await supabase
      .from('companies')
      .select('id, employer_user_id, company_name, email, designated_owner_email')
      .ilike('company_name', trimmedCompanyName)
      .limit(1)

    const duplicateCompany = dupRows?.[0]

    if (duplicateCompany && duplicateCompany.employer_user_id !== user.id) {
      const requesterDomain = email.split('@')[1]?.toLowerCase() ?? null
      const companyContact = duplicateCompany.email || duplicateCompany.designated_owner_email

      if (emailDomainAllowsEmployerJoin(duplicateCompany.company_name, requesterDomain, companyContact)) {
        await supabase
          .from('users')
          .update({ role: 'employer', email: email.toLowerCase() })
          .eq('id', user.id)

        const { data: alreadyMember } = await supabase
          .from('company_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('company_id', duplicateCompany.id)
          .maybeSingle()

        if (!alreadyMember) {
          const { error: joinErr } = await supabase.from('company_members').insert({
            company_id: duplicateCompany.id,
            user_id: user.id,
            role: 'recruiter',
            invite_email: email.toLowerCase(),
            accepted_at: new Date().toISOString(),
            is_active: true,
          })
          if (joinErr) {
            console.error('[EMPLOYER COMPANY SETUP] Join existing company error:', joinErr)
            return NextResponse.json(
              { error: 'Could not add you to this company. Try again or contact support.' },
              { status: 500 }
            )
          }
        }

        console.log(
          `[EMPLOYER COMPANY SETUP] Auto-joined user ${user.id} to existing "${duplicateCompany.company_name}" (onboarding form)`
        )

        return NextResponse.json({
          success: true,
          companyId: duplicateCompany.id,
          joinedExisting: true,
          companyWalletAddress: null,
        })
      }

      const { data: existingPending } = await supabase
        .from('employer_access_requests')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .in('status', ['pending', 'flagged'])
        .maybeSingle()

      if (!existingPending) {
        const { error: insErr } = await supabase.from('employer_access_requests').insert({
          wallet_address: walletAddress.toLowerCase(),
          email: email.toLowerCase(),
          name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company_name: trimmedCompanyName,
          description:
            'Submitted from company onboarding: name matches an existing company. Awaiting admin approval to join the team.',
          status: 'flagged',
          ai_decision: 'flag',
          ai_reason:
            'Onboarding duplicate: user completed company setup form for an existing company name; automatic domain join did not apply.',
          ai_confidence: null,
        })
        if (insErr) {
          console.error('[EMPLOYER COMPANY SETUP] employer_access_requests insert:', insErr)
        }
      }

      return NextResponse.json({
        success: true,
        reviewRequired: true,
        message:
          `${trimmedCompanyName} is already on Storm. We submitted your details to Storm admin for review — you do not need the owner to invite you. You will get employer access after approval.`,
      })
    }

    // Check for a pre-created company (admin set up a company with designated_owner_email)
    const { data: existingByEmail } = await supabase
      .from('companies')
      .select('id, onboarding_completed')
      .ilike('designated_owner_email', user.email ?? '')
      .maybeSingle()

    const { data: existingByUserId } = await supabase
      .from('companies')
      .select('id, onboarding_completed')
      .eq('employer_user_id', user.id)
      .maybeSingle()

    const existingCompany = existingByEmail ?? existingByUserId

    const companyFields = {
      company_name: companyName,
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
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyFields)
        .eq('id', existingCompany.id)

      if (updateError) {
        console.error('[EMPLOYER COMPANY SETUP] Update company error:', updateError)
        return NextResponse.json({ error: updateError.message || 'Failed to update company' }, { status: 500 })
      }
      companyId = existingCompany.id
    } else {
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
        return NextResponse.json({ error: insertError?.message || 'Failed to create company' }, { status: 500 })
      }
      companyId = newCompany.id
    }

    // Ensure the owner has a company_members row
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
      return NextResponse.json({ error: memberError.message || 'Failed to link owner to company' }, { status: 500 })
    }

    const walletResult = await persistCompanyWalletIfMissing(
      supabase,
      companyId,
      walletAddress
    )

    if (walletResult?.created) {
      const { data: coFull } = await supabase
        .from('companies')
        .select('employer_user_id')
        .eq('id', companyId)
        .single()
      if (coFull?.employer_user_id) {
        await syncCoOwnersAfterWalletCreation(
          supabase,
          companyId,
          walletResult.walletAddress,
          coFull.employer_user_id
        )
      }
    }

    return NextResponse.json({
      success: true,
      companyId,
      companyWalletAddress: walletResult?.walletAddress ?? null,
    })
  } catch (error) {
    console.error('[EMPLOYER COMPANY SETUP] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
