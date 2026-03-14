import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendNewCompanyNotification } from '@/lib/send-admin-notification'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'

// Admin wallets that bypass company/invite requirement for employer role (for testing)
const EMPLOYER_WHITELIST_WALLETS = [
  '0x9499cD25C6737A8195e74262f3c5eAE6dA607df3',
].map(w => w.toLowerCase())

export async function POST(request: Request) {
  try {
    const { role, walletAddress, companyName, dotNumber } = await request.json()

    // Validate role - allow null/empty to clear role (for testing)
    if (
      role !== null &&
      role !== '' &&
      !['driver', 'developer', 'employer', 'candidate'].includes(role)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid role. Must be "driver", "developer", "employer", "candidate", or null/empty to clear.',
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

      // 5. If nothing found, check whitelist — then REJECT if not whitelisted
      const isWhitelisted = walletAddress && EMPLOYER_WHITELIST_WALLETS.includes(walletAddress.toLowerCase())

      if (!companyAssigned && !isWhitelisted) {
        console.log(
          `[SET ROLE] Rejected employer access for ${userEmail || walletAddress} - no company/invite found`
        )
        return NextResponse.json(
          {
            error: 'Employer access requires an invitation',
            details: 'Contact your company admin or support@stormchain.com to get access.',
            code: 'NO_EMPLOYER_ACCESS',
          },
          { status: 403 }
        )
      }

      // Whitelisted admins without a company get a dev company auto-created
      if (!companyAssigned && isWhitelisted) {
        console.log(`[SET ROLE] Whitelisted admin ${walletAddress} - auto-creating dev company`)
        const { data: devCompany, error: createErr } = await supabase
          .from('companies')
          .insert({
            company_name: 'StormChain Dev',
            employer_user_id: userToUpdate.id,
            status: 'active',
          })
          .select('id')
          .single()

        if (!createErr && devCompany) {
          await supabase.from('company_members').insert({
            company_id: devCompany.id,
            user_id: userToUpdate.id,
            role: 'owner',
            accepted_at: new Date().toISOString(),
            is_active: true,
          })
          console.log(`[SET ROLE] Created "StormChain Dev" company for admin`)
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
