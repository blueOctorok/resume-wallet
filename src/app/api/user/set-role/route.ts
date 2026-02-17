import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendNewCompanyNotification } from '@/lib/send-admin-notification'

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

    // Use admin client to bypass RLS (we validate wallet address server-side)
    const supabase = await getAdminSupabaseClient()

    // Check if user already exists (case-insensitive wallet comparison)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch user data', details: fetchError.message },
        { status: 500 }
      )
    }

    let userToUpdate = existingUser

    // If user doesn't exist, create them (for Google auth users who haven't been created yet)
    if (!userToUpdate) {
      console.log(
        `[SET ROLE] User not found for wallet ${walletAddress}, creating new user...`
      )
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          is_active: true,
          role: role, // Set role during creation
        })
        .select('id, role')
        .single()

      if (createError) {
        console.error('Error creating user:', createError)
        return NextResponse.json(
          { error: 'Failed to create user', details: createError.message },
          { status: 500 }
        )
      }

      userToUpdate = newUser
      console.log(
        `[SET ROLE] New user created with ID: ${userToUpdate.id}, role: ${role}`
      )
    }

    // Allow role changes (user can switch between driver/employer) or clear role (for testing)
    const newRole = role === null || role === '' ? null : role
    console.log(
      `[SET ROLE] User ${userToUpdate.id} changing role from "${userToUpdate.role}" to "${newRole || 'NULL (cleared)'}"`
    )

    // Update user role (set to null if clearing)
    // Only update if role is actually changing (skip if user was just created with the role)
    if (userToUpdate.role !== newRole) {
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
          .select('id')
          .eq('employer_user_id', userToUpdate.id)
          .maybeSingle()

        if (existingCompany) {
          companyAssigned = true
          console.log(
            `[SET ROLE] User already owns company: ${existingCompany.id}`
          )
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
