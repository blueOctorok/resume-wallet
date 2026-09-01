import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { createCompanyMemberInvite } from '@/lib/create-company-member-invite'

/**
 * GET /api/admin/companies/[id]/members
 * 
 * Lists all members of a company (for admin view).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { id: companyId } = await params

    const supabase = await getAdminSupabaseClient()

    // Fetch company to verify it exists
    const { data: company } = await supabase
      .from('companies')
      .select('id, company_name')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Fetch all members with user info
    const { data: members, error } = await supabase
      .from('company_members')
      .select(`
        id,
        user_id,
        role,
        is_active,
        invited_at,
        accepted_at,
        invite_email,
        users!company_members_user_id_fkey (
          id,
          email,
          wallet_address
        )
      `)
      .eq('company_id', companyId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[ADMIN MEMBERS] Error fetching members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    // Resolve names from user_profiles
    const memberUserIds = (members || []).map((m: any) => (m.users as any)?.id).filter(Boolean)
    const { data: profiles } = memberUserIds.length > 0
      ? await supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', memberUserIds)
      : { data: [] }
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))

    const processedMembers = (members || []).map(member => {
      const user = member.users as any
      const up = profileMap.get(user?.id)
      const profileName = [up?.first_name, up?.last_name].filter(Boolean).join(' ').trim() || null
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        isActive: member.is_active,
        isPending: !member.accepted_at,
        invitedAt: member.invited_at,
        acceptedAt: member.accepted_at,
        inviteEmail: member.invite_email,
        name: profileName,
        email: user?.email || member.invite_email,
        legacyWalletAddress: user?.wallet_address || null,
      }
    })

    return NextResponse.json({
      success: true,
      companyId: company.id,
      companyName: company.company_name,
      members: processedMembers,
    })

  } catch (error) {
    console.error('[ADMIN MEMBERS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/companies/[id]/members
 *
 * Storm admin invite — same insert + email as employer Team, keyed by company id
 * so you do not have to be signed in as the company owner.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { id: companyId } = await params
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email : ''
    const role = typeof body.role === 'string' ? body.role : 'recruiter'

    const supabase = await getAdminSupabaseClient()

    const result = await createCompanyMemberInvite(supabase, {
      companyId,
      email,
      role,
      invitedByUserId: auth.userId || companyId,
      inviterFallbackName: auth.email || 'Provven admin',
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      member: {
        id: result.memberId,
        email: result.email,
        role: result.role,
        isPending: true,
      },
      inviteUrl: result.inviteUrl,
    })
  } catch (error) {
    console.error('[ADMIN MEMBERS] Invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
