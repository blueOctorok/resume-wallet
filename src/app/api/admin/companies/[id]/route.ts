import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/admin/companies/[id]
 * 
 * Gets detailed information about a specific company.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get company with owner info
    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        *,
        users!companies_employer_user_id_fkey (
          id,
          name,
          email,
          wallet_address,
          created_at
        )
      `)
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Get team members
    const { data: members } = await supabase
      .from('company_members')
      .select(`
        id,
        role,
        is_active,
        accepted_at,
        invited_at,
        invite_email,
        users (
          id,
          name,
          email
        )
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })

    // Get job postings count
    const { count: jobCount } = await supabase
      .from('job_postings')
      .select('id', { count: 'exact' })
      .eq('company_id', id)

    // Get applications count
    const { count: appCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact' })
      .eq('job_postings.company_id', id)

    // Get status history
    const { data: statusHistory } = await supabase
      .from('company_status_history')
      .select(`
        id,
        previous_status,
        new_status,
        reason,
        notes,
        created_at,
        changed_by,
        changed_by_type
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    const owner = company.users as any

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.company_name,
        dotNumber: company.dot_number,
        mcNumber: company.mc_number,
        status: company.status,
        description: company.description,
        email: company.email,
        phone: company.phone,
        website: company.website,
        address: {
          street: company.address_street,
          city: company.address_city,
          state: company.address_state,
          zip: company.address_zip,
        },
        companySize: company.company_size,
        industryType: company.industry_type,
        logoUrl: company.logo_url,
        verified: company.verified,
        designatedOwnerEmail: company.designated_owner_email,
        onboardingCompleted: company.onboarding_completed,
        adminNotes: company.admin_notes,
        // Owner
        owner: owner ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          walletAddress: owner.wallet_address,
          joinedAt: owner.created_at,
        } : null,
        // Approval info
        approvedBy: company.approved_by,
        approvedAt: company.approved_at,
        suspendedBy: company.suspended_by,
        suspendedAt: company.suspended_at,
        suspensionReason: company.suspension_reason,
        // Stats
        teamMemberCount: members?.length || 0,
        jobPostingCount: jobCount || 0,
        applicationCount: appCount || 0,
        // Timestamps
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      },
      members: (members || []).map(m => {
        const user = m.users as any
        return {
          id: m.id,
          userId: user?.id,
          name: user?.name || 'Pending',
          email: user?.email || m.invite_email,
          role: m.role,
          isActive: m.is_active,
          isPending: !m.accepted_at,
          invitedAt: m.invited_at,
          acceptedAt: m.accepted_at,
        }
      }),
      statusHistory: statusHistory || [],
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
 * PATCH /api/admin/companies/[id]
 * 
 * Updates a company. Supports:
 *   - Approve: { action: 'approve' }
 *   - Suspend: { action: 'suspend', reason: '...' }
 *   - Reactivate: { action: 'reactivate' }
 *   - Update fields: { companyName, adminNotes, etc. }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, reason, adminUserId, ...updateFields } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get current company
    const { data: company } = await supabase
      .from('companies')
      .select('id, status, designated_owner_email, employer_user_id')
      .eq('id', id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Handle actions
    if (action === 'approve') {
      if (company.status !== 'pending') {
        return NextResponse.json(
          { error: 'Company is not pending approval' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          status: 'active',
          approved_by: adminUserId || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('[ADMIN COMPANIES] Approve error:', updateError)
        return NextResponse.json(
          { error: 'Failed to approve company' },
          { status: 500 }
        )
      }

      // If there's a designated owner and they exist, add them to company_members
      if (company.designated_owner_email) {
        const { data: ownerUser } = await supabase
          .from('users')
          .select('id')
          .ilike('email', company.designated_owner_email)
          .maybeSingle()

        if (ownerUser) {
          // Update employer_user_id if not set
          if (!company.employer_user_id) {
            await supabase
              .from('companies')
              .update({ employer_user_id: ownerUser.id })
              .eq('id', id)
          }

          // Add to company_members if not already
          const { data: existingMember } = await supabase
            .from('company_members')
            .select('id')
            .eq('company_id', id)
            .eq('user_id', ownerUser.id)
            .maybeSingle()

          if (!existingMember) {
            await supabase
              .from('company_members')
              .insert({
                company_id: id,
                user_id: ownerUser.id,
                role: 'owner',
                accepted_at: new Date().toISOString(),
                is_active: true,
              })
          }

          // Update user role
          await supabase
            .from('users')
            .update({ role: 'employer' })
            .eq('id', ownerUser.id)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Company approved successfully',
      })
    }

    if (action === 'suspend') {
      if (company.status === 'suspended') {
        return NextResponse.json(
          { error: 'Company is already suspended' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          status: 'suspended',
          suspended_by: adminUserId || null,
          suspended_at: new Date().toISOString(),
          suspension_reason: reason || null,
        })
        .eq('id', id)

      if (updateError) {
        console.error('[ADMIN COMPANIES] Suspend error:', updateError)
        return NextResponse.json(
          { error: 'Failed to suspend company' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Company suspended',
      })
    }

    if (action === 'reactivate') {
      if (company.status !== 'suspended') {
        return NextResponse.json(
          { error: 'Company is not suspended' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          status: 'active',
          suspended_by: null,
          suspended_at: null,
          suspension_reason: null,
        })
        .eq('id', id)

      if (updateError) {
        console.error('[ADMIN COMPANIES] Reactivate error:', updateError)
        return NextResponse.json(
          { error: 'Failed to reactivate company' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Company reactivated',
      })
    }

    // Handle field updates
    const allowedFields = [
      'company_name', 'dot_number', 'mc_number', 'description',
      'email', 'phone', 'website', 'address_street', 'address_city',
      'address_state', 'address_zip', 'company_size', 'industry_type',
      'verified', 'admin_notes', 'designated_owner_email', 'onboarding_completed'
    ]

    const updateData: Record<string, unknown> = {}
    
    // Map camelCase to snake_case
    const fieldMap: Record<string, string> = {
      companyName: 'company_name',
      dotNumber: 'dot_number',
      mcNumber: 'mc_number',
      adminNotes: 'admin_notes',
      designatedOwnerEmail: 'designated_owner_email',
      onboardingCompleted: 'onboarding_completed',
      addressStreet: 'address_street',
      addressCity: 'address_city',
      addressState: 'address_state',
      addressZip: 'address_zip',
      companySize: 'company_size',
      industryType: 'industry_type',
    }

    for (const [key, value] of Object.entries(updateFields)) {
      const dbField = fieldMap[key] || key
      if (allowedFields.includes(dbField) && value !== undefined) {
        updateData[dbField] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('[ADMIN COMPANIES] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update company' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Company updated successfully',
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
 * DELETE /api/admin/companies/[id]
 * 
 * Deletes a company and all related data. Use with caution!
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Check if company exists
    const { data: company } = await supabase
      .from('companies')
      .select('id, company_name')
      .eq('id', id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Explicitly delete related records first (in case FKs don't cascade)
    // Order matters: children before parent

    // 1. Delete company_members (team memberships and pending invites)
    await supabase.from('company_members').delete().eq('company_id', id)

    // 2. Delete job_postings applications first, then jobs
    const { data: jobIds } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', id)
    
    if (jobIds && jobIds.length > 0) {
      const ids = jobIds.map(j => j.id)
      await supabase.from('applications').delete().in('job_posting_id', ids)
      await supabase.from('job_postings').delete().eq('company_id', id)
    }

    // 3. Delete status history
    await supabase.from('company_status_history').delete().eq('company_id', id)

    // 4. Finally delete the company
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN COMPANIES] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete company: ' + deleteError.message },
        { status: 500 }
      )
    }

    console.log(`[ADMIN COMPANIES] Deleted company: ${company.company_name} (${id})`)

    return NextResponse.json({
      success: true,
      message: `Company "${company.company_name}" deleted`,
    })

  } catch (error) {
    console.error('[ADMIN COMPANIES] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
