import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * Check if a user has employer access via wallet address or email.
 * Priority: wallet ownership > email ownership > email invite
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const sessionUserId = await getStormUserIdFromRequest(request)

    if (!email && !sessionUserId) {
      return NextResponse.json(
        { error: 'Email or wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // PRIORITY 1: Check by wallet address (most authoritative)
    if (sessionUserId) {
      const { data: walletUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', sessionUserId)
        .maybeSingle()

      if (walletUser) {
        // Check direct company ownership via employer_user_id
        const { data: ownedCompany } = await supabase
          .from('companies')
          .select('id, company_name, status')
          .eq('employer_user_id', walletUser.id)
          .maybeSingle()

        if (ownedCompany) {
          return NextResponse.json({
            hasAccess: true,
            companyName: ownedCompany.company_name,
            accessType: 'owner',
            companyStatus: ownedCompany.status,
            message: `You own ${ownedCompany.company_name}`,
          })
        }

        // Check team membership via company_members
        const { data: membership } = await supabase
          .from('company_members')
          .select(`
            role,
            companies (
              id,
              company_name,
              status
            )
          `)
          .eq('user_id', walletUser.id)
          .eq('is_active', true)
          .maybeSingle()

        if (membership) {
          const company = membership.companies as { company_name: string; status: string } | null
          return NextResponse.json({
            hasAccess: true,
            companyName: company?.company_name,
            accessType: membership.role === 'owner' ? 'owner' : 'team_member',
            role: membership.role,
            message: `You are ${membership.role === 'owner' ? 'the owner of' : `a ${membership.role} at`} ${company?.company_name}`,
          })
        }
      }
    }

    // PRIORITY 2: Check by email for pre-created companies and invites
    if (email) {
      const normalizedEmail = email.toLowerCase().trim()

      // Check for pre-created company awaiting owner claim
      const { data: preCreatedCompany } = await supabase
        .from('companies')
        .select('id, company_name, status')
        .ilike('designated_owner_email', normalizedEmail)
        .is('employer_user_id', null)
        .maybeSingle()

      if (preCreatedCompany) {
        return NextResponse.json({
          hasAccess: true,
          companyName: preCreatedCompany.company_name,
          accessType: 'owner',
          companyStatus: preCreatedCompany.status,
          message: `You are the designated owner of ${preCreatedCompany.company_name}`,
        })
      }

      // Check for pending team invitation
      const { data: pendingInvite } = await supabase
        .from('company_members')
        .select(`
          id,
          role,
          invite_expires_at,
          companies (
            id,
            company_name,
            status
          )
        `)
        .ilike('invite_email', normalizedEmail)
        .is('user_id', null)
        .is('accepted_at', null)
        .maybeSingle()

      if (pendingInvite) {
        const isExpired = pendingInvite.invite_expires_at &&
          new Date(pendingInvite.invite_expires_at) < new Date()

        if (isExpired) {
          return NextResponse.json({
            hasAccess: false,
            message: 'Your invitation has expired. Please ask your company admin to send a new one.',
          })
        }

        const company = pendingInvite.companies as { company_name: string; status: string } | null

        return NextResponse.json({
          hasAccess: true,
          companyName: company?.company_name,
          accessType: 'team_invite',
          role: pendingInvite.role,
          message: `You have a pending invitation to join ${company?.company_name} as ${pendingInvite.role}`,
        })
      }

      // Check if user already exists with this email and has company access
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existingUser) {
        const { data: ownedCompany } = await supabase
          .from('companies')
          .select('id, company_name')
          .eq('employer_user_id', existingUser.id)
          .maybeSingle()

        if (ownedCompany) {
          return NextResponse.json({
            hasAccess: true,
            companyName: ownedCompany.company_name,
            accessType: 'owner',
            message: `You own ${ownedCompany.company_name}`,
          })
        }

        const { data: membership } = await supabase
          .from('company_members')
          .select(`
            role,
            companies (
              company_name
            )
          `)
          .eq('user_id', existingUser.id)
          .eq('is_active', true)
          .maybeSingle()

        if (membership) {
          const company = membership.companies as { company_name: string } | null
          return NextResponse.json({
            hasAccess: true,
            companyName: company?.company_name,
            accessType: 'team_member',
            role: membership.role,
            message: `You are a ${membership.role} at ${company?.company_name}`,
          })
        }
      }
    }

    // No access found
    return NextResponse.json({
      hasAccess: false,
      message: 'Employer access requires an invitation. Contact your company admin or support@provven.com',
    })

  } catch (error) {
    console.error('[CHECK EMPLOYER ACCESS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
