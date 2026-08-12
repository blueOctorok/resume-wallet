import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { sendEmployerOwnerInvite } from '@/lib/send-admin-notification'
import { domainFromEmail, isPublicEmailDomain, normalizeDomainInput } from '@/lib/employer-domain-match'
import {
  CANDIDATE_CANNOT_BECOME_EMPLOYER,
  isCandidateSurfaceRole,
} from '@/lib/employer-account-guard'

/**
 * GET /api/admin/companies
 * 
 * Lists all companies with filtering options.
 * Query params:
 *   - status: 'pending' | 'active' | 'suspended' | 'all'
 *   - search: Search by company name or DOT number
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search')

    const supabase = await getAdminSupabaseClient()

    // Build query
    let query = supabase
      .from('companies')
      .select(`
        id,
        company_name,
        dot_number,
        mc_number,
        status,
        email,
        phone,
        address_city,
        address_state,
        company_size,
        industry_type,
        logo_url,
        verified,
        designated_owner_email,
        employer_user_id,
        approved_by,
        approved_at,
        suspended_by,
        suspended_at,
        suspension_reason,
        admin_notes,
        onboarding_completed,
        created_at,
        updated_at,
        users!companies_employer_user_id_fkey (
          id,
          email,
          wallet_address
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Search
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,dot_number.ilike.%${search}%`)
    }

    const { data: companies, error } = await query

    if (error) {
      console.error('[ADMIN COMPANIES] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch companies' },
        { status: 500 }
      )
    }

    // Get team member counts for each company
    const companyIds = companies?.map(c => c.id) || []
    
    const { data: memberCounts } = await supabase
      .from('company_members')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('is_active', true)

    const countByCompany = (memberCounts || []).reduce((acc, m) => {
      acc[m.company_id] = (acc[m.company_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Process companies
    const processedCompanies = (companies || []).map(company => {
      const owner = company.users as any
      return {
        id: company.id,
        name: company.company_name,
        dotNumber: company.dot_number,
        mcNumber: company.mc_number,
        status: company.status || 'active',
        email: company.email,
        phone: company.phone,
        city: company.address_city,
        state: company.address_state,
        companySize: company.company_size,
        industryType: company.industry_type,
        logoUrl: company.logo_url,
        verified: company.verified,
        designatedOwnerEmail: company.designated_owner_email,
        onboardingCompleted: company.onboarding_completed,
        adminNotes: company.admin_notes,
        // Owner info
        owner: owner ? {
          id: owner.id,
          email: owner.email,
        } : null,
        ownerEmail: owner?.email || company.designated_owner_email,
        // Approval info
        approvedAt: company.approved_at,
        suspendedAt: company.suspended_at,
        suspensionReason: company.suspension_reason,
        // Team
        teamMemberCount: countByCompany[company.id] || 0,
        // Timestamps
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      }
    })

    // Stats
    const stats = {
      total: processedCompanies.length,
      pending: processedCompanies.filter(c => c.status === 'pending').length,
      active: processedCompanies.filter(c => c.status === 'active').length,
      suspended: processedCompanies.filter(c => c.status === 'suspended').length,
    }

    return NextResponse.json({
      success: true,
      companies: processedCompanies,
      stats,
    })

  } catch (error) {
    console.error('[ADMIN COMPANIES] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/companies
 *
 * Creates a new company. This is the ONLY way an employer account comes into
 * existence — self-serve signup and the AI-reviewed access-request queue were
 * both removed. The designated owner gets the role automatically the first time
 * they sign in with this address (see resolveEmployerLink).
 *
 * Body:
 *   - companyName: Required
 *   - designatedOwnerEmail: Required — who will own the company
 *   - allowedEmailDomains: Required — string[] of domains their team must use.
 *     An empty array means "domainless, the owner vouches for each member" and
 *     must be a deliberate choice, never an accidental default.
 *   - dotNumber / mcNumber / status / adminNotes / email / phone / city / state: Optional
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const body = await request.json()
    const { 
      companyName, 
      dotNumber, 
      mcNumber,
      designatedOwnerEmail, 
      allowedEmailDomains,
      status = 'active',
      adminNotes,
      email,
      phone,
      city,
      state,
    } = body

    if (!companyName || !designatedOwnerEmail) {
      return NextResponse.json(
        { error: 'companyName and designatedOwnerEmail are required' },
        { status: 400 }
      )
    }

    // Required, and an empty array is a valid (audited) answer — but it has to be
    // an answer. `null`/absent would create a company with no enforceable boundary,
    // which is the defect this column exists to remove.
    if (!Array.isArray(allowedEmailDomains)) {
      return NextResponse.json(
        {
          error: 'allowedEmailDomains is required',
          details:
            'Provide the domains this company\'s team must use (e.g. ["pacedrivers.com"]), or an empty array to mark the company domainless.',
        },
        { status: 400 }
      )
    }

    const normalizedDomains = Array.from(
      new Set(allowedEmailDomains.map((d: string) => normalizeDomainInput(String(d))).filter(Boolean))
    )

    const publicDomain = normalizedDomains.find((d) => isPublicEmailDomain(d))
    if (publicDomain) {
      return NextResponse.json(
        {
          error: `"${publicDomain}" is a personal email provider and cannot be a company domain`,
          details: 'Leave the list empty instead to mark this company domainless.',
        },
        { status: 400 }
      )
    }

    const ownerDomain = domainFromEmail(designatedOwnerEmail)
    if (normalizedDomains.length > 0 && !normalizedDomains.includes(ownerDomain)) {
      return NextResponse.json(
        {
          error: `The designated owner's email (@${ownerDomain || '?'}) is not on the allowed domain list`,
          details: `Add @${ownerDomain} to the list, or correct the owner's address. Otherwise they will not be able to invite their own team.`,
        },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Check if company with this DOT number already exists
    if (dotNumber) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('dot_number', dotNumber)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'A company with this DOT number already exists' },
          { status: 409 }
        )
      }
    }

    // Check if designated owner email is already an owner elsewhere
    const { data: existingOwner } = await supabase
      .from('companies')
      .select('id, company_name')
      .eq('designated_owner_email', designatedOwnerEmail.toLowerCase())
      .maybeSingle()

    if (existingOwner) {
      return NextResponse.json(
        { error: `This email is already designated as owner for ${existingOwner.company_name}` },
        { status: 409 }
      )
    }

    // Check if user with this email already exists and has a company
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .ilike('email', designatedOwnerEmail)
      .maybeSingle()

    let employerUserId = null
    if (existingUser) {
      // Candidate accounts stay candidates. The owner must use a separate email
      // (corporate address for a real carrier; a second Gmail for a domainless test).
      if (isCandidateSurfaceRole(existingUser.role)) {
        return NextResponse.json(
          {
            error: CANDIDATE_CANNOT_BECOME_EMPLOYER,
            details: `An account already exists for ${designatedOwnerEmail.toLowerCase()} as a candidate. Pick a different owner email.`,
            code: 'CANDIDATE_EMAIL_IN_USE',
          },
          { status: 409 }
        )
      }

      // Check if they already own a company
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, company_name')
        .eq('employer_user_id', existingUser.id)
        .maybeSingle()

      if (existingCompany) {
        return NextResponse.json(
          { error: `This user already owns ${existingCompany.company_name}` },
          { status: 409 }
        )
      }

      employerUserId = existingUser.id
    }

    // Create the company
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert({
        company_name: companyName,
        dot_number: dotNumber || null,
        mc_number: mcNumber || null,
        designated_owner_email: designatedOwnerEmail.toLowerCase(),
        allowed_email_domains: normalizedDomains,
        employer_user_id: employerUserId, // May be null if user hasn't signed up yet
        status: status,
        approved_at: status === 'active' ? new Date().toISOString() : null,
        admin_notes: adminNotes || null,
        email: email || null,
        phone: phone || null,
        address_city: city || null,
        address_state: state || null,
        onboarding_completed: false,
      })
      .select()
      .single()

    if (createError) {
      console.error('[ADMIN COMPANIES] Create error:', createError)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // If user exists and company is active, add them to company_members as owner
    if (employerUserId && status === 'active') {
      await supabase
        .from('company_members')
        .insert({
          company_id: newCompany.id,
          user_id: employerUserId,
          role: 'owner',
          accepted_at: new Date().toISOString(),
          is_active: true,
        })
        .single()

      // Update user role to employer
      await supabase
        .from('users')
        .update({ role: 'employer' })
        .eq('id', employerUserId)
    }

    // Tell the owner their account is ready. There is no token in this email —
    // access is granted by signing in with the designated address, so forwarding
    // it gives nobody anything. Non-blocking: the company exists either way and
    // the claim works whenever they next sign in.
    const inviteResult = await sendEmployerOwnerInvite({
      companyName,
      ownerEmail: designatedOwnerEmail.toLowerCase(),
      dotNumber: dotNumber || null,
      allowedEmailDomains: normalizedDomains,
    })
    if (!inviteResult.ok) {
      console.error('[ADMIN COMPANIES] Owner invite email failed:', inviteResult.error)
    }

    return NextResponse.json({
      ownerInviteSent: inviteResult.ok,
      success: true,
      message: 'Company created successfully',
      company: {
        id: newCompany.id,
        name: newCompany.company_name,
        status: newCompany.status,
        designatedOwnerEmail: newCompany.designated_owner_email,
      }
    })

  } catch (error) {
    console.error('[ADMIN COMPANIES] Create error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
