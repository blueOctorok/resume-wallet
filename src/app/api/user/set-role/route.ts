import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendNewCompanyNotification } from '@/lib/send-admin-notification'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'

export async function POST(request: Request) {
  try {
    const { role, walletAddress, companyName, dotNumber } = await request.json()

    // Validate role - allow null/empty to clear role (for testing)
    if (
      role !== null &&
      role !== '' &&
      !['driver', 'developer', 'employer'].includes(role)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid role. Must be "driver", "developer", "employer", or null/empty to clear.',
        },
        { status: 400 }
      )
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()
    const newRole = role === null || role === '' ? null : role

    // Single place for "get or create user" by wallet (avoids duplicate user rows)
    const { user: userToUpdate } = await getOrCreateUserByWallet(supabase, walletAddress, {
      role: newRole,
    })
    const currentRole = userToUpdate.role ?? null
    console.log(
      `[SET ROLE] User ${userToUpdate.id} changing role from "${currentRole}" to "${newRole ?? 'NULL (cleared)'}"`
    )

    // Update user role (set to null if clearing) when it actually changed
    if (currentRole !== newRole) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userToUpdate.id)

      if (updateError) {
        console.error('Error updating user role:', updateError)
        return NextResponse.json(
          { error: 'Failed to update role', details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      console.log(`[SET ROLE] Role unchanged (${newRole}), skipping update`)
    }

    // If switching to employer, handle company assignment
    // Priority:
    //   1. Check for pre-created company with designated_owner_email matching user's email
    //   2. Check for pending team invitations
    //   3. Only if neither exists AND no existing company, create new company
    if (newRole === 'employer') {
      // First, get user's email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userToUpdate.id)
        .single()

      const userEmail = userData?.email?.toLowerCase()
      let companyAssigned = false

      // 1. Check for pre-created company with this email as designated owner
      if (userEmail) {
        const { data: preCreatedCompany } = await supabase
          .from('companies')
          .select('id, company_name, status')
          .ilike('designated_owner_email', userEmail)
          .is('employer_user_id', null) // Not yet claimed
          .maybeSingle()

        if (preCreatedCompany) {
          console.log(
            `[SET ROLE] Found pre-created company "${preCreatedCompany.company_name}" for ${userEmail}`
          )

          // Link user as owner
          const { error: linkError } = await supabase
            .from('companies')
            .update({ employer_user_id: userToUpdate.id })
            .eq('id', preCreatedCompany.id)

          if (!linkError) {
            // Add to company_members as owner
            await supabase.from('company_members').insert({
              company_id: preCreatedCompany.id,
              user_id: userToUpdate.id,
              role: 'owner',
              accepted_at: new Date().toISOString(),
              is_active: true,
            })

            companyAssigned = true
            console.log(
              `[SET ROLE] User linked to pre-created company: ${preCreatedCompany.company_name}`
            )
          }
        }
      }

      // 2. Check for pending team invitations
      if (!companyAssigned && userEmail) {
        const { data: pendingInvite } = await supabase
          .from('company_members')
          .select('id, company_id, role, invite_expires_at')
          .ilike('invite_email', userEmail)
          .is('user_id', null) // Not yet accepted
          .is('accepted_at', null)
          .maybeSingle()

        if (pendingInvite) {
          // Check if invite is not expired
          const isExpired = pendingInvite.invite_expires_at &&
            new Date(pendingInvite.invite_expires_at) < new Date()

          if (!isExpired) {
            console.log(
              `[SET ROLE] Found pending team invitation for ${userEmail}`
            )

            // Accept the invitation
            const { error: acceptError } = await supabase
              .from('company_members')
              .update({
                user_id: userToUpdate.id,
                accepted_at: new Date().toISOString(),
                is_active: true,
              })
              .eq('id', pendingInvite.id)

            if (!acceptError) {
              companyAssigned = true
              console.log(
                `[SET ROLE] User auto-accepted team invitation as ${pendingInvite.role}`
              )
            }
          }
        }
      }

      // 3. Check if user already has a company (from previous employer role)
      if (!companyAssigned) {
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id, company_name')
          .eq('employer_user_id', userToUpdate.id)
          .maybeSingle()

        if (existingCompany) {
          companyAssigned = true
          console.log(
            `[SET ROLE] User already owns company: ${existingCompany.id}`
          )
          // Update name if the owner explicitly provided a new one
          const trimmedName = companyName?.trim()
          if (trimmedName && trimmedName !== existingCompany.company_name) {
            await supabase
              .from('companies')
              .update({ company_name: trimmedName })
              .eq('id', existingCompany.id)
            console.log(
              `[SET ROLE] Updated company name from "${existingCompany.company_name}" to "${trimmedName}"`
            )
          }
        }
      }

      // 4. Check if user is already a member of any company
      if (!companyAssigned) {
        const { data: existingMembership } = await supabase
          .from('company_members')
          .select('id, company_id')
          .eq('user_id', userToUpdate.id)
          .eq('is_active', true)
          .maybeSingle()

        if (existingMembership) {
          companyAssigned = true
          console.log(
            `[SET ROLE] User already member of company: ${existingMembership.company_id}`
          )
        }
      }

      // 5. If nothing found, create a new company with the provided name
      if (!companyAssigned) {
        // Company name is required from the frontend for new employers
        const finalCompanyName = companyName?.trim() || 'My Company'
        
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            employer_user_id: userToUpdate.id,
            company_name: finalCompanyName,
            dot_number: dotNumber?.trim() || null,
            status: 'active', // Active immediately since we collected real info
            designated_owner_email: userEmail || null,
            approved_at: new Date().toISOString(), // Auto-approved
          })
          .select('id')
          .single()

        if (companyError) {
          console.error('Error creating company record:', companyError)
        } else {
          // Add user as owner in company_members
          await supabase.from('company_members').insert({
            company_id: newCompany.id,
            user_id: userToUpdate.id,
            role: 'owner',
            accepted_at: new Date().toISOString(),
            is_active: true,
          })

          console.log(
            `[SET ROLE] New company "${finalCompanyName}" created for employer user ${userToUpdate.id}`
          )

          // Notify admins about the new company (non-blocking)
          sendNewCompanyNotification({
            companyName: finalCompanyName,
            ownerEmail: userEmail || 'Unknown',
            ownerWallet: walletAddress,
            dotNumber: dotNumber?.trim() || null,
          }).catch((err) => {
            console.warn('[SET ROLE] Admin notification failed:', err)
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      role: newRole,
      message: newRole
        ? `Role set to ${newRole} successfully`
        : 'Role cleared successfully',
    })
  } catch (error) {
    console.error('Error in set-role API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
