import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean)

function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase())
}

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
    const walletAddress = request.headers.get('x-wallet-address')
    const { id: companyId } = await params

    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

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
          name,
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

    const processedMembers = (members || []).map(member => {
      const user = member.users as any
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        isActive: member.is_active,
        isPending: !member.accepted_at,
        invitedAt: member.invited_at,
        acceptedAt: member.accepted_at,
        inviteEmail: member.invite_email,
        name: user?.name || null,
        email: user?.email || member.invite_email,
        walletAddress: user?.wallet_address || null,
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
