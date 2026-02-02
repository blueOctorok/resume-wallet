import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const { role, walletAddress } = await request.json()

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

    // If switching to employer, create a company record if it doesn't exist
    if (newRole === 'employer') {
      // Check if company already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userToUpdate.id)
        .maybeSingle()

      if (!existingCompany) {
        const { error: companyError } = await supabase
          .from('companies')
          .insert({
            employer_user_id: userToUpdate.id,
            company_name: 'My Company', // Placeholder, will be updated in profile
          })

        if (companyError) {
          console.error('Error creating company record:', companyError)
          // Don't fail the request, just log the error
          // The employer can still set up their company later
        } else {
          console.log(
            `[SET ROLE] Company record created for employer user ${userToUpdate.id}`
          )
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
